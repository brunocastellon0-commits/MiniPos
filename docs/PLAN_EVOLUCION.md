# PLAN — Evolución integral de LILA MARKET

> Fuente: solicitud del humano (2026-11-05). Este documento es el plan de ejecución y control de avance.
> **Fuera del alcance (decisiones del humano):** recuperación de cuentas · recetas/food cost · mesas · vencimientos (`expiry_date`) · proveedores sin cambios de BD · reportes solo "cuándo y qué vendemos".

## Estado de Avance (Actualizado 2026-11-06)

- [x] **Fase A — BD y Repositorios**: COMPLETADA
  - Migración `0020_operating_mode_orders.sql` aplicada en Supabase por el humano.
  - `DB_REQUESTS.md` actualizado con DB-013 como `APLICADA`.
  - Tipos actualizados en `src/types/database.ts` (`business_settings`, `orders`, `order_items`, `Functions`, `Enums`).
  - Interfaz y tipos de `OrdersRepo` en `src/lib/repos/types.ts`.
  - Repositorio en memoria `MemoryOrdersRepo` en `src/lib/repos/memory/orders.ts`.
  - Repositorio Supabase `SupabaseOrdersRepo` en `src/lib/repos/supabase/orders.ts`.
  - Repositorios cableados en `memory/index.ts` y `supabase/index.ts`.
- [x] **Fase B — Diseño base y Componentes UI**: COMPLETADA
  - Escala tipográfica y tokens en `globals.css` (`heading-page`, `heading-section`, `text-body`, `text-meta`, tokens de sombra y radio).
  - Componentes primitivos creados: `Select`, `Textarea`, `DateRangeFilter`, `ExpandableRow`.
  - Header (`app-header.tsx`) actualizado: logo directo sin caja de fondo, badge compacto de caja abierta junto al usuario, notificaciones con hover diferido y anclaje por clic/Esc.
  - Modales unificados: `movement-dialog.tsx` migrado a `FormField` + `Select`; `adjust-stock-button.tsx` (D6) con 4 opciones visuales, chips y stock resultante en vivo.
- [x] **Fase C — Rendimiento y navegación**: COMPLETADA
  - `React.cache()` implementado en `getBusinessPublicAction`, `getOpenCashSessionAction`, `listCashSessionsAction`, `countLowStockAction`.
  - `experimental.staleTimes.dynamic: 30` configurado en `next.config.ts`.
  - `revalidatePath` incorporado en Server Actions (`sales.ts`, `cash.ts`, `inventory.ts`, `settings.ts`).
  - Dobles fetch eliminados con `Promise.all` en `reports-core.ts`, `audit-core.ts` y `compras/[id]/page.tsx`.
  - Búsqueda POS optimizada con filtrado instantáneo en cliente sobre `initialProducts` (evita peticiones al servidor en cada pulsación).
- [x] **Fase D — Módulos visuales**: COMPLETADA (9 de 9)
  - [x] **D1 (Turnos)**: `getCashSessionDetailAction` implementada y `session-history.tsx` con filas desplegables `ExpandableRow` con desglose financiero.
  - [x] **D2 (Fechas)**: `DateRangeFilter` integrado en `sales-history.tsx`.
  - [x] **D3 (Ventas)**: Filas desplegables en `sales-history.tsx` con consulta bajo demanda de ítems congelados.
  - [x] **D4 (Compras)**: contadores por estado con filtro, fila desplegable `ExpandableRow` (ítems, notas, Recibir/Cancelar inline, línea de tiempo desde `audit_log` con usuario), nuevas acciones `cancelPurchaseAction`/`registerPurchaseVisitAction`/`getPurchaseTimelineAction` auditadas y sección independiente de Proveedores (`purchases-view.tsx`).
  - [x] **D5 (Categorías)**: Número de orden visible por fila y botones de mover en `categories-panel.tsx`.
  - [x] **D6 (Ajuste inventario)**: Modal rediseñado con 4 variantes visuales (Entrada, Salida, Merma, Corrección) y stock en vivo.
  - [x] **D7 (Panel del dueño)**: "Accesos directos" eliminado; tarjeta "Comparativa de ventas" hoy/ayer/semana pasada con % de variación (`buildPanelComparison`); gráfico CSS puro existente conservado; top productos, ingresos/egresos del día (`getPanelInsightsAction` + `summarizeDayMovements`) y margen bruto estimado solo con costos completos (`estimateGrossMargin`, tarjeta oculta si falta algún costo, sin la palabra "ganancia").
  - [x] **D8 (Productos)**: Eliminada "Unidad de venta" del formulario; escáner de cámara nativo `barcode-camera-scanner.tsx` integrado; `camera=(self)` en `next.config.ts` y `headers.test.ts`.
  - [x] **D9 (Notificaciones)**: Panel con hover delay + clic de fijación implementado en `app-header.tsx`.
