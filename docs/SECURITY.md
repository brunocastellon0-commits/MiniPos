# SECURITY.md — Protocolo de seguridad de LILA MARKET

> Sistema que maneja **dinero, inventario y cuentas de empleados** de negocios reales, y se vende a varios clientes.
> Un fallo no es un bug: es pérdida de dinero o de confianza. Esta seguridad es **requisito de "terminado"**, no una mejora opcional.
> Última revisión de fuentes: 27-oct-2026. Las versiones y fechas citadas **deben reverificarse** en las fuentes oficiales antes de cada entrega (ver §11).

Referencias base: OWASP Top 10 (edición vigente) y OWASP ASVS como lista de verificación; guías oficiales de Next.js y Supabase.

---

## 1. Modelo de amenazas (qué nos importa de verdad)

| Amenaza | Ejemplo en un minimarket | Defensa principal |
|---|---|---|
| Cajero deshonesto | Anula ventas y se queda el efectivo; da descuentos a conocidos; ajusta stock para ocultar robo | Anular/descuentos/ajustes solo según rol, motivo obligatorio, **registro de auditoría inmutable**, diferencias de caja visibles |
| Acceso indebido a datos del dueño | Cajero ve costos, reportes, otros usuarios | RLS + `requireRole` en servidor + vistas sin costos |
| Robo de credenciales / sesión | PC compartida en el mostrador, contraseña débil | Cierre de sesión por inactividad, contraseñas fuertes, MFA para dueño, límites de intentos |
| Manipulación desde el cliente | Alterar precio/total/rol en la petición | El servidor/RPC **recalcula todo**; nunca confiar en precios, totales ni roles del cliente |
| Explotación del software | RCE/bypass en Next.js o Node | Versiones parcheadas, auditoría de dependencias, CSP, mínimo privilegio |
| Fuga entre clientes | Mezclar datos de dos minimarkets | Un proyecto Supabase por cliente (D-001), claves y env separados, sin datos reales en desarrollo |
| Pérdida de datos | Borrado accidental, proyecto pausado, sin respaldo | Sin borrados físicos de datos contables, respaldos definidos por escrito |
| Inyección | SQL, XSS, CSV/fórmulas en exportaciones | Consultas parametrizadas, escape de React, sanitización de exportaciones |

## 2. Autenticación y sesiones

1. **Sin registro público.** El dueño crea cuentas. *(Humano: desactivar "Allow new users to sign up" en el Dashboard de Auth.)*
2. Contraseña mínima de 12 caracteres (política en Supabase y también validada en la UI). *(Humano: configurarlo; activar protección contra contraseñas filtradas si el plan de Supabase la ofrece.)*
3. **MFA (TOTP) disponible y recomendado para el dueño** (Supabase Auth lo soporta). Tarea E1-06.
4. Cierre de sesión automático por inactividad configurable (por defecto 15 min en la caja; el carrito en curso se conserva solo si hay venta pausada guardada) — E1-05.
5. Mensajes de login genéricos ("Correo o contraseña incorrectos"); no revelar si el correo existe.
6. Límite de intentos: Supabase aplica límites propios; **además** limitar a nivel de app los intentos de login por IP+correo (rate limit) — E1-05. Considerar CAPTCHA si hay abuso.
7. Usuario desactivado ⇒ sesión inválida en la siguiente petición (`profiles.active` se comprueba en cada acción de escritura).
8. Cookies de sesión gestionadas por `@supabase/ssr`; `SameSite=Lax` o más estricto; solo HTTPS en producción.
9. Cambio de rol, desactivación y restablecimiento de contraseña quedan en auditoría.

## 3. Autorización (la regla más importante)

- **`proxy.ts` NO es autenticación.** Solo refresca sesión y redirige por comodidad. Hubo fallos que permitían saltarse proxies/middleware; por eso **cada Server Action, Route Handler y acceso a datos verifica usuario y rol por sí mismo** (capa de acceso a datos).
- Orden obligatorio en toda acción: `autenticar → autorizar rol/permiso → validar entrada (Zod) → ejecutar → auditar`.
- **Nunca** aceptar del cliente: `role`, `user_id`, `price_cents`, `total_cents`, `status`, `cashier_id`. Se derivan en servidor.
- Usar `.strict()` en esquemas Zod (rechaza campos extra → evita asignación masiva).
- Cuidado con IDOR: todo acceso por id valida pertenencia/permiso (el cajero solo ve *sus* ventas) y lo refuerza RLS.
- Verifica permisos **de la operación**, no solo de la pantalla.

