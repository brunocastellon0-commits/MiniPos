# PROGRESS.md — Bitácora (solo añadir al final; lee las últimas ~15 líneas)

| Fecha | Tarea | Estado | Evidencia (tests/comando) |
|---|---|---|---|
| 2026-10-27 | E0-01 | DONE | `pnpm typecheck` OK · `pnpm build` OK · `pnpm dev` → HTTP 200 en localhost:3000 |
| 2026-10-27 | E0-02 | DONE | `pnpm check` OK (typecheck + lint + 1 test Vitest/jsdom + audit + build) · `pnpm format:check` OK |
| 2026-10-27 | E0-03 | DONE | `pnpm check` OK (23 tests: primitivas, foco visible, aria-label, dialog) · `/_design` HTTP 200 |
| 2026-10-27 | E0-04 | DONE | `pnpm check` OK · 68 tests totales (45 nuevos de dinero/fecha) · sin dependencias nuevas |
| 2026-10-28 | E0-05 | DONE | Migraciones 0001..0008 aplicadas y verificadas por el humano en Supabase (DB-001) · `src/types/database.ts` OK · RLS verificada |
| 2026-10-28 | E0-06 | DONE | Clientes browser/server SSR · proxy.ts Next 16 con getClaims() · 75 tests Vitest OK (7 nuevos de proxy) · build verde |
| 2026-10-28 | E0-07 | DONE | Interfaces de repositorios · MemoryStore completo · Esqueleto Supabase tipado · 87 tests Vitest OK (12 nuevos de contrato) · build verde |
| 2026-10-28 | E0-08 | DONE | Factories para todas las entidades · Dataset demo boliviano · 90 tests Vitest OK (3 nuevos) · build verde |
| 2026-10-28 | E0-09 | DONE | README.md · CHANGELOG.md · script precommit configurado · format:check y typecheck verde |
| 2026-10-28 | E0-10 | DONE | Cabeceras de seguridad (CSP con nonce, HSTS, nosniff, frame-ancestors none) · 93 tests Vitest OK (3 de security/headers) · build verde |
| 2026-10-28 | E0-11 | DONE | server-only instalado · Escaneo de secretos (no-secrets.test.ts) y no-dangerous-html.test.ts · pnpm audit limpio · build verde |
| 2026-10-28 | E0-12 | DONE | Helper `secureAction` (autenticar, autorizar, rate limit, Zod .strict, handler, audit) · RateLimiter · 114 tests Vitest OK (16 nuevos: authz-matrix y validation) · build verde |
| 2026-10-28 | E1-01 | DONE | Pantalla de login accesible (`/login`) · LoginForm · Server Action `loginAction` con rate limit y sin enumerar usuarios · 125 tests Vitest OK (11 nuevos) · build verde |
| 2026-10-28 | E1-02 | DONE | Módulo de sesión (`getCurrentUser`, `requireUser`, `requireRole`) · Redirección en servidor · 134 tests Vitest OK (9 nuevos en roles.int.test.ts) · build verde |
| 2026-10-28 | E1-03 | DONE | Layout autenticado con navegación por rol · AppHeader · AppSidebar · AppLayoutClient · 139 tests Vitest OK (5 nuevos en navigation.test.tsx) · build verde |
| 2026-10-28 | E1-05 | DONE | Endurecimiento de sesión y login · InactivityTracker e InactivityWatcher (15 min) · Rate limit IP+email · Revocación inmediata · Audit logging · 145 tests Vitest OK (6 nuevos) · build verde |
| 2026-10-29 | E1-06 | DONE | MFA (TOTP) para el dueño · Inscripción, verificación, recomendación y login 2FA · 160 tests Vitest OK (15 nuevos) · build verde |
| 2026-10-29 | E1-04 | DONE | Gestión de usuarios (dueño) · listUsers, updateName, updateRole, toggleActive · Protección último dueño activo (dominio + trigger SQL) · Pantalla /usuarios con tabla, diálogo editar e instrucciones alta · 189 tests OK (29 nuevos) · build verde |
| 2026-10-29 | E2-01 | DONE | CRUD de categor�as (crear, renombrar, ordenar, activar/desactivar, eliminar solo sin productos) � 19 tests dirigidos OK (dominio, acciones, UI) � typecheck OK |
| 2026-10-29 | E2-02 | DONE | CRUD de productos con formulario por secciones, Zod estricto, barcode �nico, filtros/paginaci�n y stock solo lectura al editar � 13 tests nuevos OK (acciones/UI) � typecheck OK |
| 2026-10-29 | E2-03 | DONE | Importaci�n CSV con plantilla descargable, vista previa de errores por fila e importaci�n at�mica v�a createMany � 16 tests nuevos OK (dominio/acciones/UI) � typecheck OK |
| 2026-10-29 | E2-04 | DONE-PENDING-HUMAN-VERIFY | Búsqueda POS por nombre sin acentos/código exacto con orden por relevancia; acción owner+cajero sin costo · 8 tests nuevos OK · pnpm check verde (245+24) · falta medir <300 ms con 5.000 productos reales |
| 2026-10-30 | E3-03 | DONE | Dominio de efectivo esperado y diferencia (invariante 5) + resumen por método de pago · 5 tests unitarios OK · pnpm check verde |
| 2026-10-30 | E3-01 | BLOCKED-DB | Apertura de turno implementada (acción + RPC + página /turno + cabecera "Caja abierta · desde · responsable") · tests open-session.int OK · 18 tests cash OK · pnpm check verde · pendiente APLICADA DB-003 |
| 2026-10-30 | E3-02 | BLOCKED-DB | Movimientos in/out con motivo/monto/usuario y rechazo de egreso > disponible · tests movements.int OK · pendiente APLICADA DB-003 |
| 2026-10-30 | E3-04 | BLOCKED-DB | Cierre con resumen por método, esperado/contado/diferencia sin autoajuste, confirmación y estado visual · tests close-session.int OK · pendiente APLICADA DB-003 |
| 2026-10-30 | E3-05 | DONE-PENDING-HUMAN-VERIFY | Historial en pestaña /turno (dueño todos, cajero los suyos) + tablero turno actual · tests OK · falta verificar RLS en BD real |
| 2026-10-30 | DB-003 | APLICADA | 0010_cash_rpcs.sql aplicada por el humano · E3-01/E3-02/E3-04 pasan a DONE |
| 2026-10-30 | E4-01 | DONE | Dominio del carrito puro (agregar/incrementar/cantidad/eliminar/vaciar, subtotal, descuento monto-%, total, D-002 stock) · 7 tests unitarios OK · lint/typecheck OK |
| 2026-10-30 | E4-02 | DONE | UI de Caja: catálogo con buscador F2, chips de categorías, tarjetas con stock, carrito (+/−, papelera, Vaciar, descuento, Total, Cobrar F9), sin turno → /turno · 8 tests de componente OK · pnpm check verde |
| 2026-10-30 | E4-03 | DONE | Escaneo: Enter con código exacto agrega 1 unidad, aviso "Código no encontrado", foco conservado · cubierto en pos-client.test.tsx |
| 2026-10-30 | E4-04 | BLOCKED-DB | Cobro implementado (confirmSaleAction con precios en servidor + RPC confirm_sale + diálogo de pago idempotente con client_request_id y carrito conservado ante error) · 6 tests sales.test OK + 8 componentes OK · pendiente APLICADA DB-004 |
| 2026-10-31 | DB-004 | APLICADA | 0011_confirm_sale.sql aplicada por el humano → E4-04 pasa a DONE (NO VERIFICADO: cobro real en app + E2E #1) |
| 2026-10-31 | E4-05 | DONE | Pausar/recuperar/descartar ventas con etiqueta (held_sales ya existente, sin BD) · acciones held-sales (6 tests) + 3 tests de componente · pnpm check verde |
| 2026-10-31 | E4-06 | DONE | Comprobante imprimible: getSaleTicketAction (venta+ítems+get_business_public) + TicketDialog con CSS print y botón Imprimir en confirmación · 6 tests acción + 3 componente · pnpm check verde |
