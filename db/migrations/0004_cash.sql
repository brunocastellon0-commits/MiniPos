-- Migración: 0004_cash.sql
-- Propósito: Sesiones de caja (turnos) y movimientos de efectivo (ingresos / retiros).
-- Reglas de negocio e invariantes:
--   - Máximo UNA sola sesión de caja abierta a la vez (índice único parcial).
--   - Invariante de cierre: al cerrar, `difference_cents` = `counted_cash_cents` - `expected_cash_cents`.
--   - Acceso de solo lectura directo para `authenticated`; mutaciones se realizan vía RPCs seguras en E3.

-- 1. Tabla de sesiones de caja
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid not null references public.profiles(id),
  opened_at timestamptz not null default clock_timestamp(),
  opening_cents bigint not null check (opening_cents >= 0),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  expected_cash_cents bigint check (expected_cash_cents is null or expected_cash_cents >= 0),
  counted_cash_cents bigint check (counted_cash_cents is null or counted_cash_cents >= 0),
  difference_cents bigint,
  status text not null default 'open' check (status in ('open', 'closed')),
  notes text,
  created_at timestamptz not null default clock_timestamp(),

  -- Consistencia de estado: campos de cierre obligatorios solo si status = 'closed'
  constraint chk_cash_session_status_consistency check (
    (
      status = 'open'
      and closed_at is null
      and closed_by is null
      and counted_cash_cents is null
      and expected_cash_cents is null
      and difference_cents is null
    ) or (
      status = 'closed'
      and closed_at is not null
      and closed_by is not null
      and counted_cash_cents is not null
      and expected_cash_cents is not null
      and difference_cents is not null
      and difference_cents = (counted_cash_cents - expected_cash_cents)
    )
  )
);

-- Índice único parcial: no pueden coexistir dos turnos con status = 'open'
create unique index if not exists idx_cash_sessions_single_open
  on public.cash_sessions(status)
  where status = 'open';

create index if not exists idx_cash_sessions_opened_by on public.cash_sessions(opened_by);
create index if not exists idx_cash_sessions_closed_by on public.cash_sessions(closed_by) where closed_by is not null;
create index if not exists idx_cash_sessions_opened_at on public.cash_sessions(opened_at desc);

alter table public.cash_sessions enable row level security;

-- RLS cash_sessions: select
drop policy if exists cash_sessions_select_policy on public.cash_sessions;
create policy cash_sessions_select_policy on public.cash_sessions
  for select
  to authenticated
  using (
    private.is_owner()
    or (status = 'open' and private.is_active_staff())
    or (opened_by = auth.uid() or closed_by = auth.uid())
  );

-- 2. Tabla de movimientos de efectivo de caja (ingresos / retiros)
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cash_sessions(id) on delete restrict,
  kind text not null check (kind in ('in', 'out')),
  amount_cents bigint not null check (amount_cents > 0),
  reason text not null check (length(trim(reason)) > 0),
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_cash_movements_session on public.cash_movements(session_id);
create index if not exists idx_cash_movements_user on public.cash_movements(user_id);
create index if not exists idx_cash_movements_created_at on public.cash_movements(created_at desc);

alter table public.cash_movements enable row level security;

-- RLS cash_movements: select
drop policy if exists cash_movements_select_policy on public.cash_movements;
create policy cash_movements_select_policy on public.cash_movements
  for select
  to authenticated
  using (
    private.is_owner()
    or (user_id = auth.uid())
    or exists (
      select 1
      from public.cash_sessions s
      where s.id = session_id
        and s.opened_by = auth.uid()
    )
  );

-- Grants de solo lectura a authenticated (mutaciones por RPC security definer en E3)
revoke all on public.cash_sessions from public, anon, authenticated;
grant select on public.cash_sessions to authenticated;

revoke all on public.cash_movements from public, anon, authenticated;
grant select on public.cash_movements to authenticated;
