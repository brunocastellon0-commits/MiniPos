# E3 — Turno de caja (precondición de vender)

> Especificación de las tareas de esta épica. **El estado vive en `BACKLOG.md` (índice)**; la evidencia, en `backlog/PROGRESS.md`. Lee este archivo solo cuando trabajes en esta épica.

- **E3-01 · Apertura de turno** · Deps: E1-03, E0-05 aplicada · DB: usa RPC (en baseline)
  Aceptación: saldo inicial obligatorio; solo una caja abierta; usuario responsable; estado visible en cabecera ("Caja abierta · desde 08:02 · María C.").
  Tests: `cash/open-session.int.test.ts`.
- **E3-02 · Movimientos de efectivo (ingresos/egresos)** · Deps: E3-01 · DB: no
  Aceptación: motivo obligatorio, monto > 0, queda el usuario; afecta efectivo esperado.
- **E3-03 · Cálculo de efectivo esperado (dominio)** · Deps: E0-04 · DB: no
  Aceptación: función pura que cumple invariante 5. Tests: `cash/expected-cash.unit.test.ts`.
- **E3-04 · Cierre de turno** · Deps: E3-01..03 · DB: no
  Aceptación: resumen por método de pago; efectivo esperado; ingreso del contado; diferencia mostrada con estado visual (no solo color); confirmación; registro inmutable y consultable. Nunca autoajusta.
  Tests: `cash/close-session.int.test.ts`; E2E #3 y #7.
- **E3-05 · Historial de turnos** · Deps: E3-04 · DB: no — dueño ve todos; cajero los suyos.
