import { describe, it, expect } from "vitest";
import {
  buildProduct,
  buildCategory,
  buildCashSession,
  buildSale,
  buildSaleItem,
  buildSupplier,
  buildPurchase,
  buildProfile,
} from "./factories";
import {
  DEMO_PRODUCTS,
  DEMO_CATEGORIES,
  DEMO_SUPPLIERS,
  DEMO_PROFILES,
  seedDemoStore,
} from "./demo-data";
import { MemoryStore } from "@/lib/repos/memory/memory-store";

describe("Factories", () => {
  it("genera entidades con valores por defecto consistentes y permite sobreescrituras", () => {
    const product = buildProduct({ name: "Pan Casero", price_cents: 200 });
    expect(product.id).toBeDefined();
    expect(product.name).toBe("Pan Casero");
    expect(product.price_cents).toBe(200);
    expect(product.unit_label).toBe("unidad");

    const category = buildCategory({ name: "Lácteos" });
    expect(category.name).toBe("Lácteos");
    expect(category.active).toBe(true);

    const sessionOpen = buildCashSession({ status: "open", opening_cents: 5000 });
    expect(sessionOpen.status).toBe("open");
    expect(sessionOpen.closed_at).toBeNull();
    expect(sessionOpen.difference_cents).toBeNull();

    const sessionClosed = buildCashSession({
      status: "closed",
      opening_cents: 5000,
      expected_cash_cents: 6000,
      counted_cash_cents: 6200,
    });
    expect(sessionClosed.status).toBe("closed");
    expect(sessionClosed.closed_at).toBeDefined();
    expect(sessionClosed.difference_cents).toBe(200);

    const sale = buildSale({ subtotal_cents: 1000, discount_cents: 100 });
    expect(sale.total_cents).toBe(900);

    const item = buildSaleItem({ unit_price_cents: 500, quantity: 3 });
    expect(item.line_total_cents).toBe(1500);

    const supplier = buildSupplier({ name: "PIL" });
    expect(supplier.name).toBe("PIL");

    const purchase = buildPurchase({ total_cents: 20000 });
    expect(purchase.total_cents).toBe(20000);

    const profile = buildProfile({ role: "owner" });
    expect(profile.role).toBe("owner");
  });
});

describe("Demo Dataset", () => {
  it("contiene productos típicos bolivianos bien formados", () => {
    expect(DEMO_CATEGORIES.length).toBeGreaterThanOrEqual(5);
    expect(DEMO_PRODUCTS.length).toBeGreaterThanOrEqual(8);
    expect(DEMO_SUPPLIERS.length).toBeGreaterThanOrEqual(3);
    expect(DEMO_PROFILES.length).toBeGreaterThanOrEqual(2);

    const coca = DEMO_PRODUCTS.find((p) => p.name.includes("Coca-Cola"));
    expect(coca).toBeDefined();
    expect(coca?.barcode).toBe("7771234000018");
    expect(coca?.price_cents).toBe(1200);

    const pil = DEMO_PRODUCTS.find((p) => p.name.includes("PIL"));
    expect(pil).toBeDefined();

    // Comprobar estados de stock representativos para la UI
    const outOfStock = DEMO_PRODUCTS.find((p) => p.stock_qty === 0);
    expect(outOfStock).toBeDefined();

    const lowStock = DEMO_PRODUCTS.find((p) => p.stock_qty > 0 && p.stock_qty <= p.min_stock);
    expect(lowStock).toBeDefined();
  });

  it("seedDemoStore puebla el almacén de memoria con las entidades de demostración", () => {
    const store = new MemoryStore();
    seedDemoStore(store);

    expect(store.products.size).toBe(DEMO_PRODUCTS.length);
    expect(store.categories.size).toBe(DEMO_CATEGORIES.length);
    expect(store.suppliers.size).toBe(DEMO_SUPPLIERS.length);
    expect(store.profiles.size).toBe(DEMO_PROFILES.length);
  });
});
