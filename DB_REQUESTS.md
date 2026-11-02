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

### DB-005 · Permiso de descuento para cajeros (E4-07, D-008)
- Estado: PENDIENTE
- Archivo: db/migrations/0012_cashier_discount.sql
- Tarea(s) del backlog: E4-07
- Qué hace: (1) agrega `business_settings.cashier_can_discount boolean not null default false`;
  (2) recrea `get_business_public()` (DROP + CREATE por cambio de tipo de retorno) exponiendo
  `cashier_can_discount`; (3) reemplaza `confirm_sale()` (misma firma) con chequeo: si
  `discount > 0` y el rol no es `owner` y `cashier_can_discount` es falso → error `42501`
  "Tu rol no tiene permiso para aplicar descuentos."
- Por qué: D-008 — "Monto o porcentaje por venta, solo si el rol lo permite (dueño siempre;
  cajero según configuración)". Sin la columna la BD no puede distinguir si un cajero puede
  descontar; la app ya implementa el chequeo y queda "falla-closed" hasta aplicar este SQL.
- Riesgo / destructivo: no — `ADD COLUMN IF NOT EXISTS` con default, DROP+CREATE de una función
  sin dependencias y `CREATE OR REPLACE` con firma idempotente. No toca datos.
- Cómo verificar: `select cashier_can_discount from public.business_settings where id = 1;`
  devuelve `false`; `select cashier_can_discount from public.get_business_public();` no da error
  y devuelve la columna; un cobro con descuento de un cajero falla con
  "Tu rol no tiene permiso para aplicar descuentos." hasta habilitar la casilla.
- Aplicada el:

## Aplicadas (resumen)

| ID | Archivo | Qué hizo (1 línea) | Aplicada el |
|---|---|---|---|
| DB-001 | 0001..0008 | Esquema baseline (tablas, RLS, grants mínimos, triggers inmutables, vista POS, private helpers) | 2026-10-28 |
| DB-002 | 0009_prevent_last_owner_removal.sql | Trigger para evitar desactivar, degradar o borrar al último dueño activo | 2026-10-29 |
| DB-003 | 0010_cash_rpcs.sql | RPCs de turno (apertura, movimientos, cierre, resumen) security definer con auditoría | 2026-10-30 |
| DB-004 | 0011_confirm_sale.sql | RPC atómica `confirm_sale` (idempotente, precios/stock en servidor, venta+ítems+stock en una transacción) | 2026-10-31 |
