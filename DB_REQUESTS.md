# DB_REQUESTS.md — Solicitudes de cambio en la base de datos

> El agente **NO** toca Supabase. Aquí registra lo que el humano debe aplicar a mano
> (SQL Editor de Supabase o CLI local del humano). Ver `AGENTS.md` §2.

## Cómo usar este archivo

**Agente:** agrega una entrada al final con estado `PENDIENTE`, crea el SQL en `db/migrations/` y avisa con el encabezado
`🚨 CAMBIO EN BASE DE DATOS REQUERIDO — ACCIÓN DEL HUMANO 🚨`.

**Humano:** ejecuta el SQL en orden numérico, verifica, y responde al agente: `APLICADA DB-00X`.
Si falla, pega el error: el agente corrige creando una migración nueva (nunca reescribe una ya aplicada).

Estados: `PENDIENTE` → `APLICADA` | `RECHAZADA` | `REEMPLAZADA POR DB-00Y`

## Plantilla de entrada

```
### DB-000 · <título corto>
- Estado: PENDIENTE
- Archivo: db/migrations/NNNN_descripcion.sql
- Tarea(s) del backlog: <IDs>
- Qué hace: <tablas / columnas / funciones / políticas RLS afectadas>
- Por qué: <necesidad funcional>
- Riesgo / destructivo: <sí/no — si hay DROP o UPDATE masivo, explicarlo>
- Cómo verificar: <consulta SELECT o comprobación en el Dashboard>
- Aplicada el: <fecha — la completa el humano>
```

## Mantenimiento (ahorra contexto)

Este archivo debe mantenerse **corto**: el agente lo lee en cada sesión.
- Entradas `PENDIENTE`: completas, en la sección "Pendientes".
- Cuando una pasa a `APLICADA`: el agente reemplaza la entrada completa por **una fila** en "Aplicadas (resumen)". El SQL ya vive en `db/migrations/`; el detalle no se pierde.

## Pendientes

### DB-009 · Branding de la pantalla de login para `anon`
- Estado: PENDIENTE
- Archivo: db/migrations/0016_login_branding.sql
- Tarea(s) del backlog: E10-01
- Qué hace: `grant select (name, logo_url) on public.business_settings to anon` (solo esas 2 columnas) + política RLS `business_settings_select_login` (`for select to anon using (id = 1)`).
- Por qué: la pantalla de inicio de sesión corre sin sesión (`anon`); hoy `get_business_public()` exige `is_active_staff()` y el grant de tabla es solo a `authenticated`, así que el login no puede leer la marca y muestra "LILA MARKET" por defecto.
- Riesgo / destructivo: no — solo lectura de 2 columnas de la fila única; nada de datos sensibles (moneda/prefs/costos siguen denegados).
- Cómo verificar: en login sin sesión, nombre y logo del negocio aparecen en la cabecera; en SQL Editor: `select name, logo_url from business_settings;` devuelve 1 fila y `select currency_symbol from business_settings;` da error de permisos.
- Aplicada el: <fecha — la completa el humano>

### DB-010 · Guardia contra autoascensión de rol en `profiles`
- Estado: PENDIENTE
- Archivo: db/migrations/0017_profile_role_guard.sql
- Tarea(s) del backlog: E11-01
- Qué hace: función `private.guard_profile_role_change()` (SECURITY DEFINER, `search_path=''`) + trigger `BEFORE UPDATE` en `public.profiles` que lanza 42501 si `role` o `active` cambian y la sesión actual no es `owner`.
- Por qué: hallazgo de la revisión E11-01 — `grant update` total sobre `profiles` + política de fila propia permitía a un cajero hacer `update profiles set role='owner' where id=auth.uid()` por PostgREST (el trigger 0009 solo protege al último dueño).
- Riesgo / destructivo: no — solo agrega validación al UPDATE de `profiles`; no borra ni modifica datos. El dueño sigue pudiendo cambiar roles/estados y el cajero seguir pudiendo editar su `full_name`.
- Cómo verificar: con sesión de cajero: `update public.profiles set role='owner' where id=auth.uid();` → error 42501; `update public.profiles set full_name='X' where id=auth.uid();` → OK; como dueño cambiar rol de otro usuario → OK.
- Aplicada el: <fecha — la completa el humano>

