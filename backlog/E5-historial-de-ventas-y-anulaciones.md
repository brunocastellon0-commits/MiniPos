# E5 — Historial de ventas y anulaciones

> Especificación de las tareas de esta épica. **El estado vive en `BACKLOG.md` (índice)**; la evidencia, en `backlog/PROGRESS.md`. Lee este archivo solo cuando trabajes en esta épica.

- **E5-01 · Listado y detalle de ventas** · Deps: E4-04 · DB: no
  Aceptación: filtros por fecha, método, cajero, estado; detalle con ítems y precios congelados; cajero solo las suyas.
- **E5-02 · Anular venta (dueño)** · Deps: E5-01 · DB: usa RPC `void_sale`
  Aceptación: motivo obligatorio; estado `voided`, no se borra; reversa de stock (movimiento `void_return`) y de caja; reportes la excluyen de ventas netas pero la muestran.
  Tests: `void-sale.int.test.ts`; E2E #5.
