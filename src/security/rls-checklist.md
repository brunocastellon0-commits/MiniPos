# RLS — checklist de verificación (lo ejecuta el HUMANO)

> Contraparte executable de este checklist: `docs/RLS_VERIFICATION.sql` (solo lectura).
> Ejecutar en el **SQL Editor del proyecto Supabase del cliente** después de aplicar las
> migraciones y antes de cada entrega. Pegar los resultados al agente.
> Cualquier fila devuelta en las consultas 1–4 es un **hallazgo a corregir** (tarea `SEC-xx`).

## Consultas (1..8 de `docs/RLS_VERIFICATION.sql`)

- [ ] **1. Tablas de `public` sin RLS activada** → esperado: 0 filas.
- [ ] **2. Tablas con RLS pero sin ninguna política** → esperado: 0 filas.
- [ ] **3. Privilegios concedidos a `anon` en `public`** → esperado: 0 filas
      (excepción puntual de DB-009, aplicada 2026-11-04: `select (name, logo_url)` de `business_settings`;
      la app solo lee `name` y el logo es la imagen estática `public/logo.png`).
- [ ] **4. Funciones `SECURITY DEFINER` en `public` sin `search_path` fijado** → esperado: 0 filas.
- [ ] **5. Ejecución de funciones de `public`: quién tiene `execute`** → esperado: ninguna
      función sensible otorgada a `anon`/`PUBLIC`.
- [ ] **6. Grants a `authenticated` por tabla** → revisar que solo existan los necesarios
      (sin `update`/`delete`/`insert` donde la app solo lee).
- [ ] **7. Vistas en `public` sin `security_invoker = true`** → esperado: 0 filas.
- [ ] **8. `cost_cents` de `public.products` no concedido a `authenticated`** (vista POS)
      → esperado: 0 filas.

## Además, en el Dashboard de Supabase

- [ ] **Security Advisor**: sin hallazgos críticos/altos pendientes (captura o resumen).
- [ ] Auth → **registro público desactivado**, política de contraseñas ≥ 12, URLs de
      redirección restringidas al dominio real.
- [ ] Las políticas creadas por migración siguen presentes (Security Advisor no reporta
      "RLS sin política" en las tablas nuevas).

## Resultado

- Fecha de ejecución: `<AAAA-MM-DD>`
- Proyecto: `<cliente>`
- Filas devueltas por consulta 1..8: `<0,0,0,0,0,0,0,0>` o detalle del hallazgo
- Security Advisor: `<sin críticos / detalle>`
