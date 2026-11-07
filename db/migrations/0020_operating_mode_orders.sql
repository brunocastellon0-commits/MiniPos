-- Migración: 0020_operating_mode_orders.sql
-- Propósito: Modalidad operativa (micromarket vs restaurante) y soporte transaccional de pedidos (Fase A - DB-013).
-- Reglas:
--   - business_settings incorpora operating_mode ('micromarket' | 'restaurant'),
--     enable_held_sales (boolean) y order_charge_timing ('on_order' | 'on_consumption').
--   - get_business_public() expone las nuevas columnas para el cliente/SSR.
--   - Tablas orders y order_items modelan pedidos con RLS estricto y sin DELETE (inmutabilidad).
--   - RPC create_order registra pedido + ítems congelados en una sola transacción sin descontar stock.
--   - RPC charge_order invoca atómicamente confirm_sale (descuento de stock, caja e idempotencia)
--     y asocia la venta al pedido.

-- 1. Ampliación de configuración en business_settings
alter table public.business_settings
  add column if not exists operating_mode text not null default 'micromarket'
    constraint business_settings_operating_mode_check check (operating_mode in ('micromarket', 'restaurant')),
  add column if not exists enable_held_sales boolean not null default true,
  add column if not exists order_charge_timing text not null default 'on_order'
    constraint business_settings_order_charge_timing_check check (order_charge_timing in ('on_order', 'on_consumption'));

-- 2. Recrear get_business_public() con las 3 nuevas columnas
drop function if exists public.get_business_public();

create function public.get_business_public()
returns table (
  name text,
  legal_name text,
  currency_code text,
  currency_symbol text,
  logo_url text,
  allow_negative_stock boolean,
  low_stock_default integer,
  cashier_can_discount boolean,
  cashier_max_discount_cents integer,
  operating_mode text,
  enable_held_sales boolean,
  order_charge_timing text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_staff() then
    raise exception 'Acceso no autorizado: personal no activo.'
      using errcode = '42501';
  end if;

  return query
  select
    bs.name,
    bs.legal_name,
    bs.currency_code,
    bs.currency_symbol,
    bs.logo_url,
    bs.allow_negative_stock,
    bs.low_stock_default,
    bs.cashier_can_discount,
    bs.cashier_max_discount_cents,
    bs.operating_mode,
    bs.enable_held_sales,
    bs.order_charge_timing
  from public.business_settings bs
  where bs.id = 1;
end;
$$;

revoke all on function public.get_business_public() from public, anon;
grant execute on function public.get_business_public() to authenticated;

-- 3. Tabla de pedidos (orders)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  session_id uuid not null references public.cash_sessions(id) on delete restrict,
  created_by uuid not null references public.profiles(id),
  status text not null default 'pendiente' check (status in ('pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado')),
  payment_status text not null default 'pendiente' check (payment_status in ('pendiente', 'pagado')),
  sale_id uuid references public.sales(id) on delete restrict,
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0 and discount_cents <= subtotal_cents),
  total_cents bigint not null check (total_cents = subtotal_cents - discount_cents and total_cents >= 0),
  notes text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  preparing_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_session on public.orders(session_id);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_sale_id on public.orders(sale_id);

alter table public.orders enable row level security;

-- Inmutabilidad: no se permite DELETE en pedidos (cancelación por estado)
drop trigger if exists trg_orders_prevent_delete on public.orders;
create trigger trg_orders_prevent_delete
  before delete on public.orders
  for each row execute function private.prevent_delete();

-- Timestamps automáticos de ciclo de vida
create or replace function private.orders_state_timestamps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  if new.status = 'en_preparacion' and (old.status is null or old.status <> 'en_preparacion') and new.preparing_at is null then
    new.preparing_at := clock_timestamp();
  elsif new.status = 'listo' and (old.status is null or old.status <> 'listo') and new.ready_at is null then
    new.ready_at := clock_timestamp();
  elsif new.status = 'entregado' and (old.status is null or old.status <> 'entregado') and new.delivered_at is null then
    new.delivered_at := clock_timestamp();
  elsif new.status = 'cancelado' and (old.status is null or old.status <> 'cancelado') and new.cancelled_at is null then
    new.cancelled_at := clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_state_timestamps on public.orders;
