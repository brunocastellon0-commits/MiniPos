# PROGRESS.md — Bitácora (solo añadir al final; lee las últimas ~15 líneas)

| Fecha | Tarea | Estado | Evidencia (tests/comando) |
|---|---|---|---|
| 2026-10-27 | E0-01 | DONE | `pnpm typecheck` OK · `pnpm build` OK · `pnpm dev` → HTTP 200 en localhost:3000 |
| 2026-10-27 | E0-02 | DONE | `pnpm check` OK (typecheck + lint + 1 test Vitest/jsdom + audit + build) · `pnpm format:check` OK |
| 2026-10-27 | E0-03 | DONE | `pnpm check` OK (23 tests: primitivas, foco visible, aria-label, dialog) · `/_design` HTTP 200 |
| 2026-10-27 | E0-04 | DONE | `pnpm check` OK · 68 tests totales (45 nuevos de dinero/fecha) · sin dependencias nuevas |
| 2026-10-28 | E0-05 | DONE | Migraciones 0001..0008 aplicadas y verificadas por el humano en Supabase (DB-001) · `src/types/database.ts` OK · RLS verificada |
| 2026-10-28 | E0-06 | DONE | Clientes browser/server SSR · proxy.ts Next 16 con getClaims() · 75 tests Vitest OK (7 nuevos de proxy) · build verde |
| 2026-10-28 | E0-07 | DONE | Interfaces de repositorios · MemoryStore completo · Esqueleto Supabase tipado · 87 tests Vitest OK (12 nuevos de contrato) · build verde |
| 2026-10-28 | E0-08 | DONE | Factories para todas las entidades · Dataset demo boliviano · 90 tests Vitest OK (3 nuevos) · build verde |
| 2026-10-28 | E0-09 | DONE | README.md · CHANGELOG.md · script precommit configurado · format:check y typecheck verde |
| 2026-10-28 | E0-10 | DONE | Cabeceras de seguridad (CSP con nonce, HSTS, nosniff, frame-ancestors none) · 93 tests Vitest OK (3 de security/headers) · build verde |
| 2026-10-28 | E0-11 | DONE | server-only instalado · Escaneo de secretos (no-secrets.test.ts) y no-dangerous-html.test.ts · pnpm audit limpio · build verde |
