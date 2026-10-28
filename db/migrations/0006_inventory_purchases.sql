-- Migración: 0006_inventory_purchases.sql
-- Propósito: Movimientos de stock (`stock_movements`), proveedores (`suppliers`), órdenes de compra (`purchases`)
--            e items de compra (`purchase_items`).
-- Reglas de negocio e invariantes:
--   - `stock_movements` es inmutable; todo cambio de stock registra usuario, motivo y referencia.
--   - En `purchase_items`: `qty_ordered > 0` y `0 <= qty_received <= qty_ordered` (soporte de recepción parcial).
--   - RLS restringida exclusivamente al Propietario (`owner`). El cajero no ve costos ni proveedores ni compras.

-- 1. Tabla de movimientos de inventario / stock
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  kind text not null check (kind in ('sale', 'purchase', 'adjustment', 'waste', 'void_return')),
  delta integer not null check (delta != 0),
  reason text,
  ref_type text check (ref_type is null or ref_type in ('sale', 'purchase', 'adjustment', 'manual')),
  ref_id text,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_stock_movements_product on public.stock_movements(product_id);
create index if not exists idx_stock_movements_kind on public.stock_movements(kind);
create index if not exists idx_stock_movements_created_at on public.stock_movements(created_at desc);
create index if not exists idx_stock_movements_user on public.stock_movements(user_id);

alter table public.stock_movements enable row level security;

drop policy if exists stock_movements_select_policy on public.stock_movements;
create policy stock_movements_select_policy on public.stock_movements
  for select
  to authenticated
  using (private.is_owner());

-- 2. Tabla de proveedores
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

drop policy if exists suppliers_select_policy on public.suppliers;
create policy suppliers_select_policy on public.suppliers
  for select
  to authenticated
  using (private.is_owner());

drop policy if exists suppliers_insert_policy on public.suppliers;
create policy suppliers_insert_policy on public.suppliers
  for insert
  to authenticated
  with check (private.is_owner());

drop policy if exists suppliers_update_policy on public.suppliers;
create policy suppliers_update_policy on public.suppliers
  for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists suppliers_delete_policy on public.suppliers;
create policy suppliers_delete_policy on public.suppliers
  for delete
  to authenticated
  using (private.is_owner());

-- 3. Tabla de compras
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'partial', 'received', 'cancelled')),
  notes text,
  total_cents bigint not null default 0 check (total_cents >= 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

drop trigger if exists trg_purchases_updated_at on public.purchases;
create trigger trg_purchases_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();

create index if not exists idx_purchases_supplier on public.purchases(supplier_id);
create index if not exists idx_purchases_status on public.purchases(status);
create index if not exists idx_purchases_created_at on public.purchases(created_at desc);

alter table public.purchases enable row level security;

drop policy if exists purchases_select_policy on public.purchases;
create policy purchases_select_policy on public.purchases
  for select
  to authenticated
  using (private.is_owner());

drop policy if exists purchases_insert_policy on public.purchases;
create policy purchases_insert_policy on public.purchases
  for insert
  to authenticated
  with check (private.is_owner());

drop policy if exists purchases_update_policy on public.purchases;
create policy purchases_update_policy on public.purchases
  for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- 4. Tabla de items de compra
create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty_ordered integer not null check (qty_ordered > 0),
  qty_received integer not null default 0 check (qty_received >= 0 and qty_received <= qty_ordered),
  unit_cost_cents bigint not null check (unit_cost_cents >= 0)
);

create index if not exists idx_purchase_items_purchase on public.purchase_items(purchase_id);
create index if not exists idx_purchase_items_product on public.purchase_items(product_id);

alter table public.purchase_items enable row level security;

drop policy if exists purchase_items_select_policy on public.purchase_items;
create policy purchase_items_select_policy on public.purchase_items
  for select
  to authenticated
  using (private.is_owner());

drop policy if exists purchase_items_insert_policy on public.purchase_items;
create policy purchase_items_insert_policy on public.purchase_items
  for insert
  to authenticated
  with check (private.is_owner());

drop policy if exists purchase_items_update_policy on public.purchase_items;
create policy purchase_items_update_policy on public.purchase_items
  for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists purchase_items_delete_policy on public.purchase_items;
create policy purchase_items_delete_policy on public.purchase_items
  for delete
  to authenticated
  using (private.is_owner());

-- Grants a authenticated (gobernados por RLS owner-only)
revoke all on public.stock_movements from public, anon, authenticated;
grant select on public.stock_movements to authenticated;

revoke all on public.suppliers from public, anon, authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;

revoke all on public.purchases from public, anon, authenticated;
grant select, insert, update on public.purchases to authenticated;

revoke all on public.purchase_items from public, anon, authenticated;
grant select, insert, update, delete on public.purchase_items to authenticated;
