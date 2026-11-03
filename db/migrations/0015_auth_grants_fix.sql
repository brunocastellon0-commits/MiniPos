-- Migración: 0015_auth_grants_fix.sql
-- Propósito (DB-008): corregir permisos SQL del rol `authenticated` para que las
-- políticas RLS y las consultas legítimas de la aplicación funcionen, sin debilitar
-- la seguridad ni exponer el esquema `private` a la Data API.
-- Contexto: varios arreglos se aplicaron a mano en la BD y no estaban versionados
-- (drift), y el GRANT manual de SELECT sobre `products` a nivel de tabla filtraba
-- la columna `cost_cents` a cualquier usuario autenticado (incluido el cajero).
-- Idempotente: solo GRANT/REVOKE; no crea tablas ni datos.

-- 1. Esquema `private`: las políticas RLS de categories, products, cash_sessions,
--    held_sales, profiles, sales, etc. llaman private.is_owner() y
--    private.is_active_staff() desde la consulta del usuario, por lo que
--    `authenticated` necesita USAGE en el esquima y EXECUTE en esas dos funciones.
--    Sin esto: "permission denied" al evaluar cualquier política.
--    El esquema `private` NO se publica en la Data API (Supabase solo expone `public`).
create schema if not exists private;
grant usage on schema private to authenticated;
revoke all on schema private from public, anon;

-- Reafirmar que el resto de funciones internas NUNCA se ejecuten desde la app:
-- get_user_role() solo se llama dentro de RPCs SECURITY DEFINER (dueño de la
-- función); prevent_delete()/prevent_update_or_delete() son funciones de trigger.
revoke execute on function private.get_user_role() from public, anon, authenticated;
revoke execute on function private.prevent_delete() from public, anon, authenticated;
revoke execute on function private.prevent_update_or_delete() from public, anon, authenticated;

-- Las dos funciones que sí usan las políticas RLS:
grant execute on function private.is_owner() to authenticated;
grant execute on function private.is_active_staff() to authenticated;

-- 2. `products`: restaurar el grant de columna de 0003 SIN `cost_cents`.
--    Un GRANT SELECT a nivel de tabla (aplicado a mano) permite leer cost_cents
--    vía PostgREST a cualquier autenticado, y el cajero no debe ver costos.
--    `cost_cents` se obtiene solo vía public.products_with_cost() (SECURITY
--    DEFINER con chequeo de private.is_owner()).
revoke all on public.products from public, anon, authenticated;
grant select (
  id, name, barcode, internal_code, category_id, unit_label,
  price_cents, stock_qty, min_stock, active, created_at, updated_at
) on public.products to authenticated;
grant insert, update, delete on public.products to authenticated;
-- (INSERT/UPDATE/DELETE a nivel de tabla están además restringidos por RLS:
--  las políticas de products exigen private.is_owner() para escribir.)

-- 3. Vista POS (la usan los cajeros; sin costos, solo activos):
revoke all on public.products_pos from public, anon;
grant select on public.products_pos to authenticated;

-- 4. `anon` sin acceso a ninguna tabla de negocio (idempotente, solo revoca).
revoke all on public.profiles, public.business_settings, public.categories,
  public.products_pos, public.sales, public.sale_items, public.held_sales,
  public.cash_sessions, public.cash_movements, public.stock_movements,
  public.purchases, public.purchase_items, public.suppliers, public.audit_log
  from anon;
