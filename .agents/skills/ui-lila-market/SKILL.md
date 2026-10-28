---
name: ui-lila-market
description: Úsala al crear o modificar cualquier pantalla o componente visual de LILA MARKET. Define identidad visual, layouts de caja y panel, estados, accesibilidad y textos, basados en los mockups aprobados.
---

# ui-lila-market

## Identidad
- Nombre visible: **LILA MARKET** (nunca "Nexo"). Logo y nombre del negocio cliente vienen de `business_settings`; la marca LILA MARKET aparece en login y pie discreto.
- Referencia: los mockups tienen superficie clara, **verde oscuro** como color de estructura/acción principal (barra lateral, tarjeta destacada, botón Cobrar), acentos suaves y tarjetas con borde fino. Mantén esa jerarquía. Si el humano define una paleta lila/violeta propia de la marca, defínela como **tokens** (variables CSS) y úsala sin tocar componentes. Si no hay paleta definitiva, centraliza los colores en tokens para cambiarlos en un solo lugar.
- Tipografía sans moderna (Inter o equivalente). Números tabulares (`font-variant-numeric: tabular-nums`) para importes.
- No dashboards de tarjetas idénticas ni decoración vacía. Gráficos solo si ayudan (evolución de ventas 7 días).

## Layouts obligatorios
- **Cabecera:** logo + negocio, pestañas Caja / Panel del dueño (según rol), turno y hora, estado de caja (punto + texto "Caja abierta"), campana, usuario con rol.
- **Caja:** izquierda catálogo (eyebrow "PUNTO DE VENTA", título "Nueva venta", buscador con `F2`, chips de categoría, grilla de tarjetas con iniciales/imagen, "N disponibles", precio, botón Agregar); derecha carrito fijo (título, "N unidades · M productos", Vaciar, líneas con +/−/papelera, Subtotal, Agregar descuento, **Total** grande, botón **Cobrar** con `F9`). Botón "Pausar venta" arriba a la derecha del catálogo.
- **Panel dueño:** barra lateral (Operación: Resumen, Ir a Caja, Ventas · Gestión: Productos, Inventario con contador, Compras, Reportes · ayuda), saludo con fecha, tarjetas Ventas de hoy / Transacciones / Estado de caja, Evolución de ventas, Stock bajo con detalle accesible.

## Estados (todos con UI + test)
Cargando (skeleton), vacío (con acción sugerida), sin resultados, error (con reintento), éxito (toast/confirmación), agotado, stock bajo, carrito vacío, venta pendiente/pausada, diferencia de caja. **Cada estado combina color + ícono + texto**; nunca solo color.

## Accesibilidad
- Foco visible en todo elemento interactivo; orden de tabulación lógico; atajos documentados con `Kbd` y no intrusivos al escribir en inputs.
- Botones de solo ícono con `aria-label` ("Eliminar Coca-Cola del carrito").
- Contraste AA. Objetivos táctiles ≥ 40 px en la caja. Totales y toasts con `aria-live="polite"`.
- Respeta `prefers-reduced-motion`.

## Textos (español de Bolivia, tono claro y breve)
"Venta registrada", "No hay productos que coincidan", "Producto agotado", "No se pudo registrar la venta. Tu carrito sigue intacto; intenta de nuevo.", "Hay una diferencia de Bs X en la caja". Moneda `Bs 46,50`. Fechas "miércoles, 14 de agosto".

## Calidad visual
Espaciado en escala de 4 px, radios y sombras consistentes, componentes de `components/ui` reutilizados (no estilos ad hoc repetidos). Revisa en 1366×768 (laptop común en minimarkets) y 1920×1080. Layout fluido: sin anchos fijos que impidan adaptar a tablet.
