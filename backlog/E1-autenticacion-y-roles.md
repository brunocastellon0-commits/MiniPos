# E1 — Autenticación y roles

> Especificación de las tareas de esta épica. **El estado vive en `BACKLOG.md` (índice)**; la evidencia, en `backlog/PROGRESS.md`. Lee este archivo solo cuando trabajes en esta épica.

- **E1-01 · Pantalla de login** · Deps: E0-03, E0-06 · DB: no (usa Auth)
  Aceptación: email/contraseña, errores claros en español, estado de carga, sin enumerar usuarios; logo y nombre desde `business_settings` con valor por defecto "LILA MARKET".
  Tests: componente (estados); acción con repo simulado.
- **E1-02 · Sesión, `getCurrentUser`, `requireRole`** · Deps: E0-07 · DB: no
  Aceptación: `requireRole('owner')` lanza/redirige en servidor; usuario inactivo no entra; `getClaims()` en proxy y `getUser()` en escrituras.
  Tests: `auth/roles.int.test.ts`.
- **E1-03 · Layout autenticado con navegación por rol** · Deps: E1-02, E0-03 · DB: no
  Aceptación: cabecera (negocio, estado de caja, turno, notificaciones, usuario) y navegación agrupada Operación / Gestión / Análisis / Administración (plan §10); cajero solo ve Caja, Historial propio y Turno; dueño ve todo; ruta prohibida → redirección con mensaje.
  Tests: render por rol; acceso directo a URL prohibida.
- **E1-05 · Endurecimiento de sesión y login** · Deps: E1-01, E0-12 · DB: no (auditoría usa tabla baseline)
  Aceptación: mensajes genéricos; límite de intentos por IP+correo; cierre por inactividad configurable (default 15 min) sin perder ventas pausadas; usuario desactivado pierde acceso inmediatamente; eventos relevantes a `audit_log`.
  Tests: intentos excedidos, expiración, inactivo.
- **E1-06 · MFA (TOTP) para el dueño** · Deps: E1-05 · DB: no (Auth) — inscripción, verificación y recomendación en onboarding; el humano lo habilita en Auth. Tests con cliente simulado.
- **E1-04 · Gestión de usuarios (dueño)** · Deps: E1-03 · DB: **posible**
  Aceptación: listar usuarios, activar/desactivar, cambiar rol, nombre. Alta: según D-009 el humano crea el usuario en Auth; la pantalla guía el paso y permite asignar rol al aparecer en `profiles`. No usar service_role. Si se necesita una función SQL (ej. `set_user_role` con chequeo de dueño), proponerla con 🚨.
  Tests: no se puede quitar el último dueño; cajero no accede.
