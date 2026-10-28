# START_HERE.md — Guía para el humano

## Instalación del kit
1. Copia el contenido a la **raíz** del proyecto (incluida la carpeta oculta `.agents/`).
2. Pega el plan completo en `docs/PLAN_ORIGINAL.md`.
3. Crea tu proyecto Supabase de desarrollo y guarda URL + publishable key en **tu** `.env.local` (el agente nunca lo toca).
4. Abre tu agente (cualquiera) en la raíz. Primer mensaje:

> Lee AGENTS.md, BACKLOG.md y DB_REQUESTS.md. Empieza por la primera tarea disponible y trabaja el backlog de forma continua siguiendo la skill backlog-workflow. Detente solo según las reglas de AGENTS.md.

## Ahorro de tokens
- El agente lee solo `BACKLOG.md` (índice) + la épica de la tarea actual (`backlog/`), y escribe la bitácora en `backlog/PROGRESS.md`. Ver `AGENTS.md` §5b.
- Consejo: inicia una **sesión nueva por épica**; el estado persiste en archivos, no en la conversación.
- Si tu proveedor ofrece caché de contexto, evita editar `AGENTS.md` a cada rato.

## Compatibilidad
- `AGENTS.md` es el archivo estándar que leen la mayoría de agentes. `CLAUDE.md` solo lo importa para Claude Code.
- Las skills son Markdown normal en `.agents/skills/`; `AGENTS.md` incluye la tabla de cuándo leer cada una, así que funcionan aunque la herramienta no las cargue sola.
- Bloqueos técnicos opcionales: ver `extras/README.md`.

## Tu parte (lo único que el agente no puede hacer)
- Ante `🚨 CAMBIO EN BASE DE DATOS REQUERIDO — ACCIÓN DEL HUMANO 🚨`: ejecuta el SQL en Supabase, verifica y responde `APLICADA DB-00X`.
- Ejecuta `pnpm test:e2e` y `pnpm test:db` cuando el agente lo pida y pégale los fallos.
- Revisa las "Decisiones por defecto" del backlog. Haz `git push` y etiqueta versiones.
- Si el agente se desvía en contextos largos: "relee AGENTS.md y BACKLOG.md".