- [x] **Fase E — Configuración + Modo restaurante**: COMPLETADA
  - [x] **E1 (Configuración)**: +3 campos en `settings-schema.ts`/`settings-core.ts` (`operating_mode`, `enable_held_sales`, `order_charge_timing`), controles en `business-settings-view.tsx` (Modalidad, Ventas pausadas, Momento de cobro solo en restaurante) y payload +3 en `onboarding-wizard.tsx`.
  - [x] **E2 (Dominio)**: `src/lib/domain/orders.ts` con cadena de estados, `canTransitionOrder` e `isOrderChargeable`.
  - [x] **E3 (Acciones pedidos)**: `orders-schema.ts`/`orders-core.ts`/`orders.ts` — crear (valida restaurante + sesión + efectivo en `on_order`), listar con ítems y nombres de cajero, detalle con `createdByName`, cambio de estado auditado y cobro idempotente; rate limits dedicados.
  - [x] **E4 (Tablero)**: `orders-view.tsx` con 4 columnas + Cancelados, tarjetas enlazando a `/caja/pedido/[id]`, estados vacío/error; `order-badges.tsx` con etiquetas/tonos.
  - [x] **E5 (Nuevo pedido)**: rutas `/caja/nuevo` y `/caja/pedido/[id]`, `new-order-view.tsx` (carrito con dominio `cart.ts`, búsqueda con Enter por código, notas) y `payment-method-dialog.tsx` reutilizable.
  - [x] **E6 (Detalle)**: `order-detail.tsx` con flujo paso a paso, cobro (diálogo), avance y cancelación con motivo; muestra "Pedido cobrado" con enlace a la venta.
  - [x] **E7 (Integración)**: `/caja` bifurcado por `operating_mode` (+`?vista=pos` para venta directa), nav "Caja"→"Pedidos" en restaurante (`getNavGroupsForRole`), `enableHeldSales` oculta solo "Pausar venta" en el POS.
- [ ] **Fase F — Reportes reestructurados**: PENDIENTE
  - Pestañas compartidas, micromarket y restaurante en `reports-view.tsx`.
- [ ] **Fase G — Verificación y Tests**: PENDIENTE (el agente ejecuta `pnpm check` y los tests al cierre).

---

## Fase A — BD (1 sola migración, 🚨 DB-013)

Archivo: `db/migrations/0020_operating_mode_orders.sql`

1. **`business_settings` +3 columnas** (los defaults preservan el comportamiento actual):
   - `operating_mode text not null default 'micromarket' check in ('micromarket','restaurant')`
   - `enable_held_sales boolean not null default true`
   - `order_charge_timing text not null default 'on_order' check in ('on_order','on_consumption')`
   - Recrear `get_business_public()` exponiéndolas (mismo patrón que 0012/0019: drop + create idempotente).
2. **Tablas `orders` + `order_items`** (estilo `sales`/`sale_items`):
   - `orders`: `id`, `order_number`, `session_id`, `created_by`, `status` (`pendiente|en_preparacion|listo|entregado|cancelado`), `payment_status` (`pendiente|pagado`), `sale_id` nullable, `subtotal_cents`, `discount_cents`, `total_cents`, `notes`, `created_at`, `updated_at`, timestamps de estado (`preparing_at`, `ready_at`, `delivered_at`) para tiempos.
   - `order_items`: `order_id`, `product_id`, `name_snapshot`, `unit_price_cents`, `quantity`, `line_total_cents` (precio congelado).
   - RLS: owner + cashier (lectura/escritura); sin DELETE (cancelación por estado). Grants mínimos explícitos. Índices en `status`, `payment_status`, `created_at`.
