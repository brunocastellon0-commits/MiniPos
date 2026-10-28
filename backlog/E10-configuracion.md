# E10 — Configuración

> Especificación de las tareas de esta épica. **El estado vive en `BACKLOG.md` (índice)**; la evidencia, en `backlog/PROGRESS.md`. Lee este archivo solo cuando trabajes en esta épica.

- **E10-01 · Datos del negocio y marca** · Deps: E1-03 · DB: no — nombre, razón social, logo, moneda, textos de comprobante; usado en cabecera, login e impresión.
- **E10-02 · Preferencias de operación** · Deps: E10-01 — `allow_negative_stock`, descuentos para cajero, umbral de stock bajo por defecto.
- **E10-03 · Asistente de configuración inicial (onboarding)** · Deps: E10-01, E2-03 — primer ingreso del dueño: negocio → categorías → productos (CSV) → saldo inicial. Acelera cada venta del producto.
