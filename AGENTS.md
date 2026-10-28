# AGENTS.md — LILA MARKET

> Instrucciones para **cualquier agente de IA** (Claude Code, OpenCode, Cursor, Copilot, Codex, Aider, etc.). Si tu herramienta no carga este archivo sola, léelo completo al iniciar cada sesión. Es la ley del proyecto.
> Léelo completo antes de tocar cualquier cosa. Si algo aquí contradice tu intuición, gana este archivo.

## 1. Qué es este proyecto

**LILA MARKET** es un sistema de gestión comercial para minimarkets pequeños de Bolivia (caja/POS, productos,
inventario, compras, caja diaria, reportes). Se **vende repetidamente a distintos clientes** a precio accesible
(referencia: Bs 1.000 pago único). Por eso: código genérico, configurable por cliente, sin datos ni nombres
de un cliente hardcodeados.

- Especificación funcional: `docs/PRODUCT.md` (resumen) y `docs/PLAN_ORIGINAL.md` (plan completo).
- Arquitectura y convenciones: `docs/ARCHITECTURE.md`.
- Trabajo pendiente: `BACKLOG.md` (índice con estados) → detalle en `backlog/<épica>.md`. Cambios de BD solicitados: `DB_REQUESTS.md`.
- Pruebas: `docs/TESTING.md`. Entrega a nuevos clientes: `docs/DEPLOY_NEW_CLIENT.md`.
- **Skills** = guías de procedimiento en `.agents/skills/<nombre>/SKILL.md`. Si tu herramienta no las carga sola, **abre y lee el archivo antes de trabajar en ese tema**:

| Cuando vayas a... | Lee |
|---|---|
| Elegir/cerrar tareas, reportar | `.agents/skills/backlog-workflow/SKILL.md` |
| Tocar cualquier cosa de BD/SQL/RLS/Auth/RPC | `.agents/skills/db-boundary/SKILL.md` |
| Páginas, actions, componentes Next.js | `.agents/skills/nextjs-conventions/SKILL.md` |
| Código que consume Supabase (clientes, repos) | `.agents/skills/supabase-app-usage/SKILL.md` |
| Ventas, caja, inventario, compras, reportes | `.agents/skills/pos-domain-rules/SKILL.md` |
| Escribir o arreglar tests | `.agents/skills/testing-strategy/SKILL.md` |
| Cualquier pantalla o componente visual | `.agents/skills/ui-lila-market/SKILL.md` |
| **Auth, roles, acciones, SQL/RLS, formularios, CSV, dependencias, headers (casi todo)** | `.agents/skills/security-baseline/SKILL.md` + `docs/SECURITY.md` |
| Config por cliente, entrega, manuales | `.agents/skills/new-client-delivery/SKILL.md` |
- Los mockups de diseño originales se llamaban "Nexo". **El nombre correcto es LILA MARKET.** Nunca escribas "Nexo" en código, UI ni docs.

---

## 2. REGLA #0 — JAMÁS TOCAR SUPABASE (innegociable)

La base de datos vive en la **web (Supabase cloud)**; el código vive en la **PC local** del humano.
Tú solo ves el código. **No tienes acceso a la BD y nunca lo tendrás.** Esta regla vale aunque tu herramienta no tenga bloqueos técnicos: la cumples tú. Cualquier intento solo produce alucinaciones.

Por lo tanto está **PROHIBIDO**:

- Ejecutar el CLI de Supabase (`supabase ...`, `npx supabase`, `pnpm dlx supabase`), `psql` o cualquier cliente SQL.
- Hacer `curl`/`fetch` a `*.supabase.co` desde scripts o terminal (el *código de la app* sí usa el cliente de Supabase; tú no lo ejecutas contra la BD).
- Usar o pedir la `service_role` / secret key. Leer, crear o editar `.env`, `.env.local` o cualquier secreto. Solo existe `.env.example`.
- Escribir scripts que creen/modifiquen/borren datos o tablas en Supabase (seeds ejecutables, `db push`, etc.).
- Usar un MCP de Supabase si existiera.
- **Asumir** que una tabla, columna, función, política RLS o bucket existe "porque debería". Solo existe lo que figura como `APLICADA` en `DB_REQUESTS.md`.