3. **RPCs** (security definer, `search_path=''`, con auditoría):
   - `create_order(...)` — pedido + ítems en una sola transacción.
   - `charge_order(...)` — envuelve `confirm_sale` existente (stock + caja + venta) y marca `payment_status='pagado'` + `sale_id`. **El stock baja solo al cobrar** (nunca al crear el pedido → sin doble descuento ni ingresos anticipados).
   - Cambios de estado del pedido = updates simples vía Server Action con RLS (tabla única, sin RPC).

Registro en `DB_REQUESTS.md` (entrada `PENDIENTE` DB-013) + aviso `🚨` al humano.
Tipos en `src/types/database.ts` + interfaz `OrdersRepo` (impl Supabase + memoria + test de contrato).

---

## Fase B — Diseño base

- **`globals.css`**: escala tipográfica completa (título de página, título de sección, cuerpo, meta; pesos; jerarquía) + tokens de sombra/radio unificados. Sin dependencias nuevas. Inter + `tabular-nums` ya existentes: conservar.
- **Primitivos nuevos en `components/ui`** (con tests):
  - `Select` y `Textarea` estilizados (hoy es markup crudo repetido).
  - `DateRangeFilter`: etiquetas "Desde/Hasta" + presets (Hoy, 7 días, 30 días, Mes), una sola línea compacta.
  - `ExpandableRow`: fila con chevron + panel desplegable, `aria-expanded`, teclado accesible.
- **Header** (`app-header.tsx`):
  - Eliminar el pill central de caja abierta/cerrada → estado de caja pasa a badge compacto junto a Turno/usuario (solo visible si hay turno, sin texto largo).
  - **Logo**: quitar el recuadro `bg-primary/10 rounded-lg`; usar `logo.png` (2172×724, ya horizontal) con `h-7 w-auto` directo sobre el blanco del header.
- **Modales/formularios**: patrón único de composición (encabezado → fieldsets/grillas de 2 columnas → footer) siguiendo el mejor actual (`product-form-dialog`); migrar los peores (`movement-dialog`, `adjust-stock`, `category-form`, dialogs de usuarios) a `FormField` + agrupaciones. Unificar tablas/badges/botones en todos los módulos.

---

## Fase C — Rendimiento y navegación

- **`React.cache()`** en `getBusinessPublicAction`, `getOpenCashSessionAction`, `listCashSessionsAction`, `countLowStockAction` → elimina duplicados layout↔página (panel, turno, caja, productos).
- **`<Suspense>` en `(app)/layout.tsx`** alrededor de notificaciones/stock bajo → el shell (header/sidebar) entra de inmediato sin esperar las 4 queries.
- **`revalidatePath` en las actions** (venta, cierre, ajuste, recepción, settings…) reemplazando los `router.refresh()` sueltos; invalidar `/caja`, `/panel`, `/turno`, `/ventas` según corresponda.
- **`experimental.staleTimes.dynamic: 30`** en `next.config.ts` → navegación prácticamente instantánea (el router reutiliza el RSC; las mutaciones lo invalidan vía `revalidatePath`). *Verificar en dev + `pnpm check`.*
- **Dobles fetch corregidos**: `reports-core` (lista de ventas cargada 2×), `audit-core` (bitácora 2× + serial), `compras/[id]` secuencial → `Promise.all`.
- **`countLowStock`** → COUNT real en repo (hoy baja todas las filas y cuenta en JS).
- **Búsqueda POS**: filtrar en cliente sobre `initialProducts` ya cargado (elimina una action por tecla); la action queda solo para el Enter de escáner.
- **Notificaciones/header dinámico**: `router.refresh()` en intervalo ligero (~90 s) + tras cada mutación relevante (con `revalidatePath`). Sin realtime, sin dependencias nuevas.

---

## Fase D — Módulos (visual, cero BD)

