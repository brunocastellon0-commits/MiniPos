-- Migración: 0001_private_helpers.sql
-- Propósito: Creación del esquema interno `private` y funciones auxiliares seguras para RLS e inmutabilidad.
-- Seguridad:
--   - El esquema `private` no se expone a la API de Supabase (Data API).
--   - Las funciones son SECURITY DEFINER con `search_path = ''` para prevenir ataques de secuestro de ruta.
--   - Se revocan permisos por defecto a public y anon.

-- 1. Crear esquema privado no expuesto a la Data API
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- 2. Función auxiliar para verificar si el usuario autenticado es Propietario (owner) activo
create or replace function private.is_owner()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'owner'
      and active = true
  );
end;
$$;

revoke all on function private.is_owner() from public, anon, authenticated;

-- 3. Función auxiliar para verificar si el usuario autenticado es personal activo (owner o cashier)
create or replace function private.is_active_staff()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and active = true
  );
end;
$$;

revoke all on function private.is_active_staff() from public, anon, authenticated;

-- 4. Función auxiliar para obtener el rol del usuario autenticado actual (si está activo)
create or replace function private.get_user_role()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid()
    and active = true;
  return v_role;
end;
$$;

revoke all on function private.get_user_role() from public, anon, authenticated;

-- 5. Función de actualización automática de columna updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon;
grant execute on function public.set_updated_at() to authenticated;

-- 6. Funciones de trigger para inmutabilidad (bloqueo de delete y update/delete)
create or replace function private.prevent_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Operación rechazada: no se permite eliminar registros de esta tabla por políticas de inmutabilidad contable/operativa.';
end;
$$;

revoke all on function private.prevent_delete() from public, anon, authenticated;

create or replace function private.prevent_update_or_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Operación rechazada: los registros de esta tabla son estrictamente inmutables (no se permite UPDATE ni DELETE).';
end;
$$;

revoke all on function private.prevent_update_or_delete() from public, anon, authenticated;