create trigger trg_orders_state_timestamps
  before update on public.orders
  for each row execute function private.orders_state_timestamps();

-- Políticas RLS orders
drop policy if exists orders_select_policy on public.orders;
create policy orders_select_policy on public.orders
  for select
  to authenticated
  using (private.is_active_staff());

drop policy if exists orders_insert_policy on public.orders;
create policy orders_insert_policy on public.orders
  for insert
  to authenticated
  with check (private.is_active_staff() and created_by = auth.uid());

drop policy if exists orders_update_policy on public.orders;
create policy orders_update_policy on public.orders
  for update
  to authenticated
  using (private.is_active_staff())
  with check (private.is_active_staff());

-- 4. Tabla de ítems del pedido (order_items)
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null check (length(trim(name_snapshot)) > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  line_total_cents bigint not null check (line_total_cents = unit_price_cents * quantity)
);

create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);

alter table public.order_items enable row level security;

drop trigger if exists trg_order_items_prevent_delete on public.order_items;
create trigger trg_order_items_prevent_delete
  before delete on public.order_items
  for each row execute function private.prevent_delete();

-- Políticas RLS order_items
drop policy if exists order_items_select_policy on public.order_items;
create policy order_items_select_policy on public.order_items
  for select
  to authenticated
  using (private.is_active_staff());

drop policy if exists order_items_insert_policy on public.order_items;
create policy order_items_insert_policy on public.order_items
  for insert
  to authenticated
  with check (private.is_active_staff());

-- Grants mínimos explícitos
revoke all on public.orders from public, anon;
grant select, insert, update on public.orders to authenticated;

revoke all on public.order_items from public, anon;
grant select, insert on public.order_items to authenticated;

-- 5. RPC create_order: creación atómica de pedido + ítems (sin descontar stock)
create or replace function public.create_order(
  p_session_id uuid,
  p_items jsonb,
  p_discount_cents bigint default 0,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.cash_sessions%rowtype;
  v_settings public.business_settings%rowtype;
  v_subtotal bigint := 0;
  v_discount bigint;
  v_order_id uuid;
  v_count int := 0;
  v_line jsonb;
  v_product public.products%rowtype;
  v_qty int;
  v_product_id uuid;
  v_line_total bigint;
  v_lines jsonb := '[]'::jsonb;
begin
  if v_uid is null or not private.is_active_staff() then
    raise exception 'Operación rechazada: se requiere personal activo.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido debe contener al menos un producto.'
      using errcode = '22023';
  end if;

  select *
  into v_session
  from public.cash_sessions
  where id = p_session_id;

  if not found then
    raise exception 'Turno de caja no encontrado.'
      using errcode = 'P0002';
  end if;

  if v_session.status <> 'open' then
    raise exception 'No hay un turno de caja abierto para registrar el pedido.'
      using errcode = '22023';
  end if;

  select *
  into v_settings
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
      raise exception 'Un pedido no puede tener más de 200 líneas.'
        using errcode = '22023';
    end if;

    begin
      v_product_id := (v_line->>'product_id')::uuid;
      v_qty := (v_line->>'quantity')::int;
    exception when others then
      raise exception 'Línea de pedido inválida.'
        using errcode = '22023';
    end;

    if v_product_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Línea con producto o cantidad inválida.'
        using errcode = '22023';
    end if;

    select *
    into v_product
    from public.products
    where id = v_product_id
      and active = true;

    if not found then
      raise exception 'Producto no encontrado o inactivo.'
        using errcode = 'P0002';
    end if;

    v_line_total := v_product.price_cents * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id,
      'name_snapshot', v_product.name,
      'unit_price_cents', v_product.price_cents,
      'quantity', v_qty,
      'line_total_cents', v_line_total
    );
  end loop;

  if v_discount > v_subtotal then
    raise exception 'El descuento no puede superar el subtotal.'
      using errcode = '22023';
  end if;

  -- Chequeo de autorización de descuento para cajeros
  if v_discount > 0 and not private.is_owner() then
    if not v_settings.cashier_can_discount then
      raise exception 'Los cajeros no tienen autorización para aplicar descuentos.'
        using errcode = '42501';
    end if;
    if v_settings.cashier_max_discount_cents > 0 and v_discount > v_settings.cashier_max_discount_cents then
      raise exception 'El descuento solicitado supera el límite autorizado para cajeros.'
        using errcode = '42501';
    end if;
  end if;

  insert into public.orders (
    session_id,
    created_by,
    status,
    payment_status,
    subtotal_cents,
    discount_cents,
    total_cents,
    notes
  )
  values (
    p_session_id,
    v_uid,
    'pendiente',
    'pendiente',
    v_subtotal,
    v_discount,
    v_subtotal - v_discount,
    nullif(trim(p_notes), '')
  )
  returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(v_lines) loop
    insert into public.order_items (
      order_id,
      product_id,
      name_snapshot,
      unit_price_cents,
      quantity,
      line_total_cents
    )
    values (
      v_order_id,
      (v_line->>'product_id')::uuid,
      v_line->>'name_snapshot',
      (v_line->>'unit_price_cents')::bigint,
      (v_line->>'quantity')::int,
      (v_line->>'line_total_cents')::bigint
    );
  end loop;

  insert into public.audit_log (
    user_id,
    action,
    target_type,
    target_id,
    details
  )
  values (
    v_uid,
    'order_created',
    'order',
    v_order_id::text,
    jsonb_build_object(
      'order_id', v_order_id,
      'subtotal_cents', v_subtotal,
      'discount_cents', v_discount,
      'total_cents', v_subtotal - v_discount,
      'items_count', v_count
    )
  );

  return v_order_id;
