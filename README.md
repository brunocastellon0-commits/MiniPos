# LILA MARKET 🛒

Sistema de gestión comercial ágil, seguro y configurable para minimarkets pequeños de Bolivia (Punto de Venta / POS, control de inventario, compras, turnos de caja diaria y reportes gerenciales).

Diseñado bajo arquitectura **single-tenant** (un proyecto Supabase aislado y un despliegue por cada cliente), con dinero manejado estrictamente en **centavos enteros (`*_cents`)**, zona horaria `America/La_Paz` y formato oficial boliviano (`Bs 1.234,50`).

---

## 🚀 Requisitos Previos

- **Node.js**: `>= 20.9.0` (LTS recomendado).
- **Gestor de paquetes**: `pnpm` (`>= 9.x` o `12.x`).

---

## 🛠️ Instalación y Configuración Local

1. **Clonar el repositorio e instalar dependencias:**
   ```bash
   git clone <url-del-repo>
   cd MiniMarket
   pnpm install
   ```

2. **Configurar variables de entorno:**
   Copia la plantilla `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Edita `.env.local` con las claves de tu proyecto Supabase (disponibles en *Project Settings* $\rightarrow$ *Data API*):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-clave-anon-publica
   ```
   > ⚠️ **Seguridad:** NUNCA coloques ni utilices la clave `service_role`. El sistema opera con mínimo privilegio reforzado por RLS.

3. **Aplicar migraciones de base de datos en Supabase:**
   - Abre el **SQL Editor** de tu proyecto Supabase en la web.
   - Ejecuta en orden numérico correlativo los archivos ubicados en `db/migrations/`:
     - `0001_private_helpers.sql`
     - `0002_profiles_and_settings.sql`
     - `0003_catalog.sql`
     - `0004_cash.sql`
     - `0005_sales.sql`
     - `0006_inventory_purchases.sql`
     - `0007_audit.sql`
     - `0008_immutability_triggers.sql`
   - Ejecuta el script de verificación [`docs/RLS_VERIFICATION.sql`](docs/RLS_VERIFICATION.sql) para comprobar que todas las tablas tengan RLS activa y grants mínimos.

4. **Iniciar el entorno de desarrollo:**
   ```bash
   pnpm dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador. Puedes revisar el catálogo de componentes en [http://localhost:3000/_design](http://localhost:3000/_design).

---

## 📋 Comandos Disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Inicia el servidor de desarrollo local en `http://localhost:3000`. |
| `pnpm typecheck` | Verifica tipos TypeScript sin emitir archivos (`tsc --noEmit`). |
| `pnpm lint` | Ejecuta ESLint en todo el proyecto. |
| `pnpm test` | Ejecuta la suite de pruebas unitarias y de integración con Vitest. |
| `pnpm check:security` | Ejecuta auditoría de vulnerabilidades con `pnpm audit` y tests de seguridad. |
| `pnpm build` | Compila la aplicación Next.js para producción. |
| `pnpm check` | **Control total**: corre `typecheck` + `lint` + `test` + `check:security` + `build`. |
| `pnpm format` | Formatea el código fuente con Prettier. |
| `pnpm format:check` | Comprueba que todos los archivos cumplan el formato de Prettier. |

---

## 🏛️ Arquitectura y Seguridad

- **Especificación Funcional y de Arquitectura:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Protocolo y Baseline de Seguridad:** [`docs/SECURITY.md`](docs/SECURITY.md)
- **Guía de Pruebas:** [`docs/TESTING.md`](docs/TESTING.md)
- **Entrega a Nuevos Clientes:** [`docs/DEPLOY_NEW_CLIENT.md`](docs/DEPLOY_NEW_CLIENT.md)
- **Gestión de Cambios de Base de Datos:** [`DB_REQUESTS.md`](DB_REQUESTS.md) y [`BACKLOG.md`](BACKLOG.md)
