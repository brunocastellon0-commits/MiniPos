# BACKLOG.md — ÍNDICE (LILA MARKET)

> **Único lugar donde vive el ESTADO de cada tarea.** Es corto a propósito: léelo entero, y abre **solo** el archivo de la épica de la tarea que vas a ejecutar.
> Detalle de cada tarea (aceptación y tests): `backlog/<épica>.md` · Evidencia y bitácora: `backlog/PROGRESS.md` (solo añadir al final; lee únicamente las últimas ~15 líneas).
> Proceso: `.agents/skills/backlog-workflow/SKILL.md`.

**Estados:** `TODO` · `DOING` · `BLOCKED-DB` · `DONE-PENDING-HUMAN-VERIFY` · `DONE` · `CANCELLED`
**🚨** = la tarea requiere cambio de BD (migración + `DB_REQUESTS.md`). Orden de la tabla = prioridad. Las épicas E0→E4 son la columna vertebral; no saltar a E8/E9 antes.
**Para cambiar estado:** edita solo la celda de estado de la fila (no reescribas el archivo). Al cerrar, añade una línea a `backlog/PROGRESS.md`.

## Decisiones por defecto (el humano puede cambiarlas; el agente NO las reinterpreta)

| ID | Decisión | Valor por defecto |
|---|---|---|
| D-001 | Modelo de entrega | Una instalación y un proyecto Supabase por cliente (single-tenant) |
| D-002 | Venta con stock insuficiente | **Bloqueada**; configurable por `business_settings.allow_negative_stock` (default false) |
| D-003 | Métodos de pago v1 | Efectivo, QR, tarjeta: solo registro, sin integración |
| D-004 | Comprobante | Pantalla de confirmación + impresión simple del navegador. Sin impresora térmica ni facturación electrónica en v1 |
| D-005 | Anulaciones | Solo dueño; exige motivo; revierte stock y caja; conserva historial |
| D-006 | Respaldos | Los define el humano por cliente (ver DEPLOY_NEW_CLIENT). El agente documenta, no implementa |
| D-007 | Lector de barras | Se asume lector tipo teclado (escribe + Enter) |
| D-008 | Descuentos | Monto o porcentaje por venta, solo si el rol lo permite (dueño siempre; cajero según configuración) |
| D-009 | Alta de usuarios | Sin service_role en la app: el humano crea el usuario en Auth; la app asigna rol/perfil (ver E1-04) |
| D-010 | Zona horaria / moneda | America/La_Paz · BOB (`Bs`), formato `Bs 1.234,50` |
| D-011 | Seguridad | Nada a `anon`; MFA recomendado al dueño; inactividad 15 min; descuento sobre umbral exige dueño; ver `docs/SECURITY.md` |

---

## E0 — Fundación  ·  [backlog/E0-fundacion.md](backlog/E0-fundacion.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E0-01 | Crear proyecto Next.js 16 + TS estricto + Tailwind + pnpm | — |  | TODO |
| E0-02 | Tooling de calidad | E0-01 |  | TODO |
| E0-03 | Sistema de diseño LILA MARKET | E0-01 |  | TODO |
| E0-04 | Utilidades de dinero y fecha | E0-02 |  | TODO |
| E0-05 | Esquema de BD baseline (migraciones) | E0-01 | 🚨 | TODO |
| E0-06 | Clientes Supabase y proxy | E0-01 |  | TODO |
| E0-07 | Capa de repositorios | E0-05 (tipos) |  | TODO |
| E0-08 | Factories y datos demo en memoria | E0-07 |  | TODO |
| E0-09 | CI local y documentación de desarrollo | E0-02 |  | TODO |
| E0-10 | Cabeceras de seguridad y CSP | E0-01 |  | TODO |
| E0-11 | Higiene de dependencias y secretos | E0-02 |  | TODO |
| E0-12 | Capa común de acciones seguras | E0-06 |  | TODO |

## E1 — Autenticación y roles  ·  [backlog/E1-autenticacion-y-roles.md](backlog/E1-autenticacion-y-roles.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E1-01 | Pantalla de login | E0-03, E0-06 |  | TODO |
| E1-02 | Sesión, `getCurrentUser`, `requireRole` | E0-07 |  | TODO |
| E1-03 | Layout autenticado con navegación por rol | E1-02, E0-03 |  | TODO |
| E1-05 | Endurecimiento de sesión y login | E1-01, E0-12 |  | TODO |
| E1-06 | MFA (TOTP) para el dueño | E1-05 |  | TODO |
| E1-04 | Gestión de usuarios (dueño) | E1-03 | 🚨 | TODO |

## E2 — Catálogo  ·  [backlog/E2-catalogo.md](backlog/E2-catalogo.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E2-01 | Categorías (CRUD) | E1-03 |  | TODO |
| E2-02 | Productos (CRUD) | E2-01 |  | TODO |
| E2-03 | Importar productos desde CSV | E2-02 |  | TODO |
| E2-04 | Búsqueda de producto para POS | E2-02 |  | TODO |

## E3 — Turno de caja (precondición de vender)  ·  [backlog/E3-turno-de-caja-precondicion-de-vender.md](backlog/E3-turno-de-caja-precondicion-de-vender.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E3-01 | Apertura de turno | E1-03, E0-05 aplicada | 🚨 | TODO |
| E3-02 | Movimientos de efectivo (ingresos/egresos) | E3-01 |  | TODO |
| E3-03 | Cálculo de efectivo esperado (dominio) | E0-04 |  | TODO |
| E3-04 | Cierre de turno | E3-01..03 |  | TODO |
| E3-05 | Historial de turnos | E3-04 |  | TODO |