## 4. Base de datos y RLS (lo escribe el agente como SQL; lo aplica el humano)

1. **RLS activada en TODA tabla** con política explícita (default-deny). Una tabla sin RLS accesible por la API es un incidente crítico: hubo filtraciones masivas reales por esto.
2. **GRANTs explícitos (cambio de Supabase, 30-oct-2026):** las tablas nuevas de `public` ya no se exponen a la Data API automáticamente. Cada migración debe incluir `grant` mínimos por tabla/vista/función solo a los roles necesarios (`authenticated`; **nunca `anon`** salvo necesidad demostrada). RLS decide *qué filas*; el grant decide *si entra*. Sin grant ⇒ error `permission denied`.
3. Funciones **`SECURITY DEFINER`**: solo cuando sea necesario; con `set search_path = ''` (y nombres calificados `public.tabla`) o fijado explícitamente; **chequeo de rol dentro de la función**; `revoke execute ... from public, anon` y `grant execute ... to authenticated`. Las funciones auxiliares de permisos (`private.is_owner()`) van en un esquema **no expuesto** (`private`).
4. RPCs invocables por la API (p. ej. `confirm_sale`) validan: usuario autenticado y activo, rol, turno abierto, existencia y estado de productos, cantidades > 0 y enteras, método de pago válido.
5. SQL dinámico (`execute format`) solo con `%I`/`%L`; preferible no usarlo.
6. Vistas: crear con `security_invoker = true` para que respeten RLS del usuario que consulta (si la versión de Postgres lo soporta; verificar).
7. **Datos contables inmutables:** sin `DELETE` sobre ventas, movimientos de stock, movimientos de caja ni cierres; correcciones por anulación/contraasiento. Tablas de auditoría: solo `INSERT` (sin `UPDATE`/`DELETE` para ningún rol de la app).
8. Restricciones en BD como última línea: `check (price_cents >= 0)`, `check (quantity > 0)`, claves foráneas, únicos (`barcode`, `client_request_id`, una caja abierta).
9. Tabla `audit_log` (quién, cuándo, acción, entidad, antes/después resumido, motivo): anulaciones, descuentos, ajustes de stock, cambios de precio/costo, aperturas/cierres de caja, cambios de usuarios/roles/configuración, inicios de sesión fallidos relevantes.
10. Después de aplicar migraciones, el humano ejecuta el **Security Advisor** de Supabase y corrige hallazgos (RLS faltante, funciones expuestas, search_path). Resultado anotado en `DB_REQUESTS.md`.
11. Storage (logo): bucket con política explícita; validar tipo/tamaño; nunca bucket público para datos sensibles.
12. Realtime: si se usa, solo en tablas con RLS.

## 5. Aplicación Next.js (16.x)