| # | Qué | Cómo |
|---|---|---|
| D1 | **Turnos**: vista completa | Acción nueva `getCashSessionDetail(sessionId)` (lee lo que RLS ya permite: sesión + movimientos + ventas + usuarios). Historial gana columna Usuario y **fila desplegable** con grid organizado: Apertura/Cierre · Montos (inicial, ingresos por ventas, egresos, efectivo esperado, declarado, diferencia) · Movimientos · Estado |
| D2 | **Fechas** | `DateRangeFilter` sustituye los dos `Input type="date"` largos en Reportes y Ventas |
| D3 | **Ventas desplegables** | En `/ventas`, cada fila se despliega → `getSaleDetailAction` bajo demanda (productos, cantidades, precios, descuentos, total, método de pago, cajero). `/ventas/[id]` sigue existiendo (no se rompe nada) |
| D4 | **Compras = seguimiento** | Ver sección **D4 — Compras (Seguimiento)** debajo de la tabla |
| D5 | **Categorías** | Orden comprensible: número de orden visible por fila, campo "Orden" editable en el form, orden alfabético como default al crear, botones ↑↓ conservados. Cero BD; sirve para micromarket y restaurante |
| D6 | **Ajuste de inventario** | Modal rediseñado: card de producto + stock actual, **tipo de movimiento en 4 opciones visuales** (Entrada · Salida · Merma · Corrección con colores/íconos distintos; mapean a los `kind` existentes `adjustment`/`waste` con el signo, sin tocar BD), cantidad siempre positiva dirigida por el tipo, **stock resultante en vivo antes de confirmar**, motivo con chips predefinidos (dañado/vencido/robo/otro/corrección), observaciones. Auditoría existente intacta |
| D7 | **Panel del dueño** | Ver sección **D7 — Panel del Dueño (Vista Ejecutiva)** debajo de la tabla |
| D8 | **Productos** | Quitar campo "Unidad de venta" del form (columna BD queda con default `'unidad'`, sin migración; CSV se mantiene). **Escáner de cámara**: botón "Escanear código" explícito → `getUserMedia` + API `BarcodeDetector` (nativo, sin dependencias) con fallback a entrada manual si el navegador no la soporta; responsive. **Requiere cambiar `Permissions-Policy: camera=()` → `camera=(self)`** en `next.config.ts` + `proxy.ts`, actualizar `headers.test.ts` y `docs/SECURITY.md` |
| D9 | **Notificaciones** | Comportamiento del panel: hover abre (con delay de salida), si el cursor sale sin interactuar se cierra; **clic fija el panel** (no se cierra al salir), clic nuevo o botón/Esc lo cierran; en táctil solo clic. Accesibilidad `aria-expanded`/`aria-controls` conservada |

### D4 — Compras (Seguimiento) — cero BD

- **Contadores de compras por estado** en la cabecera de la vista: Pendientes · Parciales · Recibidas · Canceladas (clic en el contador filtra la lista).
- **Fila desplegable en el listado** (`ExpandableRow`): ítems con cantidad ordenada/recebida y costo, totales, proveedor, notas, y **acciones directas inline** — Recibir (abre el flujo de recepción existente) y Cancelar — sin salir del listado.
- **Historial de seguimiento** de cada compra leído desde `audit_log` (visitas del preventista, recepciones, cancelaciones, cambios de nota), mostrado dentro de la fila desplegable como línea de tiempo.
- **Acceso visual destacado e independiente para Proveedores**: entrada propia en el menú lateral con jerarquía propia; en la vista de Compras no es un botón hermano de "Nueva compra" sino un link secundario en su propia sección.
- Proveedor selector destacado en Nueva compra. Observaciones en el campo `notes` existente.

### D7 — Panel del Dueño (Vista Ejecutiva) — cero BD

- **Quitar el bloque "Accesos directos"** por completo.
- **Comparativa de ventas**: Hoy vs. Ayer vs. Mismo día de la semana pasada (tarjetas con % de variación).
- **Gráfico CSS/SVG puro** de evolución de ventas (sin dependencias de charting).
- **Margen bruto estimado**: tarjeta visible **solo si hay costos registrados**, con nota del método; nunca titulada "ganancia".
- Complementos: ingresos/egresos del día, estado de caja, ticket promedio, top productos vendidos, stock crítico, actividad reciente. Detalle fino se queda en Reportes. Ampliar `domain/dashboard.ts` (puro).

---

## Fase E — Configuración + Modo restaurante

### Pantalla de Configuración (`business-settings-view`)

3 controles nuevos en la tarjeta "Preferencias de operación" (`settings-schema` + `EDITABLE_KEYS` + `BusinessPublicSettings` + `get_business_public()` ya expuesto desde DB-013):

1. **Selector de Modalidad**: Micromarket vs. Restaurante.
2. **Interruptor "Permitir ventas pausadas"**: si se desactiva, el botón "Pausar venta" y su diálogo desaparecen del POS (no interfieren en la experiencia de venta).
3. **Selector de "Momento de cobro"**: Al crear el pedido vs. Al finalizar el consumo — visible solo en modo restaurante.

