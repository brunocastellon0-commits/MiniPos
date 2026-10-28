# PROGRESS.md — Bitácora (solo añadir al final; lee las últimas ~15 líneas)

| Fecha | Tarea | Estado | Evidencia (tests/comando) |
|---|---|---|---|
| 2026-10-27 | E0-01 | DONE | `pnpm typecheck` OK · `pnpm build` OK · `pnpm dev` → HTTP 200 en localhost:3000 |
| 2026-10-27 | E0-02 | DONE | `pnpm check` OK (typecheck + lint + 1 test Vitest/jsdom + audit + build) · `pnpm format:check` OK |
| 2026-10-27 | E0-03 | DONE | `pnpm check` OK (23 tests: primitivas, foco visible, aria-label, dialog) · `/_design` HTTP 200 |
| 2026-10-27 | E0-04 | DONE | `pnpm check` OK · 68 tests totales (45 nuevos de dinero/fecha) · sin dependencias nuevas |
| 2026-10-27 | E0-05 | BLOCKED-DB | Migraciones 0001..0008 creadas · `src/types/database.ts` OK · `pnpm check` verde · Solicitud DB-001 registrada |
