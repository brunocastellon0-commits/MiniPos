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

1. **Versiones parcheadas obligatorias.** Next.js ha tenido en 2025-2026 fallos críticos (RCE, bypass de middleware/proxy, CSRF de Server Actions, DoS). Referencia a 27-oct-2026: línea 16.x ≥ **16.4.1** (parche del 14-oct-2026 para dos RCE críticos y un DoS en Server Actions) — *verificar la última versión parcheada en https://nextjs.org/blog y en los avisos de GitHub (GHSA) antes de fijar versión*. Node.js: usar la última versión de seguridad de la línea LTS (tras los lanzamientos de seguridad del 21-oct-2026; verificar en nodejs.org).
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
