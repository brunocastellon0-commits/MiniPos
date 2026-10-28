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

### DB-001 · Esquema baseline, RLS y tipos (0001..0008)
- Estado: PENDIENTE
- Archivo: db/migrations/0001_private_helpers.sql .. db/migrations/0008_immutability_triggers.sql
- Tarea(s) del backlog: E0-05
- Qué hace: Tablas base (profiles, business_settings, categories, products, cash_sessions, cash_movements, sales, sale_items, held_sales, stock_movements, suppliers, purchases, purchase_items, audit_log), esquema private y funciones de autorización, RLS en todas las tablas, GRANTs mínimos por objeto a authenticated, ocultamiento de cost_cents, vista products_pos, funciones seguras products_with_cost(), get_business_public(), write_audit_log(), trigger on_auth_user_created y triggers de inmutabilidad (anti-delete/anti-update contable).
- Por qué: Establecer el modelo de datos relacional y las defensas de seguridad y RLS de LILA MARKET.
- Riesgo / destructivo: No destructivo (crea tablas, índices, vistas, funciones y políticas nuevas).
- Cómo verificar: Ejecutar en el SQL Editor de Supabase las consultas de `docs/RLS_VERIFICATION.sql`. Verificar que las consultas 1 a 4 y 8 devuelvan 0 filas, y que las tablas y permisos coincidan con lo esperado.
- Aplicada el: _

## Aplicadas (resumen)

| ID | Archivo | Qué hizo (1 línea) | Aplicada el |
|---|---|---|---|