end;
$$;

revoke all on function public.create_order(uuid, jsonb, bigint, text) from public, anon;
grant execute on function public.create_order(uuid, jsonb, bigint, text) to authenticated;

-- 6. RPC charge_order: cobra un pedido existente utilizando confirm_sale
create or replace function public.charge_order(
  p_order_id uuid,
  p_payment_method text,
  p_client_request_id text,
  p_cash_received_cents bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_items jsonb;
  v_sale_id uuid;
begin
  if v_uid is null or not private.is_active_staff() then
    raise exception 'Operación rechazada: se requiere personal activo.'
      using errcode = '42501';
  end if;

  if p_client_request_id is null or length(trim(p_client_request_id)) = 0 then
    raise exception 'El identificador de solicitud de cobro es obligatorio.'
      using errcode = '22023';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido no encontrado.'
      using errcode = 'P0002';
  end if;

  -- Idempotencia: si ya está pagado con venta registrada, retorna la venta
  if v_order.payment_status = 'pagado' and v_order.sale_id is not null then
    return v_order.sale_id;
  end if;

  if v_order.status = 'cancelado' then
    raise exception 'No se puede cobrar un pedido cancelado.'
      using errcode = '22023';
  end if;

  -- Obtener los ítems del pedido en formato para confirm_sale
  select jsonb_agg(
    jsonb_build_object(
      'product_id', oi.product_id,
      'quantity', oi.quantity
    )
  )
  into v_items
  from public.order_items oi
  where oi.order_id = p_order_id;

  if v_items is null or jsonb_array_length(v_items) = 0 then
    raise exception 'El pedido no contiene ítems para cobrar.'
      using errcode = '22023';
  end if;

  -- Cobro atómico mediante confirm_sale (descuento de stock, caja, venta e ítems)
  v_sale_id := public.confirm_sale(
    p_session_id => v_order.session_id,
    p_payment_method => p_payment_method,
    p_client_request_id => trim(p_client_request_id),
    p_items => v_items,
    p_discount_cents => v_order.discount_cents,
    p_cash_received_cents => p_cash_received_cents
  );

  -- Actualizar estado del pedido con la venta vinculada
  update public.orders
  set
    payment_status = 'pagado',
    sale_id = v_sale_id,
    updated_at = clock_timestamp()
  where id = p_order_id;

  insert into public.audit_log (
    user_id,
    action,
    target_type,
    target_id,
    details
  )
  values (
    v_uid,
    'order_charged',
    'order',
    p_order_id::text,
    jsonb_build_object(
      'order_id', p_order_id,
      'sale_id', v_sale_id,
      'payment_method', p_payment_method,
      'total_cents', v_order.total_cents
    )
  );

  return v_sale_id;
end;
$$;

revoke all on function public.charge_order(uuid, text, text, bigint) from public, anon;
grant execute on function public.charge_order(uuid, text, text, bigint) to authenticated;
