# E7 — Compras y proveedores

> Especificación de las tareas de esta épica. **El estado vive en `BACKLOG.md` (índice)**; la evidencia, en `backlog/PROGRESS.md`. Lee este archivo solo cuando trabajes en esta épica.

- **E7-01 · Proveedores (CRUD)** · Deps: E1-03 · DB: no
- **E7-02 · Registrar compra/pedido** · Deps: E7-01, E2-02 · DB: no — ítems con cantidad y costo unitario; total calculado; estado `ordered`.
- **E7-03 · Recepción (total/parcial)** · Deps: E7-02 · DB: usa RPC `receive_purchase`
  Aceptación: confirmar cantidades **recibidas** distintas a las pedidas; solo eso suma stock; actualiza costo del producto si se elige; idempotente.
  Tests: `purchases/receive.int.test.ts`; E2E #4.
- **E7-04 · Historial de compras y atajo desde stock bajo** · Deps: E7-03, E6-04 — desde la alerta crear una compra con productos preseleccionados.
