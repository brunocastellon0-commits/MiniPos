# E6 — Inventario

> Especificación de las tareas de esta épica. **El estado vive en `BACKLOG.md` (índice)**; la evidencia, en `backlog/PROGRESS.md`. Lee este archivo solo cuando trabajes en esta épica.

- **E6-01 · Vista de inventario** · Deps: E2-02 · DB: no — existencias, mínimo, estado (agotado / bajo / ok) con texto + ícono, filtros.
- **E6-02 · Ajustes y mermas** · Deps: E6-01 · DB: usa RPC `adjust_stock` — motivo obligatorio y usuario; delta ≠ 0.
- **E6-03 · Historial de movimientos** · Deps: E6-01 · DB: no — origen (venta, compra, ajuste, merma, anulación) con enlace al documento.
- **E6-04 · Alertas de stock bajo (dominio + UI)** · Deps: E6-01 · DB: no — regla `stock_qty <= min_stock`; contador en navegación; la alerta **no** compra automáticamente.