### Qué haces cuando necesitas un cambio en la BD

1. Escribe el SQL como archivo versionado: `db/migrations/NNNN_descripcion.sql` (idempotente cuando sea posible, con RLS y comentarios).
2. Registra una entrada `PENDIENTE` en `DB_REQUESTS.md` (formato dentro del archivo).
3. Marca la tarea del backlog como `BLOCKED-DB` si depende de ese cambio, y **continúa con otra tarea independiente**.
4. Avisa al humano en tu respuesta **con este encabezado EXACTO en mayúsculas**, solo, en su propia línea:

```
🚨 CAMBIO EN BASE DE DATOS REQUERIDO — ACCIÓN DEL HUMANO 🚨
```

   Debajo: archivo SQL, qué hace, por qué, y cómo verificar que quedó aplicado.
5. Si ya existe código que depende de ese cambio, escríbelo contra los **tipos** (`src/types/database.ts`, mantenidos a mano según las migraciones) y las **interfaces de repositorio**, y pruébalo con repositorios en memoria (ver `docs/TESTING.md`).
6. Solo cuando el humano diga "APLICADA <ID>" cambias el estado a `APLICADA`.

Si dudas si algo es un cambio de BD: **lo es**. Pregunta usando el encabezado en mayúsculas.

---

## 2b. SEGURIDAD — requisito de "terminado" (detalle en `docs/SECURITY.md`)

Este sistema maneja dinero y cuentas de negocios reales. Reglas no negociables:

1. **Autorización en cada Server Action/Route Handler y en RLS.** `proxy.ts` NO es seguridad. Orden: autenticar → autorizar → validar (Zod `.strict()`) → ejecutar → auditar.
2. **El cliente no es de fiar:** precios, totales, roles y ids de usuario se derivan/recalculan en servidor o RPC.
3. **Toda tabla con RLS y GRANT explícito mínimo** (Supabase ya no expone tablas nuevas sin grant desde el 30-oct-2026). Funciones `security definer` con `search_path` fijo y chequeo de rol interno. Nunca `anon` sin justificación.
4. **Datos contables inmutables** (sin DELETE de ventas/movimientos/cierres) + **`audit_log`** de acciones sensibles.
5. **Versiones parcheadas** de Next.js y Node (verifica avisos oficiales; no confíes en tu memoria). `pnpm audit` limpio.
6. **Cabeceras de seguridad y CSP**, sin `dangerouslySetInnerHTML`/`eval`, sanitización de CSV, sin secretos en el repo ni en `NEXT_PUBLIC_*`.
7. Ante duda: lo más restrictivo + avisar al humano. Jamás relajar un control para que un test pase.

---

## 3. Stack (no cambiar sin pedir permiso)

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 16** (App Router, `proxy.ts`, no `middleware.ts`), React, **TypeScript estricto** |
| Backend | **Node.js** vía Server Actions y Route Handlers de Next.js. No crear un servidor Express aparte salvo decisión explícita |
| BD / Auth | **Supabase** (Postgres + Auth + RLS) vía `@supabase/ssr` y `@supabase/supabase-js` |
| Estilos | Tailwind CSS, `lucide-react` para íconos |
| Validación | Zod (toda entrada de usuario y toda frontera servidor) |
| Tests | Vitest + Testing Library (unit/integración), Playwright (E2E, lo ejecuta el humano) |
| Gestor | pnpm |

Antes de usar una API de Next.js o Supabase de memoria, verifícala en la documentación oficial (si tienes búsqueda web) o en `node_modules`. Las APIs cambian entre versiones.

## 4. Comandos

