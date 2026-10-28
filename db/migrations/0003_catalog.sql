-- Migración: 0003_catalog.sql
-- Propósito: Categorías, productos, vista del POS (sin costos) y función segura de lectura con costos para el dueño.
-- Reglas de seguridad:
--   - La columna `cost_cents` NO se otorga directamente en el grant de SELECT sobre `products` al rol `authenticated`.
--   - El cajero y el POS leen mediante `products_pos` o columnas concedidas (sin acceso a `cost_cents`).
--   - El dueño consulta productos con costo exclusivamente vía la función `products_with_cost()`.
--   - RLS habilitada con separación estricta entre dueño y cajero.

-- 1. Tabla de categorías
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

drop policy if exists categories_select_policy on public.categories;
create policy categories_select_policy on public.categories
  for select
  to authenticated
  using (
    private.is_owner() or (active = true and private.is_active_staff())
  );

drop policy if exists categories_insert_policy on public.categories;
create policy categories_insert_policy on public.categories
  for insert
  to authenticated
  with check (private.is_owner());

drop policy if exists categories_update_policy on public.categories;
create policy categories_update_policy on public.categories
  for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists categories_delete_policy on public.categories;
create policy categories_delete_policy on public.categories
  for delete
  to authenticated
  using (private.is_owner());

revoke all on public.categories from public, anon, authenticated;
grant select, insert, update, delete on public.categories to authenticated;

-- 2. Tabla de productos
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  barcode text unique check (barcode is null or length(trim(barcode)) > 0),
  internal_code text check (internal_code is null or length(trim(internal_code)) > 0),
  category_id uuid references public.categories(id) on delete set null,
  unit_label text not null default 'unidad' check (length(trim(unit_label)) > 0),
  price_cents bigint not null check (price_cents >= 0),
  cost_cents bigint check (cost_cents is null or cost_cents >= 0),
  stock_qty integer not null default 0,
  min_stock integer not null default 5 check (min_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

-- Índices de consulta frecuente
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_active on public.products(active);
create index if not exists idx_products_barcode on public.products(barcode) where barcode is not null;
create index if not exists idx_products_internal_code on public.products(internal_code) where internal_code is not null;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

-- Políticas RLS sobre products
drop policy if exists products_select_policy on public.products;
create policy products_select_policy on public.products
  for select
  to authenticated
  using (
    private.is_owner() or (active = true and private.is_active_staff())
  );

drop policy if exists products_insert_policy on public.products;
create policy products_insert_policy on public.products
  for insert
  to authenticated
  with check (private.is_owner());

drop policy if exists products_update_policy on public.products;
create policy products_update_policy on public.products
  for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists products_delete_policy on public.products;
create policy products_delete_policy on public.products
  for delete
  to authenticated
  using (private.is_owner());

-- Concesión de permisos por columna:
-- `cost_cents` NUNCA se otorga en el select a authenticated.
revoke all on public.products from public, anon, authenticated;
grant select (
  id, name, barcode, internal_code, category_id, unit_label,
  price_cents, stock_qty, min_stock, active, created_at, updated_at
) on public.products to authenticated;
grant insert, update, delete on public.products to authenticated;

-- 3. Vista para punto de venta (POS) sin datos de costo
create or replace view public.products_pos
with (security_invoker = true) as
select
  id,
  name,
  barcode,
  internal_code,
  category_id,
  unit_label,
  price_cents,
  stock_qty,
  min_stock,
  active
from public.products
where active = true;

revoke all on public.products_pos from public, anon, authenticated;
grant select on public.products_pos to authenticated;

-- 4. Función de lectura de productos con costo (exclusiva para Propietario)
create or replace function public.products_with_cost()
returns table (
  id uuid,
  name text,
  barcode text,
  internal_code text,
  category_id uuid,
  unit_label text,
  price_cents bigint,
  cost_cents bigint,
  stock_qty integer,
  min_stock integer,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_owner() then
    raise exception 'Acceso no autorizado: solo el propietario puede consultar costos de productos.';
  end if;

  return query
  select
    p.id,
    p.name,
    p.barcode,
    p.internal_code,
    p.category_id,
    p.unit_label,
    p.price_cents,
    p.cost_cents,
    p.stock_qty,
    p.min_stock,
    p.active,
    p.created_at,
    p.updated_at
  from public.products p;
end;
$$;

revoke all on function public.products_with_cost() from public, anon;
grant execute on function public.products_with_cost() to authenticated;