## E4 — Caja / POS (prioridad máxima)  ·  [backlog/E4-caja-pos-prioridad-maxima.md](backlog/E4-caja-pos-prioridad-maxima.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E4-01 | Dominio del carrito | E0-04 |  | TODO |
| E4-02 | UI de Caja (catálogo izquierda, carrito derecha) | E4-01, E2-04, E3-01 |  | TODO |
| E4-03 | Escaneo de código de barras | E4-02 |  | TODO |
| E4-04 | Cobro y confirmación atómica | E4-02, E0-05 aplicada | 🚨 | TODO |
| E4-05 | Pausar y recuperar ventas | E4-02 |  | TODO |
| E4-06 | Comprobante imprimible | E4-04 |  | TODO |
| E4-07 | Descuentos autorizados | E4-04 |  | TODO |

## E5 — Historial de ventas y anulaciones  ·  [backlog/E5-historial-de-ventas-y-anulaciones.md](backlog/E5-historial-de-ventas-y-anulaciones.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E5-01 | Listado y detalle de ventas | E4-04 |  | TODO |
| E5-02 | Anular venta (dueño) | E5-01 | 🚨 | TODO |

## E6 — Inventario  ·  [backlog/E6-inventario.md](backlog/E6-inventario.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E6-01 | Vista de inventario | E2-02 |  | TODO |
| E6-02 | Ajustes y mermas | E6-01 | 🚨 | TODO |
| E6-03 | Historial de movimientos | E6-01 |  | TODO |
| E6-04 | Alertas de stock bajo (dominio + UI) | E6-01 |  | TODO |

## E7 — Compras y proveedores  ·  [backlog/E7-compras-y-proveedores.md](backlog/E7-compras-y-proveedores.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E7-01 | Proveedores (CRUD) | E1-03 |  | TODO |
| E7-02 | Registrar compra/pedido | E7-01, E2-02 |  | TODO |
| E7-03 | Recepción (total/parcial) | E7-02 | 🚨 | TODO |
| E7-04 | Historial de compras y atajo desde stock bajo | E7-03, E6-04 |  | TODO |

## E8 — Panel del dueño  ·  [backlog/E8-panel-del-dueno.md](backlog/E8-panel-del-dueno.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E8-01 | Dominio de métricas del día | E5-01 |  | TODO |
| E8-02 | UI del panel | E8-01, E3-01, E6-04 |  | TODO |
| E8-03 | Notificaciones (campana) | E8-02 |  | TODO |

## E9 — Reportes (dueño)  ·  [backlog/E9-reportes-dueno.md](backlog/E9-reportes-dueno.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E9-01 | Ventas por día/periodo con comparación | E5-01 |  | TODO |
| E9-02 | Productos más y menos vendidos | E9-01 |  | TODO |
| E9-03 | Reporte de inventario y valorización | E6-01 |  | TODO |
| E9-04 | Reporte de caja y de compras | E3-05, E7-04 |  | TODO |
| E9-05 | Exportar a CSV | E9-01 |  | TODO |

## E10 — Configuración  ·  [backlog/E10-configuracion.md](backlog/E10-configuracion.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E10-01 | Datos del negocio y marca | E1-03 |  | TODO |
| E10-02 | Preferencias de operación | E10-01 |  | TODO |
| E10-03 | Asistente de configuración inicial (onboarding) | E10-01, E2-03 |  | TODO |

## E11 — Calidad, seguridad y pulido  ·  [backlog/E11-calidad-seguridad-y-pulido.md](backlog/E11-calidad-seguridad-y-pulido.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E11-01 | Revisión de RLS y permisos | E0-05..E7 |  | TODO |
| E11-08 | Auditoría y anti-fraude | E4..E7 |  | TODO |
| E11-09 | Seguridad de importación/exportación | E2-03, E9-05 |  | TODO |
| E11-10 | Revisión final de seguridad contra `docs/SECURITY.md` y OWASP ASVS (nivel 1 aplicable) | todas |  | TODO |
| E11-11 | Plan de incidentes y respaldos | E12-03 |  | TODO |
| E11-02 | E2E Playwright completos | E4..E7 |  | TODO |
| E11-03 | Estados y mensajes del plan §11 | E4..E8 |  | TODO |
| E11-04 | Accesibilidad y teclado | E4-02 |  | TODO |
| E11-05 | Rendimiento | E2-04 |  | TODO |
| E11-06 | Diseño adaptable (preparación futura) | E4-02 |  | TODO |
| E11-07 | Manejo de errores global | — |  | TODO |

## E12 — Entrega y reventa  ·  [backlog/E12-entrega-y-reventa.md](backlog/E12-entrega-y-reventa.md)

| ID | Tarea | Deps | BD | Estado |
|---|---|---|---|---|
| E12-01 | `db/schema.sql` consolidado + `create_first_owner.sql` + `seed_demo.sql` | — |  | TODO |
| E12-02 | `docs/MANUAL_USUARIO.md` | — |  | TODO |
| E12-03 | `docs/CONDICIONES_COMERCIALES.md` | — |  | TODO |
| E12-04 | Modo demostración | E0-08 |  | TODO |
| E12-05 | Versionado y changelog | — |  | TODO |
| E12-06 | Verificación final contra el plan §15 | — |  | TODO |