### DB-011 · Índices faltantes de rendimiento (E11-05)
- Estado: PENDIENTE
- Archivo: db/migrations/0018_perf_indexes.sql
- Tarea(s) del backlog: E11-05
- Qué hace: 3 `create index if not exists`: `sales(payment_method)`, `held_sales(created_at desc)`, `profiles(full_name)`. No toca datos ni políticas.
- Por qué: son los únicos patrones de consulta sin índice (los demás ya existen desde 0003–0007): los reportes filtran por método de pago con fechas; la lista de ventas pausadas ordena por fecha; la lista de usuarios ordena por nombre. `sales.client_request_id` no se indexa: ya es `UNIQUE` (0005), lo que crea su propio índice.
- Riesgo / destructivo: no — solo DDL de índices idempotente; el costo es espacio mínimo de índices y una escritura marginalmente más lenta en esas tablas.
- Cómo verificar: en SQL Editor, `select indexname from pg_indexes where tablename in ('sales','held_sales','profiles') and indexname like 'idx_%';` muestra los 3 nuevos (`idx_sales_payment_method`, `idx_held_sales_created_at`, `idx_profiles_full_name`).
- Aplicada el: <fecha — la completa el humano>

### DB-012 · Umbral de descuento para cajeros (E11-08)
- Estado: PENDIENTE
- Archivo: db/migrations/0019_cashier_discount_threshold.sql
- Tarea(s) del backlog: E11-08
- Qué hace: columna `business_settings.cashier_max_discount_cents` (`integer not null default 0`, `check >= 0`); recrea `get_business_public()` para exponer la columna (DROP + CREATE por cambio de tipo de retorno); recrea `confirm_sale()` con el chequeo de umbral (cajero con descuento > umbral → error `42501`, dueño y `0` = sin límite no se ven afectados).
- Por qué: es la autoridad del servidor del requisito "umbral de descuento que exige al dueño" (E11-08); la app ya valida con mensaje amigable, pero la BD debe impedir el bypass por PostgREST o RPC directa.
- Riesgo / destructivo: no — agrega una columna con default compatible y sustituye dos funciones con su lógica previa intacta (misma firma que 0011/0012; no toca datos).
- Cómo verificar: con sesión de cajero y `cashier_can_discount=true`, `cashier_max_discount_cents=200`, llamar `select confirm_sale(...)` con `p_discount_cents=300` → error 42501; con `p_discount_cents=200` → OK; `select cashier_max_discount_cents from get_business_public();` devuelve 1 fila.
- Aplicada el: <fecha — la completa el humano>

## Aplicadas (resumen)

| ID | Archivo | Qué hizo (1 línea) | Aplicada el |
|---|---|---|---|
| DB-001 | 0001..0008 | Esquema baseline (tablas, RLS, grants mínimos, triggers inmutables, vista POS, private helpers) | 2026-10-28 |
| DB-002 | 0009_prevent_last_owner_removal.sql | Trigger para evitar desactivar, degradar o borrar al último dueño activo | 2026-10-29 |
| DB-003 | 0010_cash_rpcs.sql | RPCs de turno (apertura, movimientos, cierre, resumen) security definer con auditoría | 2026-10-30 |
| DB-004 | 0011_confirm_sale.sql | RPC atómica `confirm_sale` (idempotente, precios/stock en servidor, venta+ítems+stock en una transacción) | 2026-10-31 |
| DB-005 | 0012_cashier_discount.sql | Columna `business_settings.cashier_can_discount` + `get_business_public()` expone el permiso + `confirm_sale` exige rol owner o casilla habilitada (42501) | 2026-11-02 |
| DB-006 | 0013_void_sale.sql | RPC `void_sale` (solo dueño, motivo, status→voided, reversa de stock `void_return`, auditoría) | 2026-11-03 |
| DB-007 | 0014_adjust_stock_receive.sql | RPCs `adjust_stock` y `receive_purchase` (ajustes/mermas y recepción parcial idempotente atómicos con auditoría) | 2026-11-03 |
| DB-008 | 0015_auth_grants_fix.sql | Grants a `authenticated` (esquema `private` + `is_owner`/`is_active_staff`), `products` sin `cost_cents` a nivel de columna, `anon` sin tablas de negocio | 2026-11-03 |
