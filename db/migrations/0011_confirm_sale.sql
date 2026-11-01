-- Migración: 0011_confirm_sale.sql
-- Propósito: RPC atómica de cobro de venta (E4-04).
-- Reglas:
--   - Idempotencia por p_client_request_id: repetir devuelve la venta original sin duplicar.
--   - Precios, nombre y descuento se validan en servidor; el cliente solo envía product_id y quantity.
--   - Verifica turno abierto, producto activo y stock (salvo allow_negative_stock).
--   - Inserta venta + ítems con precio congelado, descuenta stock y registra stock_movements
--     en una sola transacción (todo o nada).
--   - El efectivo recibido debe cubrir el total cuando el pago es en efectivo.

create or replace function public.confirm_sale(
  p_session_id uuid,
  p_payment_method text,
  p_client_request_id text,
  p_items jsonb,
  p_discount_cents bigint default 0,
  p_cash_received_cents bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.cash_sessions%rowtype;
  v_existing uuid;
  v_allow_negative boolean;
  v_subtotal bigint := 0;
  v_discount bigint;
  v_total bigint;
  v_sale_id uuid;
  v_count int := 0;
  v_line jsonb;
  v_product public.products%rowtype;
  v_qty int;
  v_product_id uuid;
  v_lines jsonb := '[]'::jsonb;
begin
  if v_uid is null or not private.is_active_staff() then
    raise exception 'Operación rechazada: se requiere personal activo.'
      using errcode = '42501';
  end if;

  if p_client_request_id is null or length(trim(p_client_request_id)) = 0 then
    raise exception 'El identificador de la venta es obligatorio.'
      using errcode = '22023';
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'qr', 'card') then
    raise exception 'Método de pago inválido.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'La venta debe tener al menos un producto.'
      using errcode = '22023';
  end if;

  select id into v_existing
  from public.sales
  where client_request_id = trim(p_client_request_id);

  if v_existing is not null then
    return v_existing;
  end if;

  select *
  into v_session
  from public.cash_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Turno de caja no encontrado.'
      using errcode = 'P0002';
  end if;

  if v_session.status <> 'open' then
    raise exception 'No hay un turno de caja abierto para cobrar.'
      using errcode = '22023';
  end if;

  select allow_negative_stock into v_allow_negative
  from public.business_settings
  where id = 1;

  v_discount := coalesce(p_discount_cents, 0);
  if v_discount < 0 then
    raise exception 'El descuento no puede ser negativo.'
      using errcode = '22023';
  end if;

  for v_line in select value from jsonb_array_elements(p_items) loop
    v_count := v_count + 1;
    if v_count > 200 then
      raise exception 'Una venta no puede tener más de 200 líneas.'
        using errcode = '22023';
    end if;

    if jsonb_typeof(v_line->'product_id') <> 'string'
      or v_line->>'quantity' is null
      or jsonb_typeof(v_line->'quantity') <> 'number'
      or (v_line->>'quantity')::numeric <> floor((v_line->>'quantity')::numeric)
    then
      raise exception 'Producto o cantidad inválido en la venta.'
        using errcode = '22023';
    end if;

    v_product_id := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'quantity')::int;

    if v_qty <= 0 or v_qty > 9999 then
      raise exception 'La cantidad debe estar entre 1 y 9999.'
        using errcode = '22023';
    end if;

    if exists (
      select 1 from jsonb_array_elements(v_lines) as l(line)
      where (l.line->>'product_id')::uuid = v_product_id
    ) then
      raise exception 'Producto repetido en la venta.'
        using errcode = '22023';
    end if;

    select *
    into v_product
    from public.products
    where id = v_product_id
    for update;

    if not found then
      raise exception 'Producto no encontrado.'
        using errcode = 'P0002';
    end if;

    if not v_product.active then
      raise exception 'El producto % está inactivo.', v_product.name
        using errcode = '22023';
    end if;

    if coalesce(v_allow_negative, false) = false and v_product.stock_qty < v_qty then
      raise exception 'Stock insuficiente para %. Disponible: %, solicitado: %.',
        v_product.name, v_product.stock_qty, v_qty
        using errcode = '22023';
    end if;

    v_subtotal := v_subtotal + (v_product.price_cents * v_qty);

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'price_cents', v_product.price_cents,
      'quantity', v_qty
    ));
  end loop;

  if v_count = 0 then
    raise exception 'La venta debe tener al menos un producto.'
      using errcode = '22023';
  end if;

  if v_discount > v_subtotal then
    raise exception 'El descuento no puede superar el subtotal.'
      using errcode = '22023';
  end if;

  v_total := v_subtotal - v_discount;

  if p_payment_method = 'cash'
    and (p_cash_received_cents is null or p_cash_received_cents < v_total)
  then
    raise exception 'El efectivo recibido debe cubrir el total de la venta.'
      using errcode = '22023';
  end if;

  insert into public.sales (
    session_id,
    cashier_id,
    subtotal_cents,
    discount_cents,
    total_cents,
    payment_method,
    cash_received_cents,
    client_request_id
  ) values (
    p_session_id,
    v_uid,
    v_subtotal,
    v_discount,
    v_total,
    p_payment_method,
    case when p_payment_method = 'cash' then p_cash_received_cents else null end,
    trim(p_client_request_id)
  )
  returning id into v_sale_id;

  for v_line in select value from jsonb_array_elements(v_lines) loop
    insert into public.sale_items (
      sale_id,
      product_id,
      name_snapshot,
      unit_price_cents,
      quantity,
      line_total_cents
    ) values (
      v_sale_id,
      (v_line->>'product_id')::uuid,
      v_line->>'name',
      (v_line->>'price_cents')::bigint,
      (v_line->>'quantity')::int,
      (v_line->>'price_cents')::bigint * (v_line->>'quantity')::int
    );

    update public.products
    set stock_qty = stock_qty - (v_line->>'quantity')::int
    where id = (v_line->>'product_id')::uuid;

    insert into public.stock_movements (
      product_id,
      kind,
      delta,
      reason,
      ref_type,
      ref_id,
      user_id
    ) values (
      (v_line->>'product_id')::uuid,
      'sale',
      -1 * (v_line->>'quantity')::int,
      'Venta registrada',
      'sale',
      v_sale_id::text,
      v_uid
    );
  end loop;

  perform public.write_audit_log(
    'sales.confirm',
    'sales',
    v_sale_id::text,
    jsonb_build_object(
      'sessionId', p_session_id,
      'paymentMethod', p_payment_method,
      'subtotalCents', v_subtotal,
      'discountCents', v_discount,
      'totalCents', v_total
    ),
    'Cobro de venta'
  );

  return v_sale_id;
end;
$$;

revoke all on function public.confirm_sale(uuid, text, text, jsonb, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.confirm_sale(uuid, text, text, jsonb, bigint, bigint)
  to authenticated;