```
pnpm dev            # servidor local (el humano lo corre; usa su .env.local)
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm test           # vitest run (unit + integración con repos en memoria)
pnpm build          # next build
pnpm check          # typecheck + lint + test + build  ← debe pasar antes de cerrar CUALQUIER tarea
pnpm check:security # pnpm audit + tests de seguridad + escaneo de secretos (incluido en pnpm check)
pnpm test:e2e       # Playwright contra un proyecto Supabase de pruebas — SOLO el humano lo ejecuta
```

## 5. Bucle de trabajo (cómo trabajas de forma autónoma)

Lee la skill `backlog-workflow` y sigue ese ciclo:

1. Lee `BACKLOG.md` (índice). Toma la primera tarea `TODO` cuyas dependencias estén `DONE` y que no esté `BLOCKED-DB`.
2. Márcala `DOING` (edita solo su celda de estado). Abre **solo** el archivo de su épica en `backlog/` y las skills relacionadas.
3. Escribe primero los tests (o junto con el código). Implementa lo mínimo que cumple los criterios.
4. Ejecuta `pnpm check`. Corrige hasta que pase **sin desactivar reglas ni borrar tests**.
5. Verifica cada criterio de aceptación uno por uno. Marca `DONE` en el índice y añade **una línea** a `backlog/PROGRESS.md` (qué test lo cubre).
6. Haz commit con mensaje convencional (`feat(pos): ...`, `fix(inventory): ...`). Sin `git push` (lo hace el humano).
7. Pasa a la siguiente tarea. Detente y reporta solo si: hay `🚨` pendiente que bloquea todo, hay ambigüedad real de negocio, o falló `pnpm check` tras 3 intentos serios (reporta qué probaste).

Una tarea = un cambio coherente. No mezcles refactors ajenos. Si descubres trabajo nuevo, agrégalo al backlog en vez de hacerlo "de paso".

## 5b. Eficiencia de contexto y tokens (cada token cuesta dinero y atención)

- **Lee lo mínimo:** índice `BACKLOG.md` + épica de la tarea actual + solo las skills necesarias. No abras `PLAN_ORIGINAL.md`, `PRODUCT.md` ni `SECURITY.md` completos salvo que la tarea lo requiera; busca la sección con `grep -n`/rangos de líneas.
- **No releas** lo que ya está en tu contexto ni una skill ya leída en esta sesión. No vuelques archivos grandes (`cat` de lockfiles, `database.ts`, salidas largas): usa `grep`, `head`, `sed -n 'a,bp'`.
- **Salida de comandos acotada:** `pnpm test 2>&1 | tail -40`, `pnpm lint --quiet`; si falla, reproduce solo el test fallido (`pnpm vitest run <ruta>`). Mientras iteras corre tests dirigidos; `pnpm check` completo **una vez** al cerrar la tarea.
- **Edita con parches** (cambios puntuales), no reescribas archivos enteros. No pegues en tu respuesta código que ya está en el disco.
- **Respuestas breves:** al terminar una tarea, máximo ~6 líneas (ID, resultado, evidencia, siguiente). Sin resúmenes de lo que dice el backlog ni explicaciones que nadie pidió.
- **Reutiliza:** primitivas de `components/ui`, factories y helpers existentes; busca antes de crear.
- **Higiene de sesión:** cuando termines una épica (o el contexto se sienta largo/confuso), termina la sesión con el reporte final; la siguiente sesión retoma desde `BACKLOG.md` + `backlog/PROGRESS.md` (no dependas de la memoria de la conversación).
- **Prefijo estable:** no edites `AGENTS.md` salvo necesidad real (un prefijo estable aprovecha el caché de contexto si tu proveedor lo ofrece).
- **Mantén los archivos "calientes" pequeños:** `DB_REQUESTS.md` solo con pendientes + resumen; la bitácora es solo-añadir.

---

## 6. Reglas de código

