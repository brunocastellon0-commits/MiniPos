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
  logo_url: string | null;
  allow_negative_stock: boolean;
  low_stock_default: number;
  cashier_can_discount: boolean;
}

export type AuditLog = Tables<"audit_log">;

// --- Interfaces de Repositorios ---

export interface ProductsRepo {
  list(filter?: { activeOnly?: boolean; categoryId?: string; search?: string }): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  getByBarcode(barcode: string): Promise<Product | null>;
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

export interface CashRepo {
  getCurrentSession(): Promise<CashSession | null>;
  getOpenSessionPublic(): Promise<OpenCashSessionPublic | null>;
  openSession(openingCents: number, notes?: string): Promise<CashSession>;
  closeSession(sessionId: string, countedCents: number, notes?: string): Promise<CashSession>;
  listSessions(limit?: number): Promise<CashSession[]>;
  getSessionById(id: string): Promise<CashSession | null>;
  addMovement(data: {
    sessionId: string;
    kind: "in" | "out";
    amountCents: number;
    reason: string;
  }): Promise<CashMovement>;
  listMovements(sessionId: string): Promise<CashMovement[]>;
}

export interface SalesRepo {
  createSale(
    sale: Omit<SaleInsert, "number" | "id" | "created_at" | "cashier_id">,
    items: Omit<SaleItemInsert, "id" | "sale_id">[],
  ): Promise<{ sale: Sale; items: SaleItem[] }>;
  getById(id: string): Promise<{ sale: Sale; items: SaleItem[] } | null>;
  getByClientRequestId(clientRequestId: string): Promise<{ sale: Sale; items: SaleItem[] } | null>;
  list(filter?: { sessionId?: string; cashierId?: string; limit?: number }): Promise<Sale[]>;
  voidSale(id: string, reason: string): Promise<Sale>;
  getHeldSales(): Promise<HeldSale[]>;
  saveHeldSale(label: string, items: unknown[]): Promise<HeldSale>;
  deleteHeldSale(id: string): Promise<void>;
}

export interface InventoryRepo {
  listMovements(filter?: { productId?: string; limit?: number }): Promise<StockMovement[]>;
  addMovement(movement: StockMovementInsert): Promise<StockMovement>;
}

export interface PurchasesRepo {
  createPurchase(
    purchase: Omit<PurchaseInsert, "id" | "created_at" | "updated_at">,
    items: Omit<PurchaseItemInsert, "id" | "purchase_id">[],
  ): Promise<{ purchase: Purchase; items: PurchaseItem[] }>;
  getById(id: string): Promise<{ purchase: Purchase; items: PurchaseItem[] } | null>;
  list(filter?: { status?: Purchase["status"]; supplierId?: string }): Promise<Purchase[]>;
  updateStatus(id: string, status: Purchase["status"]): Promise<Purchase>;
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
  inventory: InventoryRepo;
  purchases: PurchasesRepo;
  suppliers: SuppliersRepo;
  users: UsersRepo;
  settings: SettingsRepo;
  audit: AuditRepo;
}
