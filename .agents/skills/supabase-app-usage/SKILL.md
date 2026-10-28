---
name: supabase-app-usage
description: Úsala al escribir código de la aplicación que consume Supabase (clientes SSR, Auth, repositorios, RPC, tipos, RLS vista desde la app). No sirve para modificar la BD; para eso ver db-boundary.
---

# supabase-app-usage — Consumir Supabase desde Next.js (sin operarlo)

> Verifica en https://supabase.com/docs/guides/auth/server-side/nextjs si dudas. Usa solo `@supabase/ssr` y `@supabase/supabase-js`. **No** uses `@supabase/auth-helpers-*`.

## Clientes (uno por entorno, en `src/lib/supabase/`)
- `client.ts` → `createBrowserClient(URL, PUBLISHABLE_KEY)` para Client Components.
- `server.ts` → `createServerClient` con `cookies()` (`await`) y adaptador `getAll`/`setAll` (no usar `get/set/remove`). `setAll` envuelto en try/catch porque Server Components no pueden escribir cookies.
- `proxy.ts` (lib) → refresca la sesión en cada request llamando `supabase.auth.getClaims()` y propaga cookies a la respuesta. **No ejecutes código entre crear el cliente y `getClaims()`.**
- Claves: la **publishable key** (o anon legacy) es pública y segura **solo con RLS correcta**. La **secret/service_role** no existe para ti ni para el código del repo.

## Cuándo usar qué
| Situación | Método |
|---|---|
| Proxy / lectura en Server Component | `getClaims()` |
| Server Action o Route Handler que escribe | `getUser()` (valida con el servidor de Auth) y rol desde `profiles` |
| Nunca para decidir autorización | `getSession()` ni datos del cliente |

## Repositorios
- Interfaz en `lib/repos/<x>.ts`; implementación Supabase en `lib/repos/supabase/`; memoria en `lib/repos/memory/`.
- Las consultas usan los tipos de `src/types/database.ts` (escritos a mano según migraciones `APLICADA`).
- Para operaciones multi-tabla usa `supabase.rpc('confirm_sale', {...})`. Si la RPC no existe aún → `BLOCKED-DB` y 🚨 (ver `db-boundary`).
- Maneja `error` de cada llamada: convierte códigos conocidos (`23505` unique, `P0001` excepciones de RPC) en errores de dominio con mensaje en español. Nunca expongas `error.message` crudo.
- Selecciona solo columnas necesarias (`select('id,name,price_cents')`), nunca `select('*')` en rutas calientes. Para el POS usa la vista `products_pos` (sin costos).
- Paginación con `range()`; búsqueda con `ilike` o texto completo según índices aprobados.

## Seguridad vista desde la app
- RLS es la última defensa, pero **valida rol también en la Server Action**.
- Cada tabla debe tener políticas; si descubres una tabla accesible sin política, repórtalo con 🚨.
- No guardes tokens ni datos sensibles en `localStorage`.
- Subidas (logo): si se usa Storage, requiere bucket y políticas → solicitud 🚨.

## Tipos
Mantén `src/types/database.ts` sincronizado con cada migración. Si el humano ejecuta la generación de tipos oficial y te la entrega, reemplaza el archivo.
