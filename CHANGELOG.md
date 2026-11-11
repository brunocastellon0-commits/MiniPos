# Changelog — LILA MARKET

Todas las modificaciones notables de este proyecto se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y sigue [Semantic Versioning](https://semver.org/lang/es/).

---

## [Unreleased]

### Changed
- **E1-07**: Login por **nombre de usuario** (sin correo visible): la pantalla pide "Usuario" y el servidor lo convierte a `<usuario>@lila.market` (`src/lib/auth/login-identity.ts`) para `signInWithPassword`; mensaje genérico "Usuario o contraseña incorrectos."; rate limit por usuario; guía de alta de cuentas actualizada (Auto Confirm, restablecer contraseña desde el Dashboard).

### Added
- **E0-01**: Inicialización de proyecto Next.js 16 con App Router, TypeScript estricto y Tailwind CSS.
- **E0-02**: Tooling de calidad de código con ESLint, Prettier, Vitest + Testing Library y scripts `pnpm check`.
- **E0-03**: Sistema de diseño con tokens CSS y componentes primitivos (`Button`, `Input`, `Badge`, `Card`, `Dialog`, `EmptyState`, `Toast`, `Spinner`, `Kbd`) y vitrina en `/_design`.
- **E0-04**: Módulo de utilidades de dinero (`money.ts`) para manejo estricto de centavos enteros y formato oficial boliviano (`Bs 1.234,50`), y manejo de fechas en `America/La_Paz`.
- **E0-05**: Esquema relacional baseline con migraciones versionadas (`0001` a `0008`), RLS estricta, grants mínimos a `authenticated`, ocultamiento de costos a nivel de columna, vista `products_pos`, triggers de inmutabilidad y tipos TypeScript generados a mano.
- **E0-06**: Clientes oficiales `@supabase/ssr` para navegador y servidor, sincronización de cookies y proxy de sesión en Next.js 16 (`proxy.ts`) con `getClaims()`.
- **E0-07**: Capa de repositorios por agregados con implementación completa en memoria (`MemoryStore`), esqueleto tipado para Supabase y suite de pruebas de contrato compartida.
- **E0-08**: Factorías de entidades de prueba (`factories.ts`) y dataset demo representativo de productos bolivianos (`demo-data.ts`).
- **E0-09**: Documentación técnica (`README.md`, `CHANGELOG.md`) y configuración de CI local.
