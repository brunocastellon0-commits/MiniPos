-- Migración: 0017_profile_role_guard.sql
-- Propósito (DB-010, hallazgo de la revisión E11-01): impedir la escalada de privilegios
-- sobre la propia fila en `profiles` (un cajero autenticado podría hacer
-- `update profiles set role = 'owner' where id = auth.uid()` vía PostgREST).
-- Contexto de la brecha:
--   - 0002 otorga `grant update on public.profiles to authenticated` (todas las columnas,
--     incluidas `role` y `active`).
--   - La política `profiles_update_policy` permite editar la propia fila
--     (`is_owner() or (id = auth.uid() and active = true)`).
--   - El trigger 0009 solo evita remover al ÚLTIMO propietario activo; no impide que un
--     cajero se autoascienda mientras exista otro propietario.
-- Solución: trigger BEFORE UPDATE (SECURITY DEFINER, search_path = '') que exige que la
-- sesión actual sea `owner` para cambiar `role` o `active` en cualquier fila, incluida la
-- propia. La lectura del rol invocador es PRE-update (valor actual), por lo que la
-- autoascensión se rechaza antes de aplicarse.
-- Idempotente: create or replace + drop/create trigger. No borra datos.

create or replace function private.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and coalesce(private.get_user_role(), '') <> 'owner' then
    raise exception 'Solo un propietario puede cambiar el rol o el estado de un usuario.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_profile_role_change() from public, anon, authenticated;

drop trigger if exists trg_guard_profile_role_change on public.profiles;
create trigger trg_guard_profile_role_change
  before update on public.profiles
  for each row
  execute function private.guard_profile_role_change();

-- Complementa (no reemplaza) al trigger 0009 prevent_last_owner_removal, que sigue
-- protegiendo al último propietario activo ante cambios hechos POR un propietario.
--
-- Verificación (después de aplicar, con una sesión de cajero activo):
--   update public.profiles set role = 'owner' where id = auth.uid();
--     -> esperado: 42501 "Solo un propietario puede cambiar el rol o el estado..."
--   update public.profiles set full_name = 'Nombre Nuevo' where id = auth.uid();
--     -> esperado: OK (editar el propio nombre sigue permitido)
--   Como dueño: update public.profiles set role = 'cashier' where id = '<otro>';
--     -> esperado: OK (salvo que sea el último dueño activo: 0009 lo rechaza)
