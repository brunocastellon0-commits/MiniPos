# E2 — Catálogo

> Especificación de las tareas de esta épica. **El estado vive en `BACKLOG.md` (índice)**; la evidencia, en `backlog/PROGRESS.md`. Lee este archivo solo cuando trabajes en esta épica.

- **E2-01 · Categorías (CRUD)** · Deps: E1-03 · DB: no (tabla ya en baseline)
  Aceptación: crear, renombrar, ordenar, desactivar (no borrar si tiene productos).
- **E2-02 · Productos (CRUD)** · Deps: E2-01 · DB: no
  Aceptación: formulario organizado por secciones (identificación, precio y costo, inventario); validación Zod (precio ≥ 0, barcode único con mensaje claro); activar/desactivar; búsqueda, filtros por categoría/estado/stock bajo; paginación.
  Tests: validación; duplicado de barcode; cajero no ve `cost_cents`.
- **E2-03 · Importar productos desde CSV** · Deps: E2-02 · DB: no
  Aceptación: plantilla descargable, vista previa con errores por fila, importación atómica vía repositorio, informe final. (Clave para entregar rápido a cada cliente nuevo.)
  Tests: CSV válido/ inválido / duplicados.
- **E2-04 · Búsqueda de producto para POS** · Deps: E2-02 · DB: no
  Aceptación: búsqueda por nombre (sin acentos, parcial) o código exacto < 300 ms con 5 000 productos (índice sugerido vía 🚨 si hace falta); resultados ordenados por relevancia.
