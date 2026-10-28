import type { Category, Product, Supplier, Profile } from "@/lib/repos/types";
import type { MemoryStore } from "@/lib/repos/memory/memory-store";

export const DEMO_PROFILES: Profile[] = [
  {
    id: "user-owner-demo",
    full_name: "Doña Elena Rodríguez (Propietaria)",
    role: "owner",
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "user-cashier-demo",
    full_name: "Carlos Mamani (Cajero)",
    role: "cashier",
    active: true,
    created_at: "2026-01-02T08:00:00.000Z",
    updated_at: "2026-01-02T08:00:00.000Z",
  },
];

export const DEMO_SUPPLIERS: Supplier[] = [
  {
    id: "supp-embol",
    name: "Embol S.A. (Coca-Cola)",
    phone: "2-2244660",
    notes: "Visitas de preventa los días lunes, entrega los martes",
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "supp-pil",
    name: "PIL Andina S.A.",
    phone: "800-10-2222",
    notes: "Entrega interdiaria productos refrigerados",
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "supp-fino",
    name: "Alicorp Bolivia (Fino / Famosa)",
    phone: "3-3366000",
    notes: "Abarrotes y aceites por mayor",
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
];

export const DEMO_CATEGORIES: Category[] = [
  {
    id: "cat-bebidas",
    name: "Bebidas y Refrescos",
    sort_order: 1,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "cat-lacteos",
    name: "Lácteos y Derivados",
    sort_order: 2,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "cat-abarrotes",
    name: "Abarrotes y Granos",
    sort_order: 3,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "cat-panaderia",
    name: "Panadería y Masas",
    sort_order: 4,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "cat-snacks",
    name: "Snacks y Golosinas",
    sort_order: 5,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "cat-limpieza",
    name: "Limpieza y Hogar",
    sort_order: 6,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
];

export const DEMO_PRODUCTS: Product[] = [
  {
    id: "prod-coca-2l",
    name: "Coca-Cola Original 2 L",
    barcode: "7771234000018",
    internal_code: "BEB-001",
    category_id: "cat-bebidas",
    unit_label: "botella",
    price_cents: 1200, // Bs 12,00
    cost_cents: 950, // Bs 9,50
    stock_qty: 36,
    min_stock: 12,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "prod-leche-pil",
    name: "Leche Entera Natural PIL 1 L",
    barcode: "7771234000025",
    internal_code: "LAC-001",
    category_id: "cat-lacteos",
    unit_label: "bolsa",
    price_cents: 650, // Bs 6,50
    cost_cents: 520, // Bs 5,20
    stock_qty: 24,
    min_stock: 10,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "prod-pan-molde",
    name: "Pan de Molde Blanco Bimbo 550g",
    barcode: "7771234000032",
    internal_code: "PAN-001",
    category_id: "cat-panaderia",
    unit_label: "paquete",
    price_cents: 1400, // Bs 14,00
    cost_cents: 1100, // Bs 11,00
    stock_qty: 15,
    min_stock: 5,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "prod-arroz-grano-oro",
    name: "Arroz Grano de Oro Superior 1 kg",
    barcode: "7771234000049",
    internal_code: "ABA-001",
    category_id: "cat-abarrotes",
    unit_label: "bolsa",
    price_cents: 850, // Bs 8,50
    cost_cents: 680, // Bs 6,80
    stock_qty: 40,
    min_stock: 15,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "prod-fideo-famosa",
    name: "Fideo Famosa Espagueti 400g",
    barcode: "7771234000056",
    internal_code: "ABA-002",
    category_id: "cat-abarrotes",
    unit_label: "paquete",
    price_cents: 500, // Bs 5,00
    cost_cents: 380, // Bs 3,80
    stock_qty: 30,
    min_stock: 10,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "prod-aceite-fino",
    name: "Aceite Vegetal Fino 900 ml",
    barcode: "7771234000063",
    internal_code: "ABA-003",
    category_id: "cat-abarrotes",
    unit_label: "botella",
    price_cents: 1350, // Bs 13,50
    cost_cents: 1100, // Bs 11,00
    stock_qty: 18,
    min_stock: 6,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "prod-papas-lays",
    name: "Papas Fritas Lay's Clásicas 40g",
    barcode: "7771234000087",
    internal_code: "SNK-001",
    category_id: "cat-snacks",
    unit_label: "bolsa",
    price_cents: 550, // Bs 5,50
    cost_cents: 400, // Bs 4,00
    stock_qty: 25,
    min_stock: 8,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "prod-detergente-omo",
    name: "Detergente Omo Multiacción 800g",
    barcode: "7771234000100",
    internal_code: "LIM-001",
    category_id: "cat-limpieza",
    unit_label: "bolsa",
    price_cents: 1600, // Bs 16,00
    cost_cents: 1250, // Bs 12,50
    stock_qty: 10,
    min_stock: 4,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "prod-yogur-pil",
    name: "Yogur Frutado PIL Durazno 1 L",
    barcode: "7771234000124",
    internal_code: "LAC-002",
    category_id: "cat-lacteos",
    unit_label: "botella",
    price_cents: 1150, // Bs 11,50
    cost_cents: 900, // Bs 9,00
    stock_qty: 3, // Stock bajo a propósito (< min_stock 5)
    min_stock: 5,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "prod-galleta-mabels",
    name: "Galletas Mabel's Wafer Frutilla 75g",
    barcode: "7771234000094",
    internal_code: "SNK-002",
    category_id: "cat-snacks",
    unit_label: "paquete",
    price_cents: 350, // Bs 3,50
    cost_cents: 250, // Bs 2,50
    stock_qty: 0, // Agotado a propósito (stock 0)
    min_stock: 8,
    active: true,
    created_at: "2026-01-01T08:00:00.000Z",
    updated_at: "2026-01-01T08:00:00.000Z",
  },
];

export function seedDemoStore(store: MemoryStore): void {
  store.reset();

  for (const profile of DEMO_PROFILES) {
    store.profiles.set(profile.id, { ...profile });
  }

  for (const supplier of DEMO_SUPPLIERS) {
    store.suppliers.set(supplier.id, { ...supplier });
  }

  for (const category of DEMO_CATEGORIES) {
    store.categories.set(category.id, { ...category });
  }

  for (const product of DEMO_PRODUCTS) {
    store.products.set(product.id, { ...product });
  }
}
