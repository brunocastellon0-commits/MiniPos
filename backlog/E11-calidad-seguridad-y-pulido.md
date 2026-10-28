# E11 — Calidad, seguridad y pulido

> Especificación de las tareas de esta épica. **El estado vive en `BACKLOG.md` (índice)**; la evidencia, en `backlog/PROGRESS.md`. Lee este archivo solo cuando trabajes en esta épica.

- **E11-01 · Revisión de RLS y permisos** · Deps: E0-05..E7 — tabla "operación × rol × política" en `docs/SECURITY.md`; matriz authz completa (cada acción × sin sesión/cajero/inactivo/dueño); pedir al humano ejecutar `docs/RLS_VERIFICATION.sql` y Security Advisor; proponer correcciones SQL con 🚨.
- **E11-08 · Auditoría y anti-fraude** · Deps: E4..E7 — `audit_log` para anulaciones, descuentos, ajustes, cambios de precio/costo, caja, usuarios/roles; umbral de descuento que exige dueño; vista de auditoría para el dueño; alertas por patrones (anulaciones/descuentos/diferencias repetidas). Tests: `security/audit-log.int.test.ts`.
- **E11-09 · Seguridad de importación/exportación** · Deps: E2-03, E9-05 — límites, validación, neutralización de fórmulas CSV. Tests: `security/csv-injection.unit.test.ts`.
- **E11-10 · Revisión final de seguridad contra `docs/SECURITY.md` y OWASP ASVS (nivel 1 aplicable)** · Deps: todas — checklist con evidencia por punto; fallos ⇒ tareas `SEC-xx`.
- **E11-11 · Plan de incidentes y respaldos** · Deps: E12-03 — `docs/INCIDENTES.md` (plantilla) y sección de respaldos/restauración en condiciones comerciales (decide el humano).
- **E11-02 · E2E Playwright completos** · Deps: E4..E7 — los 7 recorridos de `docs/TESTING.md`; documentar cómo preparar el proyecto Supabase de pruebas. Estado final: `DONE-PENDING-HUMAN-VERIFY`.
- **E11-03 · Estados y mensajes del plan §11** · Deps: E4..E8 — auditoría: completada, información faltante, sin resultados, agotado, error de registro, carrito vacío, venta pendiente, diferencia de caja, stock bajo. Cada uno con UI y test; estados no dependen solo del color.
- **E11-04 · Accesibilidad y teclado** · Deps: E4-02 — navegación por teclado, contraste AA, `aria-live` para totales y toasts.
- **E11-05 · Rendimiento** · Deps: E2-04 — paginación, índices propuestos vía 🚨, sin N+1; objetivo: agregar producto al carrito < 100 ms percibido.
- **E11-06 · Diseño adaptable (preparación futura)** · Deps: E4-02 — layout fluido; en < 1024 px el carrito pasa a panel inferior/drawer (sin entregarlo como móvil completo).
- **E11-07 · Manejo de errores global** · error boundaries, páginas 404/500, mensajes en español, sin filtrar errores de Postgres.
