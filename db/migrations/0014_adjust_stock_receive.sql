-- Migración: 0014_adjust_stock_receive.sql
-- Propósito: RPCs de inventario y compras (E6-02 y E7-03).
-- Reglas:
--   1. adjust_stock(p_product_id, p_delta, p_kind, p_reason):
--      - Solo propietario activo (42501). kind en ('adjustment','waste'); delta ≠ 0 (22023).
--      - Motivo obligatorio, ≤ 300 caracteres.
--      - Bloquea stock negativo salvo business_settings.allow_negative_stock (22023).
--      - Actualiza products.stock_qty con FOR UPDATE e inserta stock_movements
--        (ref_type 'manual', user_id = autor) — inmutabilidad de 0008 lo permite (solo INSERT).
--      - Auditoría 'inventory.adjust'.
--      - Devuelve el stock resultante.
--   2. receive_purchase(p_purchase_id, p_items, p_update_cost):
--      - Solo propietario activo. p_items: [{product_id, qty_received}].
--      - IDEMPOTENTE por diseño: el delta de stock es (recibido_nuevo - recibido_anterior);
--        repetir la misma llamada no vuelve a sumar stock.
--      - qty_received entre 0 y qty_ordered (22023); solo eso suma stock.
--      - Si p_update_cost, actualiza products.cost_cents con el unit_cost del ítem.
--      - Estado resultante: 'received' si todos los ítems están completos, si no 'partial'.
--      - stock_movements kind 'purchase' solo cuando delta > 0 (ref_type 'purchase').
--      - Auditoría 'purchases.receive'.
--      - Devuelve el id de la compra.
-- Nota: purchase_items no tiene trigger de inmutabilidad (0008) → UPDATE de qty_received permitido.

-- ============================================================
-- 1. Ajustes y mermas de inventario
-- ============================================================
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_delta integer,
  p_kind text,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.products%rowtype;
  v_new_stock integer;
  v_allow_negative boolean;
begin
  if v_uid is null or not private.is_active_staff() then
    raise exception 'Operación rechazada: se requiere personal activo.'
      using errcode = '42501';
  end if;

  if coalesce(private.get_user_role(), '') <> 'owner' then
    raise exception 'Solo el propietario puede ajustar el inventario.'
      using errcode = '42501';
  end if;

  if p_kind is null or p_kind not in ('adjustment', 'waste') then
    raise exception 'Tipo de movimiento inválido (adjustment o waste).'
      using errcode = '22023';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'El delta debe ser distinto de cero.'
      using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio.'
      using errcode = '22023';
  end if;

  if length(trim(p_reason)) > 300 then
    raise exception 'El motivo no puede superar 300 caracteres.'
      using errcode = '22023';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Producto no encontrado.'
      using errcode = 'P0002';
  end if;

  v_new_stock := v_product.stock_qty + p_delta;

  if v_new_stock < 0 then
    select allow_negative_stock into v_allow_negative
    from public.business_settings
    where id = 1;

    if coalesce(v_allow_negative, false) = false then
      raise exception 'El ajuste dejaría el stock en negativo (disponible: %, delta: %).',
        v_product.stock_qty, p_delta
        using errcode = '22023';
    end if;
  end if;

  update public.products
  set stock_qty = v_new_stock
  where id = p_product_id;

  insert into public.stock_movements (
    product_id, kind, delta, reason, ref_type, ref_id, user_id
  ) values (
    p_product_id,
    p_kind,
    p_delta,
    trim(p_reason),
    'manual',
    null,
    v_uid
  );

  perform public.write_audit_log(
    'inventory.adjust',
    'products',
    p_product_id::text,
    jsonb_build_object(
      'kind', p_kind,
      'delta', p_delta,
      'reason', trim(p_reason),
      'stockBefore', v_product.stock_qty,
      'stockAfter', v_new_stock
    ),
    'Ajuste de inventario'
  );

  return v_new_stock;
