import type {
  Profile,
  BusinessSettings,
  Category,
  Product,
  CashSession,
  CashMovement,
  Sale,
  SaleItem,
  HeldSale,
  StockMovement,
  Supplier,
  Purchase,
  PurchaseItem,
  AuditLog,
} from "../types";

export class MemoryStore {
  profiles = new Map<string, Profile>();
  businessSettings: BusinessSettings;
  categories = new Map<string, Category>();
  products = new Map<string, Product>();
  cashSessions = new Map<string, CashSession>();
  cashMovements = new Map<string, CashMovement>();
  sales = new Map<string, Sale>();
  saleItems = new Map<string, SaleItem>();
  heldSales = new Map<string, HeldSale>();
  stockMovements = new Map<string, StockMovement>();
  suppliers = new Map<string, Supplier>();
  purchases = new Map<string, Purchase>();
  purchaseItems = new Map<string, PurchaseItem>();
  auditLog = new Map<string, AuditLog>();

  private salesNumberSeq = 1;

  constructor() {
    this.businessSettings = {
      id: 1,
      name: "Mi Minimarket",
      legal_name: null,
      currency_code: "BOB",
      currency_symbol: "Bs",
      logo_url: null,
      allow_negative_stock: false,
      low_stock_default: 5,
      cashier_can_discount: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  nextSaleNumber(): number {
    return this.salesNumberSeq++;
  }

  reset(): void {
    this.profiles.clear();
    this.categories.clear();
    this.products.clear();
    this.cashSessions.clear();
    this.cashMovements.clear();
    this.sales.clear();
    this.saleItems.clear();
    this.heldSales.clear();
    this.stockMovements.clear();
    this.suppliers.clear();
    this.purchases.clear();
    this.purchaseItems.clear();
    this.auditLog.clear();
    this.salesNumberSeq = 1;

    this.businessSettings = {
      id: 1,
      name: "Mi Minimarket",
      legal_name: null,
      currency_code: "BOB",
      currency_symbol: "Bs",
      logo_url: null,
      allow_negative_stock: false,
      low_stock_default: 5,
      cashier_can_discount: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}
