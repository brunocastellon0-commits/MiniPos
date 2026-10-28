import type {
  Product,
  Category,
  CashSession,
  CashMovement,
  Sale,
  SaleItem,
  HeldSale,
  StockMovement,
  Supplier,
  Purchase,
  PurchaseItem,
  Profile,
  BusinessSettings,
  AuditLog,
} from "@/lib/repos/types";

let counter = 1;
function uniqueId(prefix = "id"): string {
  return `${prefix}-${counter++}-${Date.now().toString(36)}`;
}

export function buildCategory(overrides: Partial<Category> = {}): Category {
  const id = overrides.id || uniqueId("cat");
  const now = new Date().toISOString();
  return {
    id,
    name: overrides.name || `Categoría ${id.slice(-4)}`,
    sort_order: overrides.sort_order ?? 0,
    active: overrides.active ?? true,
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  };
}

export function buildProduct(overrides: Partial<Product> = {}): Product {
  const id = overrides.id || uniqueId("prod");
  const now = new Date().toISOString();
  return {
    id,
    name: overrides.name || `Producto ${id.slice(-4)}`,
    barcode: overrides.barcode ?? null,
    internal_code: overrides.internal_code ?? null,
    category_id: overrides.category_id ?? null,
    unit_label: overrides.unit_label ?? "unidad",
    price_cents: overrides.price_cents ?? 1000,
    cost_cents: overrides.cost_cents !== undefined ? overrides.cost_cents : 700,
    stock_qty: overrides.stock_qty ?? 10,
    min_stock: overrides.min_stock ?? 5,
    active: overrides.active ?? true,
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  };
}

export function buildCashSession(overrides: Partial<CashSession> = {}): CashSession {
  const id = overrides.id || uniqueId("session");
  const now = new Date().toISOString();
  const status = overrides.status || "open";
  const isClosed = status === "closed";

  const openingCents = overrides.opening_cents ?? 10000;
  const countedCents = isClosed ? (overrides.counted_cash_cents ?? openingCents) : null;
  const expectedCents = isClosed ? (overrides.expected_cash_cents ?? openingCents) : null;
  const diffCents =
    isClosed && countedCents !== null && expectedCents !== null
      ? (overrides.difference_cents ?? countedCents - expectedCents)
      : null;

  return {
    id,
    opened_by: overrides.opened_by || "user-cashier-1",
    opened_at: overrides.opened_at || now,
    opening_cents: openingCents,
    closed_by: isClosed ? overrides.closed_by || "user-cashier-1" : null,
    closed_at: isClosed ? overrides.closed_at || now : null,
    expected_cash_cents: expectedCents,
    counted_cash_cents: countedCents,
    difference_cents: diffCents,
    status,
    notes: overrides.notes ?? null,
    created_at: overrides.created_at || now,
  };
}

export function buildCashMovement(overrides: Partial<CashMovement> = {}): CashMovement {
  const id = overrides.id || uniqueId("mov");
  const now = new Date().toISOString();
  return {
    id,
    session_id: overrides.session_id || "session-1",
    kind: overrides.kind || "in",
    amount_cents: overrides.amount_cents ?? 2000,
    reason: overrides.reason || "Ingreso para cambio",
    user_id: overrides.user_id || "user-1",
    created_at: overrides.created_at || now,
  };
}

export function buildSale(overrides: Partial<Sale> = {}): Sale {
  const id = overrides.id || uniqueId("sale");
  const now = new Date().toISOString();
  const subtotal = overrides.subtotal_cents ?? 2500;
  const discount = overrides.discount_cents ?? 0;
  const total = overrides.total_cents ?? subtotal - discount;
  const isVoided = overrides.status === "voided";

  return {
    id,
    number: overrides.number ?? 101,
    session_id: overrides.session_id || "session-1",
    cashier_id: overrides.cashier_id || "user-cashier-1",
    status: overrides.status || "paid",
    subtotal_cents: subtotal,
    discount_cents: discount,
    total_cents: total,
    payment_method: overrides.payment_method || "cash",
    cash_received_cents:
      overrides.payment_method === "cash" ? (overrides.cash_received_cents ?? total + 1000) : null,
    client_request_id: overrides.client_request_id || uniqueId("req"),
    voided_by: isVoided ? overrides.voided_by || "owner-1" : null,
    voided_at: isVoided ? overrides.voided_at || now : null,
    void_reason: isVoided ? overrides.void_reason || "Cancelación" : null,
    created_at: overrides.created_at || now,
  };
}

