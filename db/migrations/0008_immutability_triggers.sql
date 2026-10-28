-- Migración: 0008_immutability_triggers.sql
-- Propósito: Triggers a nivel de base de datos para garantizar inmutabilidad contable, fiscal y de auditoría.
-- Invariantes protegidos:
--   - No se permite DELETE en ventas (sales), turnos de caja (cash_sessions), órdenes de compra (purchases) ni configuración (business_settings).
--   - No se permite UPDATE ni DELETE en líneas de venta (sale_items), movimientos de caja (cash_movements),
--     movimientos de inventario (stock_movements) ni bitácora de auditoría (audit_log).
--   - Toda corrección o reversa debe realizarse mediante contraasientos o estados explícitos ('voided', 'cancelled').

-- 1. Ventas e ítems de venta
drop trigger if exists trg_sales_prevent_delete on public.sales;
create trigger trg_sales_prevent_delete
  before delete on public.sales
  for each row execute function private.prevent_delete();

drop trigger if exists trg_sale_items_immutable on public.sale_items;
create trigger trg_sale_items_immutable
  before update or delete on public.sale_items
  for each row execute function private.prevent_update_or_delete();

-- 2. Turnos y movimientos de efectivo
drop trigger if exists trg_cash_sessions_prevent_delete on public.cash_sessions;
create trigger trg_cash_sessions_prevent_delete
  before delete on public.cash_sessions
  for each row execute function private.prevent_delete();

drop trigger if exists trg_cash_movements_immutable on public.cash_movements;
create trigger trg_cash_movements_immutable
  before update or delete on public.cash_movements
  for each row execute function private.prevent_update_or_delete();

-- 3. Inventario y compras
drop trigger if exists trg_stock_movements_immutable on public.stock_movements;
create trigger trg_stock_movements_immutable
  before update or delete on public.stock_movements
  for each row execute function private.prevent_update_or_delete();

drop trigger if exists trg_purchases_prevent_delete on public.purchases;
create trigger trg_purchases_prevent_delete
  before delete on public.purchases
  for each row execute function private.prevent_delete();

-- 4. Bitácora de auditoría
drop trigger if exists trg_audit_log_immutable on public.audit_log;
create trigger trg_audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function private.prevent_update_or_delete();

-- 5. Configuración del negocio (singleton id=1 nunca debe eliminarse)
drop trigger if exists trg_business_settings_prevent_delete on public.business_settings;
create trigger trg_business_settings_prevent_delete
  before delete on public.business_settings
  for each row execute function private.prevent_delete();
