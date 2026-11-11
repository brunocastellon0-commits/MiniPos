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

Sin pendientes.

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
| DB-009 | 0016_login_branding.sql | `grant select (name, logo_url) on business_settings to anon` + política RLS de login (el logo ya no se lee desde la app: E13-04 usa imagen estática) | 2026-11-04 |
| DB-010 | 0017_profile_role_guard.sql | Trigger `BEFORE UPDATE` en `profiles`: solo `owner` cambia `role`/`active` (bloquea autoascenso de cajero, 42501) | 2026-11-04 |
| DB-011 | 0018_perf_indexes.sql | Índices `sales(payment_method)`, `held_sales(created_at desc)` y `profiles(full_name)` (corregido: la columna es `full_name`) | 2026-11-04 |
| DB-012 | 0019_cashier_discount_threshold.sql | Columna `business_settings.cashier_max_discount_cents` + `get_business_public()` la expone + `confirm_sale` aplica el umbral del cajero (42501) | 2026-11-04 |
| DB-013 | 0020_operating_mode_orders.sql | Modalidad operativa (micromarket/restaurante), configuración y tablas/RPCs de pedidos transaccionales | 2026-11-05 |
| DB-014 | 0021_wipe_test_data.sql | Limpieza total de datos de prueba (TRUNCATE 16 tablas + reseed business_settings + borrado de usuarios auth) para entrega | 2026-11-10 |
