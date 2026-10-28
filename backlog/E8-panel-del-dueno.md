# E8 — Panel del dueño

> Especificación de las tareas de esta épica. **El estado vive en `BACKLOG.md` (índice)**; la evidencia, en `backlog/PROGRESS.md`. Lee este archivo solo cuando trabajes en esta épica.

- **E8-01 · Dominio de métricas del día** · Deps: E5-01 · DB: no — ventas del día, N.º transacciones, ticket promedio, comparación vs. mismo día de la semana anterior (con dato insuficiente → "—", nunca 0 engañoso).
- **E8-02 · UI del panel** · Deps: E8-01, E3-01, E6-04 · DB: no
  Aceptación: saludo y fecha, tarjeta destacada "Ventas de hoy", Transacciones, Estado de caja, gráfico "Evolución de ventas" (7 días, selector de rango), "Stock bajo" con lista y enlace al inventario, actividad reciente, accesos directos ("Abrir punto de venta"). Las cifras coinciden con los registros de origen.
  Tests: los números del panel = suma de ventas de la prueba.
- **E8-03 · Notificaciones (campana)** · Deps: E8-02 — stock bajo, caja con diferencia, caja abierta de un día anterior.
