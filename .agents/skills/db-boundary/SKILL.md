---
name: db-boundary
description: Obligatoria siempre que una tarea implique tablas, columnas, funciones SQL, políticas RLS, RPC, storage, usuarios de Auth, migraciones o datos de Supabase. Define el protocolo para NO tocar la base de datos y pedir cambios al humano con aviso en mayúsculas.
---

# db-boundary — El agente nunca toca Supabase

## Hechos
- La BD está en la nube; tú solo ves el repositorio local. No tienes credenciales ni acceso. Intentar usarlo = alucinar.
- El único canal para cambiar la BD es: **SQL en `db/migrations/` + entrada en `DB_REQUESTS.md` + aviso al humano**.

## Prohibido (sin excepciones)
CLI `supabase`, `psql`, `curl`/`wget` a `*.supabase.co`, leer/crear `.env*`, `service_role`, seeds ejecutables, MCP de Supabase, "probar" una consulta contra la BD real, asumir que existe algo no `APLICADA`.

## Protocolo paso a paso
1. **¿Existe ya?** Busca en `db/migrations/` y en `DB_REQUESTS.md`. Si existe y está `APLICADA`, úsalo.
2. **Si falta:** crea `db/migrations/NNNN_verbo_objeto.sql` (siguiente número libre). Reglas del SQL:
   - Una responsabilidad por archivo. Comentarios en español que expliquen el porqué.
   - `create table if not exists`, `create or replace function`, `drop policy if exists` antes de recrear.
   - **RLS activada** en toda tabla nueva (`alter table ... enable row level security`) con políticas explícitas por rol.
   - **GRANT explícito y mínimo** por tabla/vista/función a `authenticated` (Supabase dejó de exponer tablas nuevas automáticamente; sin grant la app recibe `permission denied`). Nunca `anon` sin justificación.
   - Funciones `security definer` solo si hacen chequeo de rol dentro, con `set search_path = ''` (nombres calificados), `revoke execute ... from public, anon` y `grant execute ... to authenticated`. Auxiliares de permisos en esquema `private`.
   - Sin `delete` de datos contables; auditoría solo-insert; `check`/FK/únicos como defensa final.
   - Dinero en `*_cents bigint`. Claves foráneas e índices para columnas de filtro.
   - Nunca `drop table`/`drop column`/`delete` masivo sin marcar "DESTRUCTIVO" en la entrada y explicar impacto.
3. **Registra** en `DB_REQUESTS.md` con la plantilla (estado `PENDIENTE`).
4. **Actualiza tipos** a mano en `src/types/database.ts` para que el código compile.
5. **Marca** la tarea `BLOCKED-DB` si no puede completarse sin la BD; sigue con otra tarea independiente.
6. **Avisa** en tu respuesta con esta línea exacta, sola:

```
🚨 CAMBIO EN BASE DE DATOS REQUERIDO — ACCIÓN DEL HUMANO 🚨
```
   Luego: ID `DB-00X`, archivo, resumen en 2-3 líneas, y cómo verificar (un `select` que el humano pueda ejecutar).
7. Espera `APLICADA DB-00X` del humano antes de marcar el estado.

## Errores de BD reportados por el humano
Si el humano pega un error al aplicar: crea una **nueva** migración correctiva; no edites una ya aplicada. Si aún no se aplicó (estado `PENDIENTE`), puedes corregir el mismo archivo.

## Recordatorio
Que la app, al ejecutarse en la PC del humano, hable con Supabase es normal: eso es *código de la aplicación*, no tú operando la BD.