export function buildSaleItem(overrides: Partial<SaleItem> = {}): SaleItem {
  const id = overrides.id || uniqueId("item");
  const unitPrice = overrides.unit_price_cents ?? 1250;
  const qty = overrides.quantity ?? 2;
  return {
    id,
    sale_id: overrides.sale_id || "sale-1",
    product_id: overrides.product_id || "prod-1",
    name_snapshot: overrides.name_snapshot || "Coca-Cola 2L",
    unit_price_cents: unitPrice,
    quantity: qty,
    line_total_cents: overrides.line_total_cents ?? unitPrice * qty,
  };
}

export function buildHeldSale(overrides: Partial<HeldSale> = {}): HeldSale {
  const id = overrides.id || uniqueId("held");
  const now = new Date().toISOString();
  return {
    id,
    cashier_id: overrides.cashier_id || "user-cashier-1",
    label: overrides.label || "Venta pendiente mesa 1",
    items: overrides.items || "[]",
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  };
}

export function buildStockMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  const id = overrides.id || uniqueId("smov");
  const now = new Date().toISOString();
  return {
    id,
    product_id: overrides.product_id || "prod-1",
    kind: overrides.kind || "sale",
    delta: overrides.delta ?? -2,
    reason: overrides.reason || "Venta",
    ref_type: overrides.ref_type || "sale",
    ref_id: overrides.ref_id || "sale-1",
    user_id: overrides.user_id || "user-1",
    created_at: overrides.created_at || now,
  };
}

export function buildSupplier(overrides: Partial<Supplier> = {}): Supplier {
  const id = overrides.id || uniqueId("supp");
  const now = new Date().toISOString();
  return {
    id,
    name: overrides.name || "Distribuidora Embol S.A.",
    phone: overrides.phone ?? "70012345",
    notes: overrides.notes ?? "Entrega los días martes",
    active: overrides.active ?? true,
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  };
}

export function buildPurchase(overrides: Partial<Purchase> = {}): Purchase {
  const id = overrides.id || uniqueId("pur");
  const now = new Date().toISOString();
  return {
    id,
    supplier_id: overrides.supplier_id || "supp-1",
    status: overrides.status || "draft",
    notes: overrides.notes ?? null,
    total_cents: overrides.total_cents ?? 50000,
    created_by: overrides.created_by || "owner-1",
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  };
}

export function buildPurchaseItem(overrides: Partial<PurchaseItem> = {}): PurchaseItem {
  const id = overrides.id || uniqueId("pitem");
  const ordered = overrides.qty_ordered ?? 24;
  return {
    id,
    purchase_id: overrides.purchase_id || "pur-1",
    product_id: overrides.product_id || "prod-1",
    qty_ordered: ordered,
    qty_received: overrides.qty_received ?? 0,
    unit_cost_cents: overrides.unit_cost_cents ?? 850,
  };
}

export function buildProfile(overrides: Partial<Profile> = {}): Profile {
  const id = overrides.id || uniqueId("user");
  const now = new Date().toISOString();
  return {
    id,
    full_name: overrides.full_name || "Juan Pérez",
    role: overrides.role || "cashier",
    active: overrides.active ?? true,
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  };
}

export function buildBusinessSettings(overrides: Partial<BusinessSettings> = {}): BusinessSettings {
  const now = new Date().toISOString();
  return {
    id: 1,
    name: overrides.name || "Minimarket Los Pinos",
    legal_name: overrides.legal_name ?? "Los Pinos S.R.L.",
    currency_code: overrides.currency_code || "BOB",
    currency_symbol: overrides.currency_symbol || "Bs",
    logo_url: overrides.logo_url ?? null,
    allow_negative_stock: overrides.allow_negative_stock ?? false,
    low_stock_default: overrides.low_stock_default ?? 5,
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  };
}

export function buildAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  const id = overrides.id || uniqueId("audit");
  const now = new Date().toISOString();
  return {
    id,
    at: overrides.at || now,
    user_id: overrides.user_id || "user-1",
    action: overrides.action || "price_change",
    entity: overrides.entity || "products",
    entity_id: overrides.entity_id ?? "prod-1",
    summary: overrides.summary || JSON.stringify({ old_price: 1000, new_price: 1200 }),
    reason: overrides.reason ?? "Ajuste inflacionario",
  };
}
