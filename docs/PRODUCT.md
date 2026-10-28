# PRODUCT.md — Resumen funcional de LILA MARKET

> El plan completo está en `docs/PLAN_ORIGINAL.md` (pegar ahí el texto íntegro del plan; ahí el nombre "Nexo" debe leerse como **LILA MARKET**).
> Este resumen es la referencia rápida. Ante contradicción, manda el plan original, salvo que `BACKLOG.md` (sección Decisiones) diga otra cosa.

## Usuarios

- **Dueño (owner):** supervisa el negocio. Panel, productos, inventario, compras, reportes, usuarios, configuración, anulaciones.
- **Cajero (cashier):** vende. Pantalla de caja, su turno, ventas pausadas, consulta de precio/stock. Nada administrativo.

## Módulos (alcance v1)

1. Acceso diferenciado por rol.
2. Caja/POS: buscar por nombre o código de barras, carrito siempre visible, +/−/eliminar, descuento autorizado, método de pago (efectivo/QR/tarjeta — solo **registro**, sin integraciones reales), confirmar, pausar/recuperar venta, atajos F2 (buscar) y F9 (cobrar).
3. Productos y categorías.
4. Inventario: entradas, salidas por venta, ajustes con motivo, mermas, historial, stock bajo.
5. Compras y proveedores: pedido vs. recibido; el stock sube solo con lo recibido.
6. Turno de caja: apertura, movimientos, cierre con efectivo contado y diferencia.
7. Historial de ventas, con anulación controlada.
8. Panel del dueño: ventas del día, transacciones, ticket promedio, estado de caja, stock bajo (con acceso al detalle), actividad reciente, gráfico de 7 días.
9. Reportes: ventas por periodo, productos más/menos vendidos, stock, caja, compras, comparación de periodos.
10. Configuración y usuarios.

## Fuera de alcance v1

Sucursales, fidelización, promociones complejas, facturación electrónica, contabilidad completa, apps móviles nativas, integraciones de pago reales.
No agregues funciones "para que se vea más grande".

## Diseño

Referencia visual: mockups de Figma (caja con catálogo a la izquierda y carrito a la derecha; panel con barra lateral verde oscuro).
Identidad **LILA MARKET** (ver skill `ui-lila-market`). Debe verse profesional y legible. Escritorio primero; no bloquear una futura versión tablet/móvil (layout fluido, sin anchos rígidos).
