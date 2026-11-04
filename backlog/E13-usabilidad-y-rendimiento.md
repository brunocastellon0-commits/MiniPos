# E13 — Usabilidad y pulido (tareas de mejora)

> Especificación de las tareas de esta épica. **El estado vive en `BACKLOG.md` (índice)**; la evidencia, en `backlog/PROGRESS.md`. Lee este archivo solo cuando trabajes en esta épica.
> Fuente: `tareasmejora.md` (plan de mejora pedido por el humano). Orden de ejecución: A1 → A2+B4 → A3 → B1 → B2 → B3.

**Decisiones del humano (no reinterpretar):**
- **A3 logo:** solo UI — sin migración; la columna `business_settings.logo_url` se queda en BD como dato sin uso.
- **B1.2 apellidos:** no desglosar — se mantiene `full_name` (usuarios) y `name` (proveedores); solo mejorar etiquetas.
- **B2 idempotencia:** solo UI — no se agregan claves de idempotencia a compras/ajustes/cierres (ya existe `client_request_id` en ventas).

- **E13-01 · A1 — Inputs que pierden el foco** · Deps: — — bug crítico: escribir en un diálogo dentro de un panel deja un solo carácter. Causa: `src/components/ui/dialog.tsx` re-ejecuta el focus-trap porque `onClose` cambia de identidad en cada tecla. Fix central en el `Dialog` + refuerzo donde haga falta. Tests: conservar foco y valor al re-renderizar el padre.
- **E13-02 · A2 — Rendimiento al cambiar de vista** · Deps: — — `<Link>` en vez de `router.push` para CTAs; quitar `"use client"` innecesario; paralelizar awaits secuenciales del shell; límite por defecto + "cargar más" en `/ventas`; spinner → skeleton en refrescos. Sin cambios de BD.
- **E13-03 · B4 — Skeletons y `loading.tsx`** · Deps: E13-02 — `components/ui/skeleton.tsx` compartido; `loading.tsx` en las rutas que faltan (17); dimensiones iguales al contenido final; `animate-pulse` respetando `prefers-reduced-motion`.
- **E13-04 · A3 — Logo estático desde `public/`** · Deps: — — renombrar la imagen a `public/logo.png`, constante `LOGO_SRC`; quitar los inputs de configuración y asistente; quitar `logoUrl` del schema `.strict()` y de `EDITABLE_KEYS`; dejar de leerlo en login/layout/header. Sin migración.
- **E13-05 · B1 — Formularios: etiquetas y errores por campo** · Deps: — — componente `components/ui/form-field.tsx` (label visible + ayuda + error debajo + `aria-*`); migrar formularios con error genérico arriba; `aria-label` en búsquedas sin etiqueta. Sin desglosar apellidos.
- **E13-06 · B2 — Botones de acción con candado** · Deps: — — candado `useRef` + estados `idle|loading|success|error` en el cobro y en los botones críticos (compra, recepción, ajuste, cierre, movimiento, anulación); confirmación "Pago completado". Idempotencia ya cubierta en ventas.
- **E13-07 · B3 — Tablas y métricas más limpias** · Deps: — — `components/ui/table.tsx` (`Table/Th/Td` sin bordes verticales) aplicado a las vistas; `components/ui/progress-bar.tsx` (4–6 px con valor numérico) en panel y reportes; menos bordes en las tarjetas de métricas.