### Bifurcación de Caja (`/caja`)

- Si `operating_mode='restaurant'`, `/caja` renderiza la vista de pedidos (`OrdersView`); si es micromarket, el POS actual (`PosClient`).
- En restaurante queda un acceso secundario a "Venta directa" (POS tradicional; los productos siguen funcionando igual).
- **El menú lateral cambia el texto "Caja" por "Pedidos" automáticamente** según la modalidad (misma ruta, sin romper nada).

### Rutas de Pedidos (Modo Restaurante) — sin modal

- **`/caja`**: tablero de pedidos con estados (Pendiente → En preparación → Listo → Entregado), cada tarjeta/fila con número, fecha/hora, usuario responsable, productos y cantidades, precios y total, estado y estado de pago.
- **`/caja/nuevo`**: pantalla de creación/edición de pedido — catálogo con buscador + lista, modificar cantidades, notas, visualización del total. Queda claro cuándo se consulta el listado y cuándo se trabaja dentro de un pedido (encabezado/breadcrumb).
- **`/caja/pedido/[id]`**: detalle, cambio de estados y botón de cobro (usando la RPC `charge_order` ya aplicada).
- Estados del pedido: pendiente → en_preparación → listo → entregado → cobrado; cancelado en cualquier momento previo al cobro.

### Cobro

- `on_order` → al crear el pedido llama a `charge_order` (stock + caja + venta en una transacción).
- `on_consumption` → el pedido queda `payment_status=pendiente` hasta el botón "Cobrar".
- Un pedido ≠ venta pausada (entidades y procesos distintos). **Stock baja solo al cobrar**: nunca dos veces, nunca ingresos antes de recibir el pago.

---

## Fase F — Reportes reestructurados

**`DateRangeFilter` integrado en la vista de reportes** (filtro temporal claro para todos los reportes). Gráficos CSS/SVG propios sin dependencias. Pestañas filtradas por modalidad:

- **Pestaña Compartida**:
  - Flujo de caja diario y mensual (ingresos reales, egresos, disponibilidad).
  - Ventas por hora y día de la semana (horas pico y horas muertas).
  - Mermas y desperdicios valorizados.
- **Pestaña Micromarket**:
  - Rotación de inventario y quiebres de stock (días en cero).
- **Pestaña Restaurante**:
  - Matriz BCG de platos/productos (estrella, vaca, perro, enigma según volumen × margen).
  - Nada de food cost, mesas ni tiempos de preparación (sin datos registrados).
- Indicadores + tablas donde aporten valor. **Nada de métricas inventadas.**

---

## Fase G — Verificación Final y Tests

> Los tests nuevos y ajustes los ejecuta **el agente** al final de la implementación (el humano no los corre).

1. `pnpm check` en verde (typecheck + lint + tests + security + build).
2. Tests nuevos por fase:
   - Primitivos UI (`Select`, `Textarea`, `DateRangeFilter`, `ExpandableRow`).
   - Detail de turno, fila desplegable de venta/compra.
   - Ajuste de inventario con stock resultante en vivo.
   - Settings nuevos (modalidad, pausar ventas, momento de cobro).
   - `OrdersRepo` (contrato) + `create_order`/`charge_order` con repos en memoria.
   - Bifurcación caja/pedidos por modalidad.
   - Escáner con mock de `BarcodeDetector`.
   - Panel de notificaciones (hover/clic/fijado).
3. Actualizar tests existentes que cambien (headers camera, product form, nav, pos-client).
4. Comprobar ambos modos:
   - **Micromarket**: flujo completo caja → venta → turno → reportes.
   - **Restaurante**: pedido → estados → cobro → stock + caja descontados una sola vez.

---

## Entregables pendientes para el humano

- 1 aviso `🚨` (migración DB-013) + `DB_REQUESTS.md` actualizado.
- Aplicar el SQL en Supabase y responder `APLICADA DB-013`.

## Restricciones de ejecución

- Sin dependencias nuevas.
- Sin romper rutas, contratos API ni permisos.
- Auditoría y trazabilidad intactas.
- Dinero siempre en centavos enteros.
- Textos en español (Bolivia).