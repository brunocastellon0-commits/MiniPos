# extras/ — Opcional

`permisos-opencode.json`: bloqueos técnicos **solo si usas OpenCode** (copiar a la raíz como `opencode.json`).
Bloquea el CLI de Supabase, `psql`, `curl` a Supabase y la lectura de `.env*`. Otras herramientas tienen su propio mecanismo
(Claude Code: `.claude/settings.json` → `permissions.deny`; Cursor: ignore files). Si no configuras nada, la regla sigue
vigente por texto en `AGENTS.md` §2.
