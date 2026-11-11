-- Migración: 0021_wipe_test_data.sql
-- Propósito (DB-014): dejar la base de datos LIMPIA para entregar a un cliente nuevo,
--   borrando todos los datos de prueba (transaccionales, catálogo, configuración y usuarios).
-- ⚠️ DESTRUCTIVO — UNA SOLA VEZ. No es una migración de esquema:
--   - NO incluir en db/schema.sql ni consolidar con las demás.
--   - NO aplicar en bases de clientes existentes ni en un entorno con datos reales.
-- Por qué se usa TRUNCATE y no DELETE: los triggers de inmutabilidad (0008, 0020) y los
--   de profiles (0009, 0017) son BEFORE DELETE; TRUNCATE no dispara triggers de fila,
--   por eso borra todo sin tocar los controles de seguridad (siguen activos después).
-- Ejecutar en el SQL Editor de Supabase, en orden: Bloque A → B → C → D.

-- ============================================================
-- BLOQUE A — Borrar todas las tablas de datos (16) y resetear contadores
-- ============================================================
truncate table
  public.audit_log,
  public.order_items,
  public.orders,
  public.sale_items,
  public.sales,
  public.held_sales,
  public.cash_movements,
  public.cash_sessions,
  public.purchase_items,
  public.purchases,
  public.stock_movements,
  public.products,
  public.categories,
  public.suppliers,
  public.business_settings,
  public.profiles
restart identity cascade;
-- restart identity: sales.number y orders.order_number vuelven a empezar en 1.

-- ============================================================
-- BLOQUE B — Recrear la fila singleton de configuración del negocio
-- ============================================================
-- La app NO puede insertar esta fila (RLS insert with check (false), ver 0002);
-- sin ella la pantalla de login no tiene nombre del negocio. Mismos valores del
-- seed del 0002. El cliente luego la edita desde Configuración.
insert into public.business_settings (
  id, name, legal_name, currency_code, currency_symbol, logo_url, allow_negative_stock, low_stock_default
) values (
  1, 'Mi Minimarket', null, 'BOB', 'Bs', null, false, 5
) on conflict (id) do nothing;

-- ============================================================
-- BLOQUE C — Borrar usuarios de prueba (auth)
-- ============================================================
-- Requiere sesión en el SQL Editor. Si termina con
--   ERROR: permission denied for table users
-- → borrar a mano: Dashboard → Authentication → Users → Delete (por cada usuario),
--   o con la Admin API del humano (service_role en el gestor de secretos; el agente
--   no toca claves). La cascada de auth.users limpia identities y sessions.
delete from auth.users;

-- ============================================================
-- BLOQUE D — Crear el dueño nuevo (DESPUÉS de borrar usuarios)
-- ============================================================
-- 1) Dashboard → Authentication → Add user → Create new user
--      email/contraseña del cliente, "Auto Confirm User" activado, y en
--      User Metadata poner:  "full_name": "Nombre del Dueño"
--    (el trigger on_auth_user_created crea la fila en profiles con rol 'cashier')
-- 2) Obtener su UUID aquí:
--      select id, email from auth.users;
-- 3) Promoverlo a dueño (bloque con placeholder; ejecutar completo):
--
-- alter table public.profiles disable trigger trg_guard_profile_role_change;
-- update public.profiles
--    set role = 'owner', active = true
--  where id = '<PONER_UUID_AQUI>';
-- alter table public.profiles enable trigger trg_guard_profile_role_change;
--
-- Nota: el disable/enable es necesario porque el trigger 0017 exige una sesión
--   'owner' para cambiar roles y en el SQL Editor no hay JWT (auth.uid() = null).
--   Siempre re-habilitarlo; es una operación única de entrega.

-- ============================================================
-- VERIFICACIÓN (esperado)
-- ============================================================
-- select 'profiles' t, count(*) n from public.profiles
-- union all select 'business_settings', count(*) from public.business_settings
-- union all select 'categories', count(*) from public.categories
-- union all select 'products', count(*) from public.products
-- union all select 'suppliers', count(*) from public.suppliers
-- union all select 'sales', count(*) from public.sales
-- union all select 'sale_items', count(*) from public.sale_items
-- union all select 'held_sales', count(*) from public.held_sales
-- union all select 'cash_sessions', count(*) from public.cash_sessions
-- union all select 'cash_movements', count(*) from public.cash_movements
-- union all select 'stock_movements', count(*) from public.stock_movements
-- union all select 'purchases', count(*) from public.purchases
-- union all select 'purchase_items', count(*) from public.purchase_items
-- union all select 'orders', count(*) from public.orders
-- union all select 'order_items', count(*) from public.order_items
-- union all select 'audit_log', count(*) from public.audit_log;
-- → todo 0 excepto business_settings = 1
-- select count(*) from auth.users;          → 0 (o solo el dueño nuevo)
-- select id, name from public.business_settings;  → 1 fila 'Mi Minimarket'
