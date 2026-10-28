-- Migración: 0005_sales.sql
-- Propósito: Tablas para ventas (`sales`), líneas de venta congeladas (`sale_items`) y ventas pausadas (`held_sales`).
-- Invariantes y reglas de seguridad:
--   - Numeración de ventas secuencial identity (`number`).
--   - Idempotencia garantizada por `client_request_id` único y no vacío.
--   - Verificaciones de integridad en totales (`total_cents = subtotal_cents - discount_cents`, efectivo recibido >= total).
--   - Precio y nombre del producto congelados en `sale_items` en el momento de la venta.
--   - `sales` y `sale_items` son de solo lectura directa por API; la creación atómica se realiza mediante la RPC `confirm_sale`.
--   - `held_sales` permite guardar carritos en espera asociados al cajero.

-- 1. Tabla de ventas
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  session_id uuid not null references public.cash_sessions(id) on delete restrict,
  cashier_id uuid not null references public.profiles(id),
  status text not null default 'paid' check (status in ('paid', 'voided')),
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0 and discount_cents <= subtotal_cents),
  total_cents bigint not null check (total_cents = subtotal_cents - discount_cents and total_cents >= 0),
  payment_method text not null check (payment_method in ('cash', 'qr', 'card')),
  cash_received_cents bigint,
  client_request_id text not null unique check (length(trim(client_request_id)) > 0),
  voided_by uuid references public.profiles(id),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default clock_timestamp(),

  -- Consistencia de pagos en efectivo
  constraint chk_sales_cash_payment check (
    payment_method != 'cash' or (
      cash_received_cents is not null and cash_received_cents >= total_cents
    )
  ),

  -- Consistencia de anulación
  constraint chk_sales_voided_consistency check (
    (status = 'paid' and voided_at is null and voided_by is null and void_reason is null) or
    (status = 'voided' and voided_at is not null and voided_by is not null and void_reason is not null)
  )
);

create index if not exists idx_sales_session on public.sales(session_id);
create index if not exists idx_sales_cashier on public.sales(cashier_id);
create index if not exists idx_sales_created_at on public.sales(created_at desc);
create index if not exists idx_sales_status on public.sales(status);

alter table public.sales enable row level security;

-- RLS sales: el dueño ve todo; el cajero solo ve sus propias ventas
drop policy if exists sales_select_policy on public.sales;
create policy sales_select_policy on public.sales
  for select
  to authenticated
  using (
    private.is_owner() or cashier_id = auth.uid()
  );

-- 2. Tabla de items de venta (congelados)
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null check (length(trim(name_snapshot)) > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  line_total_cents bigint not null check (line_total_cents = unit_price_cents * quantity)
);

create index if not exists idx_sale_items_sale on public.sale_items(sale_id);
create index if not exists idx_sale_items_product on public.sale_items(product_id);

alter table public.sale_items enable row level security;

-- RLS sale_items: dueño ve todo; cajero ve items de sus propias ventas
drop policy if exists sale_items_select_policy on public.sale_items;
create policy sale_items_select_policy on public.sale_items
  for select
  to authenticated
  using (
    private.is_owner() or exists (
      select 1
      from public.sales s
      where s.id = sale_items.sale_id
        and s.cashier_id = auth.uid()
    )
  );

-- 3. Tabla de ventas pausadas (held_sales)
create table if not exists public.held_sales (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

drop trigger if exists trg_held_sales_updated_at on public.held_sales;
create trigger trg_held_sales_updated_at
  before update on public.held_sales
  for each row execute function public.set_updated_at();

create index if not exists idx_held_sales_cashier on public.held_sales(cashier_id);

alter table public.held_sales enable row level security;

-- RLS held_sales: cajero gestiona sus ventas pausadas; dueño gestiona todas
drop policy if exists held_sales_select_policy on public.held_sales;
create policy held_sales_select_policy on public.held_sales
  for select
  to authenticated
  using (
    private.is_owner() or cashier_id = auth.uid()
  );

drop policy if exists held_sales_insert_policy on public.held_sales;
create policy held_sales_insert_policy on public.held_sales
  for insert
  to authenticated
  with check (
    private.is_owner() or (cashier_id = auth.uid() and private.is_active_staff())
  );

drop policy if exists held_sales_update_policy on public.held_sales;
create policy held_sales_update_policy on public.held_sales
  for update
  to authenticated
  using (
    private.is_owner() or cashier_id = auth.uid()
  )
  with check (
    private.is_owner() or (cashier_id = auth.uid() and private.is_active_staff())
  );

drop policy if exists held_sales_delete_policy on public.held_sales;
create policy held_sales_delete_policy on public.held_sales
  for delete
  to authenticated
  using (
    private.is_owner() or cashier_id = auth.uid()
  );

-- Grants
revoke all on public.sales from public, anon, authenticated;
grant select on public.sales to authenticated;

revoke all on public.sale_items from public, anon, authenticated;
grant select on public.sale_items to authenticated;

revoke all on public.held_sales from public, anon, authenticated;
grant select, insert, update, delete on public.held_sales to authenticated;
