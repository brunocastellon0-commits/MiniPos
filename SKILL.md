---
name: security-baseline
description: Obligatoria en TODA tarea que toque autenticación, roles, Server Actions, Route Handlers, RPC/SQL, RLS, GRANTs, formularios, importación/exportación CSV, cabeceras, dependencias, variables de entorno o datos de usuarios/dinero. Define el protocolo de seguridad vigente de LILA MARKET.
---

# security-baseline

Lee `docs/SECURITY.md` completo la primera vez; luego usa esta lista como control rápido.

## Checklist por tipo de cambio

**Toda Server Action / Route Handler**
- [ ] Orden: autenticar → autorizar (rol/activo) → validar con Zod `.strict()` → ejecutar → auditar.
- [ ] No acepta `role`, `user_id`, precios, totales, estado desde el cliente; se derivan o recalculan en servidor.
- [ ] Mutaciones por POST/Server Action, nunca GET. Rate limit si es público o costoso.
- [ ] Errores genéricos al usuario; sin datos sensibles en logs.
- [ ] Test en `security/authz-matrix` (sin sesión, cajero, inactivo, dueño).

**Toda migración SQL**
- [ ] `enable row level security` + políticas explícitas por rol.
- [ ] `GRANT` explícito y mínimo (solo `authenticated`; nunca `anon` sin justificación). Desde el 30-oct-2026 Supabase no expone tablas nuevas sin grant.
- [ ] Funciones `security definer`: `set search_path = ''` (o fijo), chequeo de rol interno, `revoke execute ... from public, anon`, `grant execute ... to authenticated`; auxiliares en esquema `private`.
- [ ] Vistas con `security_invoker = true` (si aplica).
- [ ] `check`/FK/únicos como última defensa; sin `delete` de datos contables; auditoría solo-insert.
- [ ] Se añade la tabla/función a `docs/RLS_VERIFICATION.sql` si hace falta y se pide al humano ejecutarla (🚨).

**Frontend**
- [ ] Sin `dangerouslySetInnerHTML`/`eval`; texto siempre escapado; URLs externas validadas.
- [ ] Ocultar un botón no es seguridad: la autorización vive en servidor + RLS.
- [ ] Cierre de sesión por inactividad respetado.

**Dependencias / configuración**
- [ ] `pnpm audit` sin críticas/altas antes de cerrar. Dependencia nueva = justificarla.
- [ ] Next.js y Node en versión parcheada (verificar avisos oficiales; no confiar en tu memoria de versiones).
- [ ] Ningún secreto en repo ni en `NEXT_PUBLIC_*`.
- [ ] CSP/HSTS/nosniff/frame-ancestors presentes; `next.config`/`proxy` con test.

**Importar/exportar**
- [ ] CSV: límites de tamaño/filas, validación por fila, neutralización de fórmulas al exportar.

## Reglas de oro
1. En duda, el lado más restrictivo; reporta al humano.
2. Nunca relajar un control para que pase un test.
3. Vulnerabilidad detectada ⇒ avisa y crea tarea `SEC-xx`.
4. Nunca solicites ni uses `service_role`. Nunca desactives RLS, ni "temporalmente".
