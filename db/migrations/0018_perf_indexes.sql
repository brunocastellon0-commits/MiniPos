-- Migración: 0018_perf_indexes.sql
-- Propósito (DB-011, tarea E11-05 · Rendimiento): índices faltantes para los patrones de
-- consulta reales del código (ver src/lib/repos/supabase/*.ts). Los índices base ya fueron
-- creados por 0003–0007 (session, cashier, status, created_at, product, sale, audit, etc.);
-- esta migración solo agrega los 3 huecos comprobados:
--   1. sales.payment_method        → reportes filtran por método de pago junto a fechas.
--   2. held_sales.created_at       → el POS lista ventas pausadas ordenadas por fecha
--                                    (sales.ts listHeldSales); solo existe índice por
--                                    cashier_id, no por fecha.
--   3. profiles.full_name          → el listado de usuarios ordena por nombre (users.ts);
--                                    sin índice, cada listado ordena en memoria.
-- No se indexa sales.client_request_id: la columna ya es UNIQUE (0005), lo que crea su
-- propio índice; uno adicional sería redundante.
-- Idempotente (create index if not exists). No borra ni modifica datos.
-- Escala: para el volumen de un minimarket (≤ ~100 mil filas) los índices simples de una
-- columna son suficientes; no se proponen compuestos para no mantener índices sin uso.

create index if not exists idx_sales_payment_method
  on public.sales (payment_method);

create index if not exists idx_held_sales_created_at
  on public.held_sales (created_at desc);

create index if not exists idx_profiles_full_name
  on public.profiles (full_name);
