-- Migración: 0009_prevent_last_owner_removal.sql
-- Propósito: Garantizar a nivel de base de datos que nunca se pueda desactivar, degradar
--            ni eliminar al último propietario activo del sistema (invariante de negocio E1-04).
-- Reglas de seguridad:
--   - Trigger BEFORE UPDATE y BEFORE DELETE en public.profiles.
--   - Función SECURITY DEFINER con search_path = '' para evitar secuestro de ruta.
--   - Revocar permisos a anon y public.

create or replace function private.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining_owners integer;
begin
  -- Solo aplica si el usuario afectado es (o era) propietario activo
  if old.role = 'owner' and old.active = true then
    -- En caso de DELETE o en caso de UPDATE que cambie el rol o lo desactive
    if tg_op = 'DELETE' or (tg_op = 'UPDATE' and (new.role <> 'owner' or new.active = false)) then
      select count(*) into v_remaining_owners
      from public.profiles
      where role = 'owner'
        and active = true
        and id <> old.id;

      if v_remaining_owners = 0 then
        raise exception 'Operación rechazada: no se puede desactivar ni revocar el rol al único propietario activo del sistema.';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

revoke all on function private.prevent_last_owner_removal() from public, anon, authenticated;

drop trigger if exists trg_prevent_last_owner_removal on public.profiles;
create trigger trg_prevent_last_owner_removal
  before update or delete on public.profiles
  for each row execute function private.prevent_last_owner_removal();
