-- Migración: 0010_cash_rpcs.sql
-- Propósito: RPC atómicas y seguras para el turno de caja (E3).
-- Reglas:
--   - Solo personal activo (owner/cashier) puede abrir, mover efectivo o cerrar.
--   - El cierre lo puede realizar cualquier persona activa en ese momento.
--   - Un egreso nunca puede superar el efectivo disponible.
--   - El efectivo esperado se calcula en la misma transacción del cierre:
--     apertura + ventas en efectivo pagadas + ingresos - egresos.
--   - La diferencia se registra; nunca se autoajusta.
--   - Las mutaciones directas siguen bloqueadas: solo hay GRANT SELECT en las tablas.

-- 1. Apertura de turno
create or replace function public.open_cash_session(
  p_opening_cents bigint,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_notes text;
begin
  if v_user_id is null or not private.is_active_staff() then
    raise exception 'Operación rechazada: se requiere personal activo.'
      using errcode = '42501';
  end if;

  if p_opening_cents is null or p_opening_cents < 0 then
    raise exception 'El saldo inicial debe ser un monto mayor o igual a cero.'
      using errcode = '22023';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');

  begin
    insert into public.cash_sessions (opened_by, opening_cents, notes)
    values (v_user_id, p_opening_cents, v_notes)
    returning id into v_session_id;
  exception
    when unique_violation then
      raise exception 'Ya existe una sesión de caja abierta. Debe cerrarse antes de abrir otra.'
        using errcode = '23505';
  end;

  perform public.write_audit_log(
    'cash.open',
    'cash_sessions',
    v_session_id::text,
    jsonb_build_object('openingCents', p_opening_cents),
    'Apertura de turno de caja'
  );

  return v_session_id;
end;
$$;

-- 2. Movimiento de efectivo (ingreso o egreso)
create or replace function public.add_cash_movement(
  p_session_id uuid,
  p_kind text,
  p_amount_cents bigint,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.cash_sessions%rowtype;
  v_movement_id uuid;
  v_cash_sales bigint;
  v_net_movements bigint;
  v_available bigint;
  v_reason text;
begin
  if v_user_id is null or not private.is_active_staff() then
    raise exception 'Operación rechazada: se requiere personal activo.'
      using errcode = '42501';
  end if;

  if p_kind is null or p_kind not in ('in', 'out') then
    raise exception 'El tipo de movimiento debe ser "in" o "out".'
      using errcode = '22023';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'El monto del movimiento debe ser mayor a cero.'
      using errcode = '22023';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'El motivo del movimiento es obligatorio.'
      using errcode = '22023';
  end if;

  select *
  into v_session
  from public.cash_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Sesión de caja no encontrada.'
      using errcode = 'P0002';
  end if;

  if v_session.status <> 'open' then
    raise exception 'No se pueden agregar movimientos a una sesión cerrada.'
      using errcode = '22023';
  end if;

  if p_kind = 'out' then
    select coalesce(sum(total_cents), 0)::bigint
    into v_cash_sales
    from public.sales
    where session_id = p_session_id
      and status = 'paid'
      and payment_method = 'cash';

    select coalesce(
      sum(case when kind = 'in' then amount_cents else -amount_cents end),
      0
    )::bigint
    into v_net_movements
    from public.cash_movements
    where session_id = p_session_id;

    v_available := v_session.opening_cents + v_cash_sales + v_net_movements;

    if p_amount_cents > v_available then
      raise exception 'El egreso supera el efectivo disponible en caja.'
        using errcode = '22023';
    end if;
  end if;

  insert into public.cash_movements (session_id, kind, amount_cents, reason, user_id)
  values (p_session_id, p_kind, p_amount_cents, v_reason, v_user_id)
  returning id into v_movement_id;

  perform public.write_audit_log(
    'cash.movement',
    'cash_movements',
    v_movement_id::text,
    jsonb_build_object(
      'sessionId', p_session_id,
      'kind', p_kind,
      'amountCents', p_amount_cents
    ),
    v_reason
  );

  return v_movement_id;
end;
$$;

-- 3. Cierre de turno
create or replace function public.close_cash_session(
  p_session_id uuid,
  p_counted_cents bigint,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.cash_sessions%rowtype;
  v_cash_sales bigint;
  v_net_movements bigint;
  v_expected bigint;
  v_difference bigint;
  v_notes text;
  v_closed_id uuid;
begin
  if v_user_id is null or not private.is_active_staff() then
    raise exception 'Operación rechazada: se requiere personal activo.'
      using errcode = '42501';
  end if;

  if p_counted_cents is null or p_counted_cents < 0 then
    raise exception 'El efectivo contado debe ser un monto mayor o igual a cero.'
      using errcode = '22023';
  end if;

  select *
  into v_session
  from public.cash_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Sesión de caja no encontrada.'
      using errcode = 'P0002';
  end if;

  if v_session.status <> 'open' then
    raise exception 'La sesión de caja ya se encuentra cerrada.'
      using errcode = '22023';
  end if;

  select coalesce(sum(total_cents), 0)::bigint
  into v_cash_sales
  from public.sales
  where session_id = p_session_id
    and status = 'paid'
    and payment_method = 'cash';

  select coalesce(
    sum(case when kind = 'in' then amount_cents else -amount_cents end),
    0
  )::bigint
  into v_net_movements
  from public.cash_movements
  where session_id = p_session_id;

  v_expected := v_session.opening_cents + v_cash_sales + v_net_movements;

  if v_expected < 0 then
    raise exception 'El efectivo esperado no puede ser negativo. Revisa los movimientos del turno.'
      using errcode = '22023';
  end if;

  v_difference := p_counted_cents - v_expected;
  v_notes := nullif(btrim(coalesce(p_notes, '')), '');

  update public.cash_sessions
  set status = 'closed',
      closed_by = v_user_id,
      closed_at = clock_timestamp(),
      expected_cash_cents = v_expected,
      counted_cash_cents = p_counted_cents,
      difference_cents = v_difference,
      notes = coalesce(v_notes, notes)
  where id = p_session_id
    and status = 'open'
  returning id into v_closed_id;

  if v_closed_id is null then
    raise exception 'La sesión de caja ya se encuentra cerrada.'
      using errcode = '22023';
  end if;

  perform public.write_audit_log(
    'cash.close',
    'cash_sessions',
    v_closed_id::text,
    jsonb_build_object(
      'expectedCents', v_expected,
      'countedCents', p_counted_cents,
      'differenceCents', v_difference
    ),
    'Cierre de turno de caja'
  );

  return v_closed_id;
end;
$$;

-- 4. Estado público del turno abierto (para la cabecera)
create or replace function public.get_open_cash_session_public()
returns table (
  id uuid,
  opened_at timestamptz,
  opened_by uuid,
  opened_by_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_active_staff() then
    raise exception 'Operación rechazada: se requiere personal activo.'
      using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.opened_at,
    s.opened_by,
    p.full_name
  from public.cash_sessions s
  join public.profiles p on p.id = s.opened_by
  where s.status = 'open'
  limit 1;
end;
$$;

-- 5. Permisos mínimos de ejecución
revoke all on function public.open_cash_session(bigint, text) from public, anon, authenticated;
revoke all on function public.add_cash_movement(uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.close_cash_session(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.get_open_cash_session_public() from public, anon, authenticated;

grant execute on function public.open_cash_session(bigint, text) to authenticated;
grant execute on function public.add_cash_movement(uuid, text, bigint, text) to authenticated;
grant execute on function public.close_cash_session(uuid, bigint, text) to authenticated;
grant execute on function public.get_open_cash_session_public() to authenticated;