1. **Versiones parcheadas obligatorias.** Verificación realizada el **03-nov-2026**: Next.js fijado en **16.4.5** (incluye el *November 2026 Security Release* publicado el mismo día: 7 fallos medios, GHSA-mfr8-8qww-v76h y otros; `eslint-config-next` también en 16.4.5); Node.js fijado en `>=20.9.0` (LTS). Fuentes: GitHub Security Advisory Database (GHSA), https://nextjs.org/blog y https://nodejs.org. **Aviso para el humano:** Node.js publicará release de seguridad (severidad ALTA) el **11-nov-2026** — actualizar el runtime de cada despliegue cuando salga (ver `SEC-01` en `BACKLOG.md`).
2. **Server Actions:** tienen comprobación Origin/Host contra CSRF, pero **eso no sustituye la autorización**. No exponer mutaciones en `GET`. Los Route Handlers de mutación (POST/PUT/DELETE) **no** tienen esa protección automática: evitarlos o validar Origin y sesión.
3. Validar **todos** los argumentos de cada Server Action con Zod; limitar tamaños (cuerpos, CSV, longitudes de texto).
4. **Rate limiting** en login, importación CSV y acciones costosas.
5. **Cabeceras de seguridad** (en `next.config.ts` y/o `proxy.ts`): `Content-Security-Policy` (con nonce según la guía oficial de CSP de Next.js; sin `unsafe-eval`; `frame-ancestors 'none'`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` mínimo, `X-Frame-Options: DENY`.
6. **Secretos:** nada sensible en `NEXT_PUBLIC_*`. El repo no contiene claves. `service_role` no se usa en la app. Marcar módulos de acceso a datos con `import 'server-only'`.
7. **XSS:** prohibido `dangerouslySetInnerHTML` con datos de usuario; los nombres de producto, notas y motivos se muestran siempre como texto. URLs (logo) validadas (`https:` o ruta propia).
8. **Exportaciones CSV/Excel:** neutralizar inyección de fórmulas (prefijar con `'` celdas que empiecen por `=`, `+`, `-`, `@`, tab o CR).
9. **Importación CSV:** límite de tamaño y filas, validación estricta fila por fila, sin ejecutar nada del contenido, codificación UTF-8, informe de errores sin volcar datos sensibles.
10. **Errores:** mensajes genéricos al usuario; detalles solo en logs de servidor; nunca stack traces ni errores crudos de Postgres en la UI.
11. **Logs:** nunca registrar contraseñas, tokens, claves ni cuerpos completos de petición.
12. `next/image` con `remotePatterns` mínimos; sin proxies abiertos ni redirecciones basadas en entrada del usuario sin validar (open redirect, SSRF).
13. Dependencias: `pnpm audit` en `pnpm check:security`; versiones fijadas con `pnpm-lock.yaml` versionado; sin paquetes desconocidos ni recién publicados sin revisión; no ejecutar scripts de instalación de terceros sin revisarlos (`pnpm` ignora scripts de dependencias por defecto en versiones recientes — verificar configuración).

## 6. Seguridad del lado del negocio (anti-fraude POS)

- Descuento por encima de un umbral configurable ⇒ requiere dueño.
- Anulación, ajuste de stock y cambio de precio/costo ⇒ auditoría con motivo.
- Diferencia de caja ⇒ nunca editable; el cierre queda inmutable.
- Cajero no puede cambiar precios ni ver costos; no puede reabrir un turno cerrado.
- Alertas al dueño: muchas anulaciones por cajero, descuentos frecuentes, diferencias de caja repetidas (E8-03/E9).

## 7. Privacidad y datos

- Recolectar lo mínimo: no se guardan datos personales de clientes finales en v1.
- Datos de empleados: nombre y correo. Visibles solo al dueño.
- Sin datos reales en desarrollo/tests; datos demo ficticios. Un cliente nunca se usa como entorno de pruebas.
- Retención y respaldo: definidos por escrito en `docs/CONDICIONES_COMERCIALES.md` (decisión del humano). Considerar la normativa boliviana aplicable de protección de datos; consultar a un abogado antes de prometer cumplimiento.

## 8. Despliegue y operación (acciones del HUMANO por cliente)

Ver checklist ejecutable en `docs/DEPLOY_NEW_CLIENT.md` §Seguridad. Resumen:
registro público desactivado · política de contraseñas · MFA del dueño · URLs de redirección de Auth restringidas al dominio real · Security Advisor sin hallazgos críticos · `service_role` guardada solo en gestor de secretos del hosting (y no usada por la app) · HTTPS forzado · respaldos configurados y **restauración probada** · variables de entorno distintas por cliente · rotación de claves ante cualquier sospecha de fuga · usuario dueño con correo propio del cliente.

## 9. Pruebas de seguridad obligatorias (ver también `docs/TESTING.md`)

| Prueba | Qué comprueba |
|---|---|
| `security/authz-matrix.int.test.ts` | Para **cada** Server Action y repositorio sensible: sin sesión ⇒ denegado; cajero ⇒ denegado en acciones de dueño; usuario inactivo ⇒ denegado |
| `security/no-client-trust.int.test.ts` | Precios/totales/rol enviados por el cliente se ignoran; `confirm_sale` recalcula |
| `security/validation.unit.test.ts` | Zod `.strict()`, límites, tipos, negativos, NaN, cadenas gigantes |
| `security/csv-injection.unit.test.ts` | Exportación neutraliza `=`, `+`, `-`, `@` |
| `security/headers.test.ts` | `next.config`/proxy emiten CSP, HSTS, nosniff, frame-ancestors |
| `security/no-secrets.test.ts` | Ningún archivo versionado contiene claves (`sb_secret_`, `service_role`, `eyJ...` largos); `NEXT_PUBLIC_*` solo con variables permitidas |
| `security/no-dangerous-html.test.ts` | Búsqueda estática: sin `dangerouslySetInnerHTML`, `eval`, `new Function` |
| `security/audit-log.int.test.ts` | Anular/ajustar/descontar/cambiar rol deja registro |
| `security/rls-checklist.md` + SQL de verificación | El humano ejecuta consultas de `docs/RLS_VERIFICATION.sql` (tablas sin RLS, grants a `anon`, funciones `security definer` sin `search_path`, vistas sin `security_invoker`) y pega el resultado |
| E2E | Cajero no accede a rutas/acciones de dueño; sesión expirada redirige |

## 10. Reglas para el agente (resumen vinculante)

1. Nunca escribir ni solicitar secretos, `service_role`, ni desactivar RLS "temporalmente".
2. Si una migración crea tabla/vista/función ⇒ RLS + GRANT explícito mínimo + comentarios; si falta alguno, la tarea **no** está terminada.
3. Toda acción servidor sigue `autenticar → autorizar → validar → ejecutar → auditar`.
4. No agregar dependencias sin `pnpm audit` limpio y justificación.
5. Cualquier duda de seguridad se resuelve por el lado más restrictivo y se reporta al humano.
6. Prohibido "arreglar" un test de seguridad que falla relajando el control; se corrige el control.
7. Si detectas una vulnerabilidad existente, repórtala de inmediato (aunque no sea tu tarea) y agrega tarea `SEC-xx` al backlog.

## 11. Mantenimiento: cómo se mantiene al día

- Antes de cada entrega a un cliente: `pnpm audit`, comprobar versión de Next.js y Node contra los avisos oficiales, ejecutar Security Advisor, revisar `CHANGELOG`.
- Suscribirse a: avisos de seguridad de Next.js (GitHub/blog), Node.js security releases, changelog de Supabase.
- Revisión trimestral de esta lista contra OWASP ASVS. El agente propone tareas `SEC-xx`; el humano decide.
- Plan de incidentes mínimo: (1) revocar sesiones y rotar claves, (2) aislar el proyecto afectado, (3) revisar `audit_log`, (4) comunicar al cliente, (5) post-mortem en `docs/INCIDENTES.md`.

## 12. Matrices de autorización y RLS (E11-01, revisión 2026-11-03)

### 12.1 Cómo leer las matrices (comportamiento real)

- **Sin sesión** → toda Server Action responde `UNAUTHENTICATED`. Excepciones: flujos de sesión (`login`, verificación MFA de inicio), que son anónimos con rate limit.
- **Inactivo** (`profiles.active = false`) → `USER_INACTIVE` en acciones; en RLS, `private.is_active_staff()` devuelve false y oculta los datos.
- **Rol no permitido** → `FORBIDDEN` en acciones; en RLS, `private.is_owner()` deniega.
- Toda entrada pasa por Zod `.strict()` antes de ejecutar. El cajero nunca ve `cost_cents` (sin GRANT de columna; solo `products_with_cost()`, que exige `is_owner()`).
- Orden en todo punto: autenticar → autorizar → validar → ejecutar → auditar.

### 12.2 Acciones de servidor por rol

| Módulo | Acciones | dueño | cajero |
|---|---|:-:|:-:|
| auth (sesión) | login, registro, logout, restablecer contraseña | flujo anónimo + rate limit | — |
| mfa (login) | verificar MFA de inicio | flujo anónimo + rate limit | — |
| mfa (gestión) | enroll, verifyEnrollment, getStatus, unenroll | ✔ | ✖ |
| caja | getOverview, getOpen, open, addMovement, close, list | ✔ | ✔ |
| categorías | list | ✔ | ✔ |
| categorías | create, update, reorder, delete | ✔ | ✖ |
| ventas pausadas | list, save, delete | ✔ | ✔ |
| inventario | list, movements, ajuste (`adjust_stock` RPC) | ✔ | ✖ |
| productos | list, create, update, setActive | ✔ | ✖ |
| productos CSV | preview, import | ✔ | ✖ |
| búsqueda POS | searchPos, listPos, getByIds | ✔ | ✔ |
| compras | create, list, get, receive (`receive_purchase` RPC) | ✔ | ✖ |
| reportes | getData, exportCsv | ✔ | ✖ |
| ventas | confirmar (`confirm_sale`), ticket, list, detalle | ✔ | ✔ |
| ventas | anular (`void_sale`) | ✔ | ✖ |
| configuración | getPublic | ✔ | ✔ |
| configuración | get, update (audita `settings.update`) | ✔ | ✖ |
| proveedores | CRUD (4) | ✔ | ✖ |
| usuarios | list, updateName, updateRole, toggleActive | ✔ | ✖ |

### 12.3 Páginas (guard de servidor; la data además está protegida por acción + RLS)

- `requireRole("owner", "/caja")`: `/panel`, `/productos`, `/proveedores`, `/compras`, `/compras/nueva`, `/compras/[id]`, `/inventario`, `/reportes`, `/usuarios`, `/configuracion`, `/configuracion/asistente`.
- `requireUser("/login")` (+ layout con `requireUser`): `/caja`, `/turno`, `/ventas`, `/ventas/[saleId]`.
- El detalle de venta de un cajero ajenó cae en estado "no encontrado" por RLS (`sales.sale_items` solo propios).

### 12.4 Tablas → políticas RLS

| Tabla | SELECT | Escritura | Nota |
|---|---|---|---|
| `profiles` | dueño; cada usuario su fila activa | INSERT dueño; UPDATE dueño o fila propia; DELETE denegado | trigger 0009 (último dueño); **brecha cerrada con DB-010** (ver 12.6) |
| `business_settings` | dueño (`anon`: solo `name,logo_url` de la fila 1 tras DB-009) | UPDATE/INSERT/DELETE solo dueño (insert/delete con check `false`) | público vía RPC `get_business_public()` |
| `categories` | dueño o personal activo (filas `active`) | solo dueño | borrado físico solo por app |
| `products` | dueño o personal activo (filas `active`) | solo dueño | sin GRANT de `cost_cents`; vista `products_pos` sin costos |
| `cash_sessions` | dueño; sesión abierta (personal activo); filas propias | solo RPC (security definer) | solo existe 1 sesión abierta a la vez (lo exige la RPC) |
| `cash_movements` | dueño, propios o de la sesión propia | solo RPC | |
| `sales` | dueño o `cashier_id = auth.uid()` | sin escritura directa (`confirm_sale`/`void_sale` RPC) | inmutabilidad + trigger 0008 |
| `sale_items` | dueño o vía venta propia | solo RPC | |
| `held_sales` | dueño o `cashier_id = auth.uid()` | INSERT/UPDATE/DELETE: dueño o fila propia | |
| `stock_movements` | dueño | solo RPC `adjust_stock`/`receive_purchase` | inmutable (trigger 0008) |
| `suppliers`, `purchases`, `purchase_items` | dueño | solo dueño | |
| `audit_log` | dueño | solo RPC `write_audit_log()` (fuerza `auth.uid()`) | inmutable (trigger 0008) |
| todo (`anon`) | sin acceso (revocado en 0015) | — | salvo DB-009 (2 columnas de `business_settings`) |

### 12.5 RPC → EXECUTE grant → chequeo interno

| RPC | Grant | Chequeo interno |
|---|---|---|
| `get_business_public()`, `get_open_cash_session_public()` | authenticated | `private.is_active_staff()` |
| `open_cash_session`, `add_cash_movement`, `close_cash_session` | authenticated | personal activo + validaciones de turno (1 sola sesión abierta) |
| `confirm_sale(...)` | authenticated | personal activo; permiso de descuento por rol (dueño o `cashier_can_discount`) |
| `void_sale`, `adjust_stock`, `receive_purchase`, `products_with_cost()` | authenticated | `get_user_role() = owner` (42501) |
| `write_audit_log(...)` | authenticated | personal activo; fuerza `user_id = auth.uid()` |
| `private.*` (`is_owner`, `is_active_staff`, `get_user_role`, triggers) | revocado a `public`/`anon`/`authenticated` | security definer con `search_path = ''` |

### 12.6 Hallazgos de la revisión y verificación pendiente

1. **DB-010 (brecha corregida con SQL propuesto):** `profiles` tenía `grant update` de todas las columnas y política de fila propia; un cajero podía autoascenderse (`update profiles set role='owner' where id=auth.uid()`) porque el trigger 0009 solo protege al último dueño. Solución: `db/migrations/0017_profile_role_guard.sql` (trigger que exige sesión `owner` para cambiar `role`/`active`). Registrado en `DB_REQUESTS.md` como `PENDIENTE`.
2. **DB-009 (PENDIENTE):** marca en la pantalla de login (`name,logo_url` a `anon`, fila 1).
3. **Observaciones aceptadas (sin corrección):** el personal activo ve la sesión abierta (única del negocio); `full_name` editable por cada usuario; el borrado físico de categorías/productos/proveedores solo ocurre desde la app dueño (la RLS lo permite, no hay caso de uso de borrado contable).
4. **Verificación humana pendiente (E11-01):** ejecutar `docs/RLS_VERIFICATION.sql`, revisar Security Advisor y, tras aplicar DB-010, las 3 comprobaciones de `0017_profile_role_guard.sql` (cajero no puede autoascenderse; puede editar su nombre; dueño puede cambiar roles).

## 13. Revisión final E11-10 (03-nov-2026) — checklist con evidencia

Contra §§1–12 de este documento y OWASP ASVS 4.0.3 (nivel 1: verificable con pruebas automatizadas y revisión estática).

### 13.1 Evidencia por punto

| Punto | Evidencia | Estado |
|---|---|---|
| §1 Modelo de amenazas | Este archivo §1 + `AGENTS.md` §7 invariantes + `docs/ARCHITECTURE.md` | OK |
| §2 Autenticación y sesiones | `auth.test.ts` (mensaje genérico, sin enumerar usuarios, rate limit), `session-hardening.test.ts` (inactividad E1-05, revocación de desactivado, `auth.login_success` auditado), `src/lib/auth/mfa.test.ts` + `components/auth/mfa.test.tsx` (MFA), `security/authz-matrix.int.test.ts` §1–2 | OK |
| §3 Autorización | Matrices §12 de este archivo (E11-01), `security/authz-matrix.int.test.ts`, `requireRole` en cada página `(app)` + `roles` en cada `secureAction` (E11-02), proxy solo refresca sesión | OK |
| §4 Base de datos y RLS | Migraciones 0001–0019 con RLS+GRANT mínimo; `security/rls-checklist.md` + `docs/RLS_VERIFICATION.sql`; **PENDIENTE humano:** aplicar DB-009..DB-012 y pegar resultados | PENDIENTE HUMANO |
| §5 Next.js (1) versiones | **16.4.5** y `eslint-config-next` 16.4.5 (03-nov-2026, November 2026 Security Release); `pnpm audit` **sin vulnerabilidades** (override `minimatch ^11.0.1` por GHSA-g3hv-75wg-m249); **SEC-01:** Node release ALTO del 11-nov-2026 | OK + SEC-01 |
| §5 (2–4) CSRF/validación/rate limit | Mutaciones solo vía Server Actions; Zod `.strict()` en toda frontera (`security/validation.unit.test.ts`); rate limit en login/importación (`rate-limiter.ts`, `session-hardening.test.ts`) | OK |
| §5 (5) Cabeceras | `security/headers.test.ts` (CSP, HSTS, nosniff, frame-ancestors) en `next.config.ts` + proxy | OK |
| §5 (6–7) Secretos y XSS | `security/no-secrets.test.ts`; `server-only` en `supabase/server.ts`; `security/no-dangerous-html.test.ts` (sin `eval`/`dangerouslySetInnerHTML`); URLs de logo validadas por esquema (https) | OK |
| §5 (8–9) CSV | `security/csv-injection.unit.test.ts` (neutraliza `=+-@\t\r`); límites de bytes/filas y cabeceras exigidas (E11-09) | OK |
| §5 (10–11) Errores y logs | `error.tsx`/`not-found.tsx`/`global-error.tsx` sin filtrar errores (E11-07); `secure-action.test.ts` (códigos internos → mensaje genérico); auditoría sin secretos | OK |
| §5 (12–13) Imágenes/redirecciones y dependencias | Sin proxies abiertos; `pnpm audit` en `pnpm check:security`; lockfile versionado | OK |
| §6 Anti-fraude POS | Umbral de descuento con chequeo en app **y** RPC 0019 (E11-08, `sales.test.ts`); auditoría de anulación/ajuste/cobro/rol en SQL 0010–0014 + `security/audit-log.int.test.ts`; diferencia de caja registrada y no editable (cierre vía RPC 0010); costos solo dueño (`products_with_cost()` exige owner); alertas 24 h (E11-08) | OK (DB-012 pendiente) |
| §7 Privacidad | Sin datos de clientes finales (v1); datos demo ficticios en factories; retención/respaldos → decisión humana (E11-11 + E12 cancelado) | PENDIENTE HUMANO |
| §8 Despliegue | `docs/DEPLOY_NEW_CLIENT.md` → sección Seguridad (checklist ejecutable por el humano) | PENDIENTE HUMANO |
| §9 Pruebas obligatorias | `authz-matrix`, **`no-client-trust` (nuevo en E11-10)**, `validation`, `csv-injection`, `headers`, `no-secrets`, `no-dangerous-html`, `audit-log`, `rls-checklist.md` — todos existen y corren en `pnpm check:security` | OK |
| §10 Reglas para el agente | Sin secretos escritos ni pedidos; migraciones con RLS+GRANT; tests de seguridad jamás relajados (E11-10 corrigió controles/faltantes, no los desactivó) | OK |
| §11 Mantenimiento | Fuentes reverificadas hoy (nextjs.org/blog GHSA, nodejs.org); `docs/INCIDENTES.md` creado (E11-11) | OK + SEC-01 |

### 13.2 OWASP ASVS 4.0.3 — nivel 1 aplicable

| Capítulo | Evidencia en LILA MARKET |
|---|---|
| V1 Arquitectura y threat model | `docs/SECURITY.md` §1; controles centralizados (`secureAction`, repos, RLS) |
| V2 Autenticación | Supabase Auth + política ≥12 caracteres; login genérico; rate limit; MFA del dueño (E1-06) |
| V3 Sesiones | Cookies `@supabase/ssr` (HTTPS, `SameSite`); refresco en `proxy.ts`; cierre por inactividad (E1-05); revocación al desactivar |
| V4 Control de acceso | `requireRole` (páginas) + `roles` en cada acción + RLS owner-only (§12); matriz de verificación |
| V5 Validación y codificación | Zod `.strict()` en toda entrada (`validation.unit.test.ts`); escape React; CSV con límites y neutralización |
| V6 Criptografía almacenada | Credenciales gestionadas por Supabase Auth (hashes); la app no guarda contraseñas ni claves |
| V7 Errores y bitácora | Mensajes genéricos al usuario; `audit_log` inmutable de acciones sensibles; sin secretos en logs |
| V8 Protección de datos | `cost_cents` fuera de la vista POS; sin PII de clientes finales; HTTPS obligatorio |
| V9 Comunicación | HSTS + HTTPS en despliegue (§8); cabeceras en `next.config.ts` |
| V10 Código malicioso | Sin `eval`/`new Function`/`dangerouslySetInnerHTML` (`no-dangerous-html.test.ts`); `pnpm audit` limpio |
| V11 Lógica de negocio | Invariantes de `AGENTS.md` §7 con tests (`sales.test`, `void-sale.int.test`, caja); umbral de descuento |
| V12 Archivos y recursos | Sin subida de archivos en v1 (CSV como texto); logo limitado a https/ruta propia; sin SSRF |
| V13 API | Server Actions autenticadas+autorizadas+Zod; sin GraphQL/SOAP; rate limit en acciones costosas |
| V14 Configuración | Cabeceras (`headers.test.ts`), secretos fuera del repo (`no-secrets.test.ts`), `.env.example` |
| Nivel 1 como conjunto | Cubierto por tests automatizados + esta revisión; **quedan verificaciones humanas:** E2E (E11-02), `RLS_VERIFICATION.sql`, Security Advisor, actualización de Node (SEC-01) |

### 13.3 Hallazgos de esta revisión

1. **Corregido en la propia revisión:** Next.js 16.4.3 → **16.4.5** y `eslint-config-next` → 16.4.5 (release de seguridad del mismo día); `minimatch` forzado a `^11.0.1` (GHSA-g3hv-75wg-m249) vía `overrides` en `pnpm-workspace.yaml` → `pnpm audit` limpio.
2. **Corregido en la propia revisión:** `docs/SECURITY.md` §9 referenciaba `security/no-client-trust.int.test.ts` y `security/rls-checklist.md` **sin existir** → creados; ya corren en `check:security`.
3. **SEC-01 (nuevo, humano):** Node.js publicará release de severidad ALTA el **11-nov-2026**; actualizar el runtime de cada despliegue y reverificar `pnpm audit` después.
4. **Sin hallazgos nuevos** contra el OWASP ASVS nivel 1 más allá de los puntos humanos listados en 13.1.
