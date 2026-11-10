import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";

export interface UserContext {
  id: string;
  role: "owner" | "cashier";
  active: boolean;
}

export type Product = Tables<"products">;
export type ProductInsert = TablesInsert<"products">;
export type ProductUpdate = TablesUpdate<"products">;

export type Category = Tables<"categories">;
export type CategoryInsert = TablesInsert<"categories">;
export type CategoryUpdate = TablesUpdate<"categories">;

export type CashSession = Tables<"cash_sessions">;
export type CashSessionInsert = TablesInsert<"cash_sessions">;

export type CashMovement = Tables<"cash_movements">;
export type CashMovementInsert = TablesInsert<"cash_movements">;

export type Sale = Tables<"sales">;
export type SaleInsert = TablesInsert<"sales">;

export type SaleItem = Tables<"sale_items">;
export type SaleItemInsert = TablesInsert<"sale_items">;

export type HeldSale = Tables<"held_sales">;
export type HeldSaleInsert = TablesInsert<"held_sales">;

export type StockMovement = Tables<"stock_movements">;
export type StockMovementInsert = TablesInsert<"stock_movements">;

export type Supplier = Tables<"suppliers">;
export type SupplierInsert = TablesInsert<"suppliers">;
export type SupplierUpdate = TablesUpdate<"suppliers">;

export type Purchase = Tables<"purchases">;
export type PurchaseInsert = TablesInsert<"purchases">;
export type PurchaseUpdate = TablesUpdate<"purchases">;

export type PurchaseItem = Tables<"purchase_items">;
export type PurchaseItemInsert = TablesInsert<"purchase_items">;

export type Profile = Tables<"profiles">;
export type ProfileUpdate = TablesUpdate<"profiles">;

export type BusinessSettings = Tables<"business_settings">;
export type BusinessSettingsUpdate = TablesUpdate<"business_settings">;

export interface BusinessPublicSettings {
  name: string;
  legal_name: string | null;
  currency_code: string;
  currency_symbol: string;
  allow_negative_stock: boolean;
  low_stock_default: number;
  cashier_can_discount: boolean;
  cashier_max_discount_cents: number;
  operating_mode: "micromarket" | "restaurant";
  enable_held_sales: boolean;
  order_charge_timing: "on_order" | "on_consumption";
}

export type Order = Tables<"orders">;
export type OrderInsert = TablesInsert<"orders">;
export type OrderUpdate = TablesUpdate<"orders">;

export type OrderItem = Tables<"order_items">;
export type OrderItemInsert = TablesInsert<"order_items">;

export interface OrdersListFilter {
  sessionId?: string;
  status?: Order["status"];
  paymentStatus?: Order["payment_status"];
  limit?: number;
}

export interface OrdersRepo {
  createOrder(input: {
    sessionId: string;
    items: { productId: string; quantity: number }[];
    discountCents?: number;
    notes?: string | null;
  }): Promise<{ order: Order; items: OrderItem[] }>;
  getById(id: string): Promise<{ order: Order; items: OrderItem[] } | null>;
  list(filter?: OrdersListFilter): Promise<Order[]>;
  listItemsForOrders(orderIds: readonly string[]): Promise<OrderItem[]>;
  updateStatus(id: string, status: Order["status"]): Promise<Order>;
  chargeOrder(input: {
    orderId: string;
    paymentMethod: "cash" | "qr" | "card";
    clientRequestId: string;
    cashReceivedCents?: number | null;
  }): Promise<{ saleId: string; order: Order }>;
}

export type AuditLog = Tables<"audit_log">;

// --- Interfaces de Repositorios ---

export interface ProductsRepo {
  list(filter?: { activeOnly?: boolean; categoryId?: string; search?: string }): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  getByIds(ids: string[]): Promise<Product[]>;
  getByBarcode(barcode: string): Promise<Product | null>;
  // Conteo ligero para la UI (badge de stock bajo): solo activos con
  // stock_qty <= min_stock, sin cargar nombres ni costos.
  countLowStock(): Promise<number>;
  create(data: ProductInsert): Promise<Product>;
  createMany(items: ProductInsert[]): Promise<Product[]>;
  update(id: string, data: ProductUpdate): Promise<Product>;
  delete(id: string): Promise<void>;
}

export interface CategoriesRepo {
  list(filter?: { activeOnly?: boolean }): Promise<Category[]>;
  getById(id: string): Promise<Category | null>;
  create(data: CategoryInsert): Promise<Category>;
  update(id: string, data: CategoryUpdate): Promise<Category>;
  reorder(ids: string[]): Promise<Category[]>;
  delete(id: string): Promise<void>;
}

export interface OpenCashSessionPublic {
  id: string;
  opened_at: string;
  opened_by: string;
  opened_by_name: string;
}

// Sesión con el nombre de quien la abrió: listSessions lo trae en la misma
// consulta (join con profiles), de modo que no haga falta una RPC aparte.
export type CashSessionWithOpener = CashSession & { opened_by_name: string | null };

