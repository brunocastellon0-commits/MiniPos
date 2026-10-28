# E4 — Caja / POS (prioridad máxima)

> Especificación de las tareas de esta épica. **El estado vive en `BACKLOG.md` (índice)**; la evidencia, en `backlog/PROGRESS.md`. Lee este archivo solo cuando trabajes en esta épica.

- **E4-01 · Dominio del carrito** · Deps: E0-04 · DB: no
  Aceptación: funciones puras: agregar (si existe incrementa), cambiar cantidad, eliminar, vaciar, subtotal, descuento (monto/%), total, validación contra stock según D-002.
  Tests: unit exhaustivos (cantidad 0, negativa, descuento > subtotal, redondeos).
- **E4-02 · UI de Caja (catálogo izquierda, carrito derecha)** · Deps: E4-01, E2-04, E3-01 · DB: no
  Aceptación: replica la estructura de los mockups: título "Nueva venta", buscador con F2, chips de categorías, tarjetas de producto con disponibilidad y botón Agregar, panel Carrito con unidades/productos, +/−, papelera, Vaciar, Subtotal, "Agregar descuento", Total grande, botón **Cobrar** con F9. Carrito visible mientras se busca. Sin turno abierto → mensaje y acceso a abrir turno.
  Estados: carrito vacío, sin resultados, producto agotado (no agregable), stock bajo.
  Tests: componentes (todas las operaciones del carrito); atajos.
- **E4-03 · Escaneo de código de barras** · Deps: E4-02 · DB: no
  Aceptación: input enfocado por defecto; Enter con código exacto agrega 1 unidad (o incrementa); código inexistente → aviso claro y sonido/animación opcional; no pierde foco tras agregar.
- **E4-04 · Cobro y confirmación atómica** · Deps: E4-02, E0-05 aplicada · DB: usa RPC `confirm_sale`
  Aceptación: diálogo de pago (efectivo con monto recibido y vuelto; QR; tarjeta); `client_request_id` generado al abrir el diálogo; botón deshabilitado durante el envío; éxito → pantalla de confirmación con número de venta, total, vuelto, "Nueva venta"; error → mensaje claro, **el carrito se conserva**, nada aparece cobrado.
  Tests: invariantes 1, 2, 4 (`confirm-sale`, `failure`, `idempotency`, `insufficient-stock`); E2E #1.
- **E4-05 · Pausar y recuperar ventas** · Deps: E4-02 · DB: no (tabla `held_sales` en baseline)
  Aceptación: "Pausar venta" guarda carrito con etiqueta; lista de pausadas; recuperar la restaura; una pausada no cuenta como venta ni descuenta stock; se puede descartar.
  Tests: E2E #2.
- **E4-06 · Comprobante imprimible** · Deps: E4-04 · DB: no — vista de impresión (CSS `@media print`) con datos del negocio de `business_settings`.
- **E4-07 · Descuentos autorizados** · Deps: E4-04 · DB: no — según D-008; el descuento queda en la venta.
