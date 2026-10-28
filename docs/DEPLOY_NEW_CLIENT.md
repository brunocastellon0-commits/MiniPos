# DEPLOY_NEW_CLIENT.md — Entregar LILA MARKET a un cliente nuevo

> Procedimiento **del humano**. El agente solo mantiene este documento y los artefactos (`db/schema.sql`, `db/seed_demo.sql`, `.env.example`) actualizados.

## Checklist (≈ 45–60 min por cliente una vez maduro el proceso)

1. **Crear proyecto Supabase** del cliente (región más cercana disponible). Anotar URL y publishable key.
2. **Aplicar el esquema:** SQL Editor → pegar `db/schema.sql` (consolidado) → ejecutar. Verificar que RLS esté activa en todas las tablas.
3. **Crear usuarios** en Auth (dueño, y cajero si aplica) y asignar rol en `profiles` (script `db/create_first_owner.sql` con placeholders).
4. **Configurar negocio:** nombre, logo, moneda en `business_settings`.
5. **Variables de entorno** en el hosting (ej. Vercel u otro): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
6. **Desplegar** la misma versión etiquetada del código (`git tag vX.Y.Z`). No hacer forks por cliente.
7. **Carga inicial:** importar productos (plantilla CSV `docs/plantilla_productos.csv` + pantalla de importación) o cargar a mano.
8. **Prueba de humo en producción** (lista abajo).
9. **Capacitación** (1 h) con `docs/MANUAL_USUARIO.md` y `docs/GUIA_CAPACITACION.md`; entregar acta de capacitación.
10. **Respaldo:** documentar cómo se respalda la BD del cliente y dejarlo por escrito (ver decisión D-006).

## Seguridad (obligatorio antes de entregar; detalle en `docs/SECURITY.md`)

- [ ] Auth: **registro público desactivado**; contraseña mínima 12; protección contra contraseñas filtradas si el plan lo permite; confirmación de correo; URLs de redirección solo al dominio real.
- [ ] MFA activado para la cuenta del dueño.
- [ ] Migraciones aplicadas en orden; ejecutado `docs/RLS_VERIFICATION.sql` (consultas 1-4 sin filas) y **Security Advisor** sin hallazgos críticos.
- [ ] `service_role` NO configurada en el hosting de la app. Variables de entorno propias del cliente.
- [ ] HTTPS forzado y cabeceras de seguridad verificadas (p. ej. con las herramientas de desarrollador del navegador).
- [ ] `pnpm audit` limpio y versiones de Next.js/Node verificadas contra avisos oficiales a la fecha de entrega.
- [ ] Respaldos configurados y **restauración probada** al menos una vez.
- [ ] Credenciales entregadas por canal seguro; cambio de contraseña inicial obligatorio.

## Prueba de humo

- Login dueño y cajero · abrir turno · vender y cobrar · stock descontado · cerrar turno · panel muestra la venta · cajero no entra a reportes.

## Qué NO se promete (alineado con el plan §6.3)

Soporte ilimitado, disponibilidad garantizada, funciones futuras sin acuerdo previo. Definir por escrito: periodo de asistencia inicial, costo de servicios posteriores, política de actualizaciones.

## Actualizar clientes existentes

Cada cambio de BD = nueva migración numerada + nota de "migración para clientes existentes" en `CHANGELOG.md`. Las migraciones nunca se reescriben una vez entregadas.