end;
$$;

revoke all on function public.adjust_stock(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.adjust_stock(uuid, integer, text, text) to authenticated;

-- ============================================================
-- 2. Recepción de compras (total o parcial)
-- ============================================================
create or replace function public.receive_purchase(
  p_purchase_id uuid,
  p_items jsonb,
  p_update_cost boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_purchase public.purchases%rowtype;
  v_line jsonb;
  v_product_id uuid;
  v_new_qty integer;
  v_item public.purchase_items%rowtype;
  v_delta integer;
  v_remaining integer;
  v_has_updates boolean := false;
begin
  if v_uid is null or not private.is_active_staff() then
    raise exception 'Operación rechazada: se requiere personal activo.'
      using errcode = '42501';
  end if;

  if coalesce(private.get_user_role(), '') <> 'owner' then
    raise exception 'Solo el propietario puede recibir compras.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Debe indicar las cantidades recibidas.'
      using errcode = '22023';
  end if;

  select * into v_purchase
  from public.purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'Compra no encontrada.'
      using errcode = 'P0002';
  end if;

  for v_line in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_line->'product_id') <> 'string'
      or v_line->>'qty_received' is null
      or jsonb_typeof(v_line->'qty_received') <> 'number'
      or (v_line->>'qty_received')::numeric <> floor((v_line->>'qty_received')::numeric)
    then
      raise exception 'Producto o cantidad recibida inválida.'
        using errcode = '22023';
    end if;

    v_product_id := (v_line->>'product_id')::uuid;
    v_new_qty := (v_line->>'qty_received')::int;

    if v_new_qty < 0 then
      raise exception 'La cantidad recibida no puede ser negativa.'
        using errcode = '22023';
    end if;

    select * into v_item
    from public.purchase_items
    where purchase_id = p_purchase_id
      and product_id = v_product_id
    for update;

    if not found then
      raise exception 'El producto no pertenece a esta compra.'
        using errcode = 'P0002';
    end if;

    if v_new_qty > v_item.qty_ordered then
      raise exception 'La cantidad recibida no puede superar la ordenada (pedido: %, recibido: %).',
        v_item.qty_ordered, v_new_qty
        using errcode = '22023';
    end if;

    v_delta := v_new_qty - v_item.qty_received;

    if v_delta <> 0 then
      v_has_updates := true;

      update public.purchase_items
      set qty_received = v_new_qty
      where id = v_item.id;

      if v_delta > 0 then
        update public.products
        set stock_qty = stock_qty + v_delta
        where id = v_product_id;

        insert into public.stock_movements (
          product_id, kind, delta, reason, ref_type, ref_id, user_id
        ) values (
          v_product_id,
          'purchase',
          v_delta,
          'Recepción de compra',
          'purchase',
          p_purchase_id::text,
          v_uid
        );
      end if;

      if coalesce(p_update_cost, false) then
        update public.products
        set cost_cents = v_item.unit_cost_cents
        where id = v_product_id;
      end if;
    end if;
  end loop;

  -- Estado resultante: 'received' si todos los ítems están completos
  select coalesce(sum(greatest(qty_ordered - qty_received, 0)), 0)
  into v_remaining
  from public.purchase_items
  where purchase_id = p_purchase_id;

  if v_remaining = 0 then
    update public.purchases set status = 'received' where id = p_purchase_id;
  elsif v_has_updates then
    update public.purchases set status = 'partial' where id = p_purchase_id;
  end if;

  if v_has_updates then
    perform public.write_audit_log(
      'purchases.receive',
      'purchases',
      p_purchase_id::text,
      jsonb_build_object(
        'items', p_items,
        'updateCost', coalesce(p_update_cost, false)
      ),
      'Recepción de compra'
    );
  end if;

  return p_purchase_id;
end;
$$;

revoke all on function public.receive_purchase(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.receive_purchase(uuid, jsonb, boolean) to authenticated;
