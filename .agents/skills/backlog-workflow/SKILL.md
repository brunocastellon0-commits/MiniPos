---
name: backlog-workflow
description: Úsala al iniciar una sesión o al terminar una tarea. Explica cómo elegir la siguiente tarea de BACKLOG.md, cómo trabajarla de forma autónoma, verificarla, cerrarla y reportar sin dejar nada pendiente.
---

# backlog-workflow

## Elegir tarea
1. Lee `BACKLOG.md` (índice), `DB_REQUESTS.md` (solo pendientes) y las últimas ~15 líneas de `backlog/PROGRESS.md`. **No abras otros archivos todavía.**
2. Candidata = primera tarea `TODO` (en orden) con todas las dependencias `DONE`/`DONE-PENDING-HUMAN-VERIFY` y sin `BLOCKED-DB`.
3. Si hay solicitudes DB `PENDIENTE` que bloquean tareas, **recuérdalo al humano al inicio de tu mensaje** con el encabezado 🚨 y sigue con otra tarea.
4. Si no queda ninguna candidata: reporta qué falta aplicar/verificar al humano. No inventes tareas.

## Ejecutar (sin pedir permiso entre pasos)
1. Cambia a `DOING`. Lee las skills relevantes (tabla en `AGENTS.md` §1) (`nextjs-conventions`, `supabase-app-usage`, `pos-domain-rules`, `testing-strategy`, `ui-lila-market`, `db-boundary`).
2. Abre únicamente `backlog/<épica de la tarea>.md` (aceptación y tests). Plan mental en 3-6 líneas: archivos a crear/tocar, tests, riesgos.
3. Escribe tests + código. Pequeños pasos; ejecuta `pnpm typecheck`/`pnpm test` seguido, no solo al final.
4. `pnpm check` completo al terminar. Si falla: lee el error, corrige la causa raíz. Prohibido silenciar reglas, `.skip`, `any`, o borrar tests.
5. Verifica **cada** criterio de aceptación; si alguno no se puede probar por requerir la BD real, usa `DONE-PENDING-HUMAN-VERIFY` y escribe el comando exacto para el humano.
6. Edita **solo la celda de estado** en `BACKLOG.md` y añade **una fila** a `backlog/PROGRESS.md` (fecha, ID, estado, tests/comando). No reescribas archivos de backlog.
7. Commit convencional (`feat(scope): ...`). No `git push`.
8. Siguiente tarea.

## Cuándo detenerte y preguntar (y solo entonces)
- Ambigüedad de **negocio** que cambia el resultado y no está en `PRODUCT.md`, el plan ni las Decisiones. Pregunta con 2-3 opciones y tu recomendación; mientras tanto avanza con otra tarea.
- Necesitas cambiar el stack, borrar datos, o algo fuera del alcance v1.
- `pnpm check` falla 3 veces con enfoques distintos: reporta qué intentaste.

## Qué hacer con trabajo descubierto
Agrégalo como nueva tarea (`E?-NN` o `SEC-NN`): fila en el índice + especificación en el archivo de su épica; no lo mezcles en la tarea actual.

## Economía de tokens
Ver `AGENTS.md` §5b. Resumen: lectura mínima, salidas de comandos acotadas (`| tail`), tests dirigidos mientras iteras, `pnpm check` una vez al cerrar, parches en vez de reescrituras, respuestas de ≤ 6 líneas.

## Formato del reporte final de cada sesión
- Tareas cerradas (ID + evidencia) · Tareas bloqueadas y por qué · 🚨 pendientes de BD · Verificaciones que debe correr el humano · Siguiente tarea prevista.
