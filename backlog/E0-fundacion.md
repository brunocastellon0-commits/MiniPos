# E0 — Fundación

> Especificación de las tareas de esta épica. **El estado vive en `BACKLOG.md` (índice)**; la evidencia, en `backlog/PROGRESS.md`. Lee este archivo solo cuando trabajes en esta épica.

- **E0-01 · Crear proyecto Next.js 16 + TS estricto + Tailwind + pnpm** · Deps: — · DB: no
  Aceptación: `pnpm dev` arranca; `tsconfig` con `strict`; alias `@/`; estructura de `docs/ARCHITECTURE.md` §2 creada; `.env.example` con las 2 variables; `.gitignore` excluye `.env*` salvo example.
  Tests: `pnpm build` verde.
- **E0-02 · Tooling de calidad** · Deps: E0-01 · DB: no
  Aceptación: ESLint, Prettier, Vitest + Testing Library + jsdom, scripts `typecheck`, `lint`, `test`, `check` según `docs/TESTING.md`; un test de humo pasa.
- **E0-03 · Sistema de diseño LILA MARKET** · Deps: E0-01 · DB: no
  Aceptación: tokens (colores, tipografía, radios, sombras) como variables CSS/Tailwind según skill `ui-lila-market`; primitivas `Button`, `Input`, `Badge`, `Card`, `Dialog`, `EmptyState`, `Toast`, `Spinner`, `Kbd` con estados foco/hover/disabled; página interna `/_design` mostrando todo.
  Tests: componentes renderizan variantes; foco visible; `aria-label` en icon-buttons.
- **E0-04 · Utilidades de dinero y fecha** · Deps: E0-02 · DB: no
  Aceptación: `money.ts` (`toCents("46,50")`, `formatBs(4650)` → `Bs 46,50`, suma/resta/porcentaje con redondeo definido); helpers de fecha `America/La_Paz`.
  Tests: unit con casos float clásicos y redondeo.
- **E0-05 · Esquema de BD baseline (migraciones)** · Deps: E0-01 · DB: **SÍ**
  Aceptación: `db/migrations/0001..` crean las tablas de `ARCHITECTURE.md` §3 (incl. `audit_log` solo-insert), índices (incl. única caja abierta, `barcode` único, `client_request_id` único), `check`/FK, RLS activada en todas con políticas por rol, **GRANT explícito mínimo por objeto (nada a `anon`)**, funciones `security definer` seguras (`search_path` fijo, chequeo de rol, revoke/grant execute, auxiliares en `private`), vista `products_pos` con `security_invoker`, trigger de creación de `profiles`, sin DELETE sobre datos contables. Entrada en `DB_REQUESTS.md` + aviso 🚨. Escribe `src/types/database.ts` a mano.
  Verificación humana: lista de consultas de comprobación incluida en la entrada.
- **E0-06 · Clientes Supabase y proxy** · Deps: E0-01 · DB: no
  Aceptación: `lib/supabase/{client,server,proxy}.ts` con `@supabase/ssr`, adaptador de cookies `getAll/setAll`; `proxy.ts` raíz con matcher que excluye estáticos; refresco con `getClaims()`; sin `auth-helpers` ni `middleware.ts`. Verificar API vigente en la doc oficial antes de escribir.
  Tests: unit del helper de redirección con cliente simulado.
- **E0-07 · Capa de repositorios** · Deps: E0-05 (tipos) · DB: no
  Aceptación: interfaces por agregado (`ProductsRepo`, `SalesRepo`, `CashRepo`, `InventoryRepo`, `PurchasesRepo`, `UsersRepo`, `SettingsRepo`); implementaciones `memory/` completas; implementación `supabase/` esqueleto tipado; suite de contrato compartida.
  Tests: contrato corre contra memoria.
- **E0-08 · Factories y datos demo en memoria** · Deps: E0-07 · DB: no
  Aceptación: `src/test/factories.ts`; dataset demo (Coca-Cola 2 L, Leche PIL, Pan molde, Arroz Grano de Oro, etc.) reutilizable en tests y Storybook/`_design`.
- **E0-09 · CI local y documentación de desarrollo** · Deps: E0-02 · DB: no
  Aceptación: `README.md` (instalar, `.env.local` a crear por el humano, cómo aplicar `db/migrations`, cómo correr tests); `CHANGELOG.md`; hook pre-commit opcional con `pnpm typecheck && pnpm lint`.

- **E0-10 · Cabeceras de seguridad y CSP** · Deps: E0-01 · DB: no
  Aceptación: CSP con nonce según guía oficial de Next.js (sin `unsafe-eval`), HSTS, nosniff, Referrer-Policy, Permissions-Policy, `frame-ancestors 'none'`; la app funciona con la CSP activa.
  Tests: `security/headers.test.ts`.
- **E0-11 · Higiene de dependencias y secretos** · Deps: E0-02 · DB: no
  Aceptación: versión de Next.js/Node parcheada (verificada contra avisos oficiales; anotar fuente y fecha en `docs/SECURITY.md`), `pnpm audit` en `pnpm check:security`, escaneo de secretos, `import 'server-only'` en módulos de datos, lockfile versionado, `.env*` ignorados.
  Tests: `security/no-secrets.test.ts`, `security/no-dangerous-html.test.ts`.
- **E0-12 · Capa común de acciones seguras** · Deps: E0-06 · DB: no
  Aceptación: helper `secureAction({roles, schema, handler})` que impone autenticar → autorizar → Zod `.strict()` → ejecutar → auditar y devuelve `ActionResult`; todas las acciones lo usan. Rate limiter reutilizable.
  Tests: `security/authz-matrix.int.test.ts` (base), `security/validation.unit.test.ts`.