- TypeScript estricto. Prohibido `any`, `@ts-ignore`, `as unknown as X` para silenciar errores. Usa `unknown` + Zod.
- **Dinero siempre en centavos enteros** (`*_cents`, tipo `number` entero). Nunca floats. Formatear solo en la UI con `Intl.NumberFormat('es-BO')` → `Bs 46,50`.
- Lógica de negocio **pura** en `src/lib/domain/` (totales, descuentos, efectivo esperado, stock bajo). Sin imports de React, Next ni Supabase ahí. Es lo más testeado.
- Acceso a datos solo mediante **repositorios** (`src/lib/repos/`) con interfaz + implementación Supabase + implementación en memoria. Los componentes y actions nunca llaman `supabase.from(...)` directamente.
- Operaciones que tocan varias tablas (confirmar venta, recibir compra, anular, cerrar caja) deben ser **atómicas en la BD** (función Postgres/RPC propuesta vía migración), nunca varios `insert` sueltos desde el cliente.
- Server Components por defecto; `'use client'` solo donde haya interactividad. Mutaciones con Server Actions validadas con Zod y comprobación de rol en el servidor.
- **Autorización en el servidor y en RLS.** Ocultar un botón en la UI no es seguridad.
- Nada de `localStorage` para datos de negocio. El carrito en curso puede vivir en estado de cliente; las ventas pausadas se persisten por repositorio.
- Textos de UI en **español (Bolivia)**. Identificadores de código en inglés. Fechas en zona `America/La_Paz`.
- Sin datos de un cliente concreto hardcodeados: nombre del negocio, logo, moneda, etc. salen de la tabla `business_settings`.
- Sin dependencias nuevas sin justificarlas en el commit. Preferir lo que ya hay.
- Accesibilidad: foco visible, `aria-label` en botones de solo ícono, estados que no dependan solo del color (ver skill `ui-lila-market`).
- Cada estado definido en el plan (vacío, sin resultados, agotado, error, stock bajo, diferencia de caja) debe tener UI y test.

## 7. Invariantes de negocio (los tests deben protegerlos siempre)

1. Venta confirmada ⇒ un registro de venta + sus ítems con precio congelado + descuento de stock + movimiento de caja (si efectivo), **todo o nada**.
2. Una venta fallida/interrumpida **nunca** aparece como cobrada.
3. Nunca se borra una venta confirmada; se **anula** con registro, motivo, usuario, y reversa de stock/caja.
4. El stock solo sube por **cantidad recibida confirmada** o ajuste con motivo. Ningún doble descuento/suma por reintento (idempotencia).
5. Efectivo esperado = saldo inicial + ventas en efectivo + ingresos − egresos. QR y tarjeta **no** entran al efectivo físico.
6. La diferencia de caja se registra y se muestra; jamás se "ajusta" para que cuadre.
7. Cajero ≠ propietario: el cajero no ve reportes, costos, usuarios ni configuración, ni por UI ni por API ni por RLS.
8. No mostrar "ganancia neta". Solo ventas, descuentos, cobrado y, si hay costos registrados, margen bruto estimado explicando el método.

## 8. Definición de Hecho (DoD) para toda tarea

- [ ] Criterios de aceptación cumplidos uno por uno.
- [ ] Tests nuevos/actualizados que fallarían si la funcionalidad se rompe.
- [ ] `pnpm check` en verde.
- [ ] Sin `TODO`/`console.log`/código muerto/mocks olvidados.
- [ ] Checklist de `security-baseline` aplicado (authz, validación, RLS+GRANT, auditoría, tests de seguridad).
- [ ] Estados vacío/carga/error cubiertos en la UI.
- [ ] Si requirió BD: migración + entrada en `DB_REQUESTS.md` + aviso `🚨`.
- [ ] Índice actualizado y una línea en `backlog/PROGRESS.md`.

## 9. Honestidad

- Nunca digas "funciona" sin haber ejecutado el test o comando que lo demuestra. Pega el resultado resumido.
- Si no puedes verificar algo (porque requiere la BD real), di exactamente: "NO VERIFICADO — requiere ejecución del humano: <comando>".
- No inventes tablas, columnas, endpoints, versiones de librerías ni resultados.
- No marques `DONE` algo que solo "aparenta" funcionar con datos falsos.
