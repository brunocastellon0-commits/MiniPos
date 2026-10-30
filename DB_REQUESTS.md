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

### DB-003 — RPC atómicas del turno de caja
- Estado: PENDIENTE
- Archivo: db/migrations/0010_cash_rpcs.sql
- Tarea(s) del backlog: E3-01, E3-02, E3-04
- Qué hace: crea `open_cash_session`, `add_cash_movement`, `close_cash_session` y `get_open_cash_session_public` como funciones `security definer` con `search_path = ''`; valida personal activo, una sola caja abierta, motivo/monto de movimientos, egresos contra efectivo disponible y cálculo atómico de esperado/diferencia al cerrar; registra auditoría y otorga EXECUTE solo a `authenticated`.
- Por qué: `0004_cash.sql` solo concede `SELECT`; las mutaciones directas están prohibidas y el cierre debe ser atómico.
- Riesgo / destructivo: no (solo crea/reemplaza funciones y permisos; no borra datos).
- Cómo verificar: en SQL Editor ejecutar `select proname, prosecdef from pg_proc where proname in ('open_cash_session','add_cash_movement','close_cash_session','get_open_cash_session_public');` y confirmar 4 filas con `prosecdef = true`; luego abrir/cerrar un turno de prueba desde la app.
- Aplicada el: _(pendiente)_

## Aplicadas (resumen)

| ID | Archivo | Qué hizo (1 línea) | Aplicada el |
|---|---|---|---|
| DB-001 | 0001..0008 | Esquema baseline (tablas, RLS, grants mínimos, triggers inmutables, vista POS, private helpers) | 2026-10-28 |
| DB-002 | 0009_prevent_last_owner_removal.sql | Trigger para evitar desactivar, degradar o borrar al último dueño activo | 2026-10-29 |
