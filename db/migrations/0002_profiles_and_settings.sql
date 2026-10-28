-- Migración: 0002_profiles_and_settings.sql
-- Propósito: Tablas de perfiles de usuario (`profiles`), configuración del negocio (`business_settings`),
--            trigger de inicialización de usuarios y función de consulta pública de configuración.
-- Reglas de seguridad:
--   - Registro de usuarios en auth.users siempre genera rol 'cashier' por defecto (nunca lee rol de metadata).
--   - `business_settings` es accesible solo por 'owner' directamente; cajeros usan `get_business_public()`.
--   - RLS estricta y grants mínimos solo a `authenticated`.

-- 1. Tabla de perfiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  role text not null default 'cashier' check (role in ('owner', 'cashier')),
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

-- Trigger de updated_at para profiles
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Habilitar RLS en profiles
alter table public.profiles enable row level security;

-- Políticas RLS en profiles:
-- Propietario puede ver todos los perfiles; cajero solo su propio perfil si está activo
drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy on public.profiles
  for select
  to authenticated
  using (
    private.is_owner() or (id = auth.uid() and active = true)
  );

-- Actualización: Propietario puede actualizar cualquier perfil; el usuario solo puede actualizar su propio full_name sin alterar rol ni estado activo
drop policy if exists profiles_update_policy on public.profiles;
create policy profiles_update_policy on public.profiles
  for update
  to authenticated
  using (
    private.is_owner() or (id = auth.uid() and active = true)
  )
  with check (
    private.is_owner() or (
      id = auth.uid()
      and active = true
      and role = 'cashier'
    )
  );

-- Inserción / Eliminación en profiles: No permitida directamente por API (la maneja el trigger de auth o RPC administrativa)
drop policy if exists profiles_insert_policy on public.profiles;
create policy profiles_insert_policy on public.profiles
  for insert
  to authenticated
  with check (private.is_owner());

drop policy if exists profiles_delete_policy on public.profiles;
create policy profiles_delete_policy on public.profiles
  for delete
  to authenticated
  using (false);

-- Grants en profiles
revoke all on public.profiles from public, anon, authenticated;
grant select, update, insert on public.profiles to authenticated;

-- 2. Tabla singleton de configuración del negocio
create table if not exists public.business_settings (
  id integer primary key default 1 check (id = 1),
  name text not null default 'LILA MARKET' check (length(trim(name)) > 0),
  legal_name text,
  currency_code text not null default 'BOB' check (length(currency_code) = 3),
  currency_symbol text not null default 'Bs' check (length(trim(currency_symbol)) > 0),
  logo_url text,
  allow_negative_stock boolean not null default false,
  low_stock_default integer not null default 5 check (low_stock_default >= 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

-- Trigger de updated_at para business_settings
drop trigger if exists trg_business_settings_updated_at on public.business_settings;
create trigger trg_business_settings_updated_at
  before update on public.business_settings
  for each row execute function public.set_updated_at();

-- Seed inicial genérico del singleton id=1
insert into public.business_settings (
  id, name, legal_name, currency_code, currency_symbol, logo_url, allow_negative_stock, low_stock_default
) values (
  1, 'Mi Minimarket', null, 'BOB', 'Bs', null, false, 5
) on conflict (id) do nothing;

-- RLS en business_settings (Solo owner puede leer o modificar directamente)
alter table public.business_settings enable row level security;

drop policy if exists business_settings_select_policy on public.business_settings;
create policy business_settings_select_policy on public.business_settings
  for select
  to authenticated
  using (private.is_owner());

drop policy if exists business_settings_update_policy on public.business_settings;
create policy business_settings_update_policy on public.business_settings
  for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists business_settings_insert_policy on public.business_settings;
create policy business_settings_insert_policy on public.business_settings
  for insert
  to authenticated
  with check (false);

drop policy if exists business_settings_delete_policy on public.business_settings;
create policy business_settings_delete_policy on public.business_settings
  for delete
  to authenticated
  using (false);

-- Grants en business_settings
revoke all on public.business_settings from public, anon, authenticated;
grant select, update on public.business_settings to authenticated;

-- 3. Función segura para que cajeros obtengan datos públicos de configuración del negocio
create or replace function public.get_business_public()
returns table (
  name text,
  legal_name text,
  currency_code text,
  currency_symbol text,
  logo_url text,
  allow_negative_stock boolean,
  low_stock_default integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Exigir que sea un usuario autenticado y activo
  if not private.is_active_staff() then
    raise exception 'Acceso no autorizado: personal no activo.';
  end if;

  return query
  select
    bs.name,
    bs.legal_name,
    bs.currency_code,
    bs.currency_symbol,
    bs.logo_url,
    bs.allow_negative_stock,
    bs.low_stock_default
  from public.business_settings bs
  where bs.id = 1;
end;
$$;

revoke all on function public.get_business_public() from public, anon;
grant execute on function public.get_business_public() to authenticated;

-- 4. Trigger en auth.users para crear perfil automáticamente
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Usuario'),
    'cashier', -- Se asigna 'cashier' de forma incondicional; el rol 'owner' solo se otorga por script/admin
    true
  )
  on conflict (id) do update
  set full_name = excluded.full_name;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
