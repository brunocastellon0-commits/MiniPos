-- Migración: 0007_audit.sql
-- Propósito: Tabla de bitácora de auditoría inmutable (`audit_log`) y función segura para registrar eventos (`write_audit_log`).
-- Reglas de seguridad:
--   - No se concede grant de INSERT, UPDATE ni DELETE sobre `audit_log` a ningún rol de la aplicación.
--   - Todo registro se realiza exclusivamente a través de la función `write_audit_log()`.
--   - `write_audit_log()` valida que el invocador sea un usuario autenticado y activo, forzando `user_id = auth.uid()`.
--   - Consulta de auditoría reservada exclusivamente al Propietario (`owner`).

-- 1. Tabla de log de auditoría
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default clock_timestamp(),
  user_id uuid not null references public.profiles(id),
  action text not null check (length(trim(action)) > 0),
  entity text not null check (length(trim(entity)) > 0),
  entity_id text,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  reason text
);

create index if not exists idx_audit_log_at on public.audit_log(at desc);
create index if not exists idx_audit_log_user on public.audit_log(user_id);
create index if not exists idx_audit_log_entity on public.audit_log(entity);
create index if not exists idx_audit_log_action on public.audit_log(action);

alter table public.audit_log enable row level security;

-- RLS: solo el propietario puede leer el registro de auditoría
drop policy if exists audit_log_select_policy on public.audit_log;
create policy audit_log_select_policy on public.audit_log
  for select
  to authenticated
  using (private.is_owner());

-- Sin políticas de insert/update/delete directo para authenticated
drop policy if exists audit_log_insert_policy on public.audit_log;
drop policy if exists audit_log_update_policy on public.audit_log;
drop policy if exists audit_log_delete_policy on public.audit_log;

-- Grants: solo select para authenticated; sin grant de insert/update/delete
revoke all on public.audit_log from public, anon, authenticated;
grant select on public.audit_log to authenticated;

-- 2. Función segura de escritura de auditoría para Server Actions
create or replace function public.write_audit_log(
  p_action text,
  p_entity text,
  p_entity_id text default null,
  p_summary jsonb default '{}'::jsonb,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_new_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Operación rechazada: se requiere usuario autenticado para escribir en auditoría.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and active = true
  ) then
    raise exception 'Operación rechazada: usuario inactivo o no autorizado.';
  end if;

  if length(trim(coalesce(p_action, ''))) = 0 then
    raise exception 'Parámetro inválido: p_action no puede estar vacío.';
  end if;

  if length(trim(coalesce(p_entity, ''))) = 0 then
    raise exception 'Parámetro inválido: p_entity no puede estar vacío.';
  end if;

  insert into public.audit_log (
    user_id,
    action,
    entity,
    entity_id,
    summary,
    reason,
    at
  ) values (
    v_user_id,
    trim(p_action),
    trim(p_entity),
    p_entity_id,
    coalesce(p_summary, '{}'::jsonb),
    p_reason,
    clock_timestamp()
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke all on function public.write_audit_log(text, text, text, jsonb, text) from public, anon;
grant execute on function public.write_audit_log(text, text, text, jsonb, text) to authenticated;