export interface CashRepo {
  getCurrentSession(): Promise<CashSession | null>;
  getOpenSessionPublic(): Promise<OpenCashSessionPublic | null>;
  openSession(openingCents: number, notes?: string): Promise<CashSession>;
  closeSession(sessionId: string, countedCents: number, notes?: string): Promise<CashSession>;
  listSessions(limit?: number): Promise<CashSessionWithOpener[]>;
  getSessionById(id: string): Promise<CashSession | null>;
  addMovement(data: {
    sessionId: string;
    kind: "in" | "out";
    amountCents: number;
    reason: string;
  }): Promise<CashMovement>;
  listMovements(sessionId: string): Promise<CashMovement[]>;
  // Movimientos de todas las sesiones en un rango ISO (reportes de flujo de caja).
  listMovementsRange(dateFrom: string, dateTo: string): Promise<CashMovement[]>;
}

export interface SalesListFilter {
  sessionId?: string;
  cashierId?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: Sale["payment_method"];
  status?: Sale["status"];
  limit?: number;
}

export interface SalesRepo {
  createSale(
    sale: Omit<SaleInsert, "number" | "id" | "created_at" | "cashier_id">,
    items: Omit<SaleItemInsert, "id" | "sale_id">[],
  ): Promise<{ sale: Sale; items: SaleItem[] }>;
  getById(id: string): Promise<{ sale: Sale; items: SaleItem[] } | null>;
  getByClientRequestId(clientRequestId: string): Promise<{ sale: Sale; items: SaleItem[] } | null>;
  listItemsForSales(saleIds: readonly string[]): Promise<SaleItem[]>;
  list(filter?: SalesListFilter): Promise<Sale[]>;
  voidSale(id: string, reason: string): Promise<Sale>;
  getHeldSales(): Promise<HeldSale[]>;
  saveHeldSale(label: string, items: unknown[]): Promise<HeldSale>;
  deleteHeldSale(id: string): Promise<void>;
}

export interface InventoryMovementFilter {
  productId?: string;
  limit?: number;
  // Rango ISO por created_at (reportes de mermas y quiebres de stock).
  dateFrom?: string;
  dateTo?: string;
}

export interface InventoryRepo {
  listMovements(filter?: InventoryMovementFilter): Promise<StockMovement[]>;
  addMovement(movement: StockMovementInsert): Promise<StockMovement>;
  adjustStock(input: {
    productId: string;
    delta: number;
    kind: "adjustment" | "waste";
    reason: string;
  }): Promise<number>;
}

export interface PurchasesRepo {
  createPurchase(
    purchase: Omit<PurchaseInsert, "id" | "created_at" | "updated_at" | "created_by">,
    items: Omit<PurchaseItemInsert, "id" | "purchase_id">[],
  ): Promise<{ purchase: Purchase; items: PurchaseItem[] }>;
  getById(id: string): Promise<{ purchase: Purchase; items: PurchaseItem[] } | null>;
  list(filter?: { status?: Purchase["status"]; supplierId?: string }): Promise<Purchase[]>;
  updateStatus(id: string, status: Purchase["status"]): Promise<Purchase>;
  receivePurchase(
    purchaseId: string,
    items: { productId: string; qtyReceived: number }[],
    updateCost: boolean,
  ): Promise<void>;
}

export interface SuppliersRepo {
  list(filter?: { activeOnly?: boolean }): Promise<Supplier[]>;
  getById(id: string): Promise<Supplier | null>;
  create(data: SupplierInsert): Promise<Supplier>;
  update(id: string, data: SupplierUpdate): Promise<Supplier>;
  delete(id: string): Promise<void>;
}

export interface UsersRepo {
  getProfile(id: string): Promise<Profile | null>;
  listProfiles(): Promise<Profile[]>;
  updateProfile(id: string, data: ProfileUpdate): Promise<Profile>;
}

export interface SettingsRepo {
  getSettings(): Promise<BusinessSettings>;
  updateSettings(data: BusinessSettingsUpdate): Promise<BusinessSettings>;
  getPublicSettings(): Promise<BusinessPublicSettings>;
}

export interface AuditRepo {
  write(entry: {
    action: string;
    entity: string;
    entityId?: string | null;
    summary?: Record<string, unknown>;
    reason?: string | null;
  }): Promise<string>;
  list(filter?: { entity?: string; limit?: number }): Promise<AuditLog[]>;
}

export interface Repositories {
  products: ProductsRepo;
  categories: CategoriesRepo;
  cash: CashRepo;
  sales: SalesRepo;
  orders: OrdersRepo;
  inventory: InventoryRepo;
  purchases: PurchasesRepo;
  suppliers: SuppliersRepo;
  users: UsersRepo;
  settings: SettingsRepo;
  audit: AuditRepo;
}
