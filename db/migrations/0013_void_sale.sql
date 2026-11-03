-- Migración: 0013_void_sale.sql
-- Propósito: RPC `void_sale` para anular ventas (E5-02, D-005).
-- Reglas:
--   - Solo el propietario (42501); personal activo obligatorio.
--   - Motivo obligatorio y no vacío (22023); máximo 300 caracteres.
--   - Nunca borra: cambia status 'paid' -> 'voided' con voided_by/voided_at/void_reason
--     (el trigger de 0008 solo prohíbe DELETE en sales; el UPDATE permitido es intencional).
--   - Idempotente: si ya está anulada, devuelve su id sin repetir reversas.
--   - Reversa de stock: stock_movements kind 'void_return' (delta > 0) + suma a products.stock_qty.
--   - Reversa de caja: IMPLÍCITA en el cálculo. close_cash_session y add_cash_movement
--     suman solo ventas con status='paid'; al pasar a 'voided' la venta deja de contar.
--     NO se inserta un movimiento 'out': se duplicaría la reversa y haría negativo el esperado.
--   - Auditoría: write_audit_log('sales.void', ...).
-- Trigger 0008: stock_movements/sale_items/audit_log son insert-only; este RPC solo inserta/actualiza
-- en sales y products, ambos permitidos.

create or replace function public.void_sale(
  p_sale_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_item record;
begin
  if v_uid is null or not private.is_active_staff() then
    raise exception 'Operación rechazada: se requiere personal activo.'
      using errcode = '42501';
  end if;

  if coalesce(private.get_user_role(), '') <> 'owner' then
    raise exception 'Solo el propietario puede anular ventas.'
      using errcode = '42501';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo de anulación es obligatorio.'
      using errcode = '22023';
  end if;

  if length(trim(p_reason)) > 300 then
    raise exception 'El motivo de anulación no puede superar 300 caracteres.'
      using errcode = '22023';
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venta no encontrada.'
      using errcode = 'P0002';
  end if;

  -- Idempotencia de anulación
  if v_sale.status = 'voided' then
    return v_sale.id;
  end if;

  if v_sale.status <> 'paid' then
    raise exception 'Solo se pueden anular ventas pagadas.'
      using errcode = '22023';
  end if;

  update public.sales
  set status = 'voided',
      voided_by = v_uid,
      voided_at = now(),
      void_reason = trim(p_reason)
  where id = p_sale_id;

  -- Reversa de stock con movimiento de retorno (sale_items es inmutable: solo lectura aquí)
  for v_item in
    select product_id, quantity
    from public.sale_items
    where sale_id = p_sale_id
      and product_id is not null
  loop
    update public.products
    set stock_qty = stock_qty + v_item.quantity
    where id = v_item.product_id;

    insert into public.stock_movements (
      product_id, kind, delta, reason, ref_type, ref_id, user_id
    ) values (
      v_item.product_id,
      'void_return',
      v_item.quantity,
      'Anulación venta #' || v_sale.number || ': ' || trim(p_reason),
      'sale',
      p_sale_id::text,
      v_uid
    );
  end loop;

  perform public.write_audit_log(
    'sales.void',
    'sales',
    p_sale_id::text,
    jsonb_build_object(
      'reason', trim(p_reason),
      'totalCents', v_sale.total_cents,
      'paymentMethod', v_sale.payment_method,
      'sessionId', v_sale.session_id
    ),
    'Anulación de venta'
  );

  return p_sale_id;
end;
$$;

revoke all on function public.void_sale(uuid, text) from public, anon, authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;
