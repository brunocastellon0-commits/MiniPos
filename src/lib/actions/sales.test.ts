import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepositories, MemoryStore, type UserContext } from "@/lib/repos";
import type { Product, ProductsRepo, SalesRepo } from "@/lib/repos/types";
import { createConfirmSaleAction } from "./sales-core";
import type { AuthenticatedUser } from "./secure-action";

const cashier: AuthenticatedUser = {
  id: "cashier-1",
  name: "Carlos Mamani",
  role: "cashier",
  isActive: true,
};

const cashierContext: UserContext = { id: "cashier-1", role: "cashier", active: true };

describe("confirmSaleAction (E4-02/E4-04)", () => {
  let store: MemoryStore;
  let sessionId: string;
  let product: Product;
  let salesRepo: SalesRepo;
  let productsRepo: ProductsRepo;

  beforeEach(async () => {
    store = new MemoryStore();
    const ownerRepos = createMemoryRepositories(store, {
      id: "owner-1",
      role: "owner",
      active: true,
    });
    product = await ownerRepos.products.create({
      name: "Arroz 1kg",
      barcode: "777001",
      price_cents: 1500,
      stock_qty: 10,
    });

    const cashierRepos = createMemoryRepositories(store, cashierContext);
    const session = await cashierRepos.cash.openSession(10000);
    sessionId = session.id;
    salesRepo = cashierRepos.sales;
    productsRepo = createMemoryRepositories(store, cashierContext).products;
  });

  function makeAction() {
    return createConfirmSaleAction({
      currentUserResolver: async () => cashier,
      salesRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).sales,
      productsRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).products,
    });
  }

  function baseInput() {
    return {
      sessionId,
      paymentMethod: "cash" as const,
      clientRequestId: "req-001",
      items: [{ productId: product.id, quantity: 2 }],
      cashReceivedCents: 5000,
    };
  }

  it("cobra la venta con precios calculados en el servidor y descuenta stock", async () => {
    const result = await makeAction()(baseInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.sale.subtotal_cents).toBe(3000);
    expect(result.data.sale.total_cents).toBe(3000);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]?.name_snapshot).toBe("Arroz 1kg");
    expect(result.data.items[0]?.unit_price_cents).toBe(1500);

    const updated = await productsRepo.getById(product.id);
    expect(updated?.stock_qty).toBe(8);
  });

  it("rechaza el cobro si el efectivo recibido no cubre el total", async () => {
    const result = await makeAction()({ ...baseInput(), cashReceivedCents: 1000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("BAD_REQUEST");

    const updated = await productsRepo.getById(product.id);
    expect(updated?.stock_qty).toBe(10);
  });

  it("rechaza descuentos mayores al subtotal", async () => {
    const result = await makeAction()({ ...baseInput(), discountCents: 5000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("BAD_REQUEST");
  });

  it("rechaza productos inexistentes o inactivos para el cajero", async () => {
    const missing = await makeAction()({
      ...baseInput(),
      clientRequestId: "req-002",
      items: [{ productId: "no-existe", quantity: 1 }],
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("NOT_FOUND");

    const ownerRepos = createMemoryRepositories(store, {
      id: "owner-1",
      role: "owner",
      active: true,
    });
    const inactive = await ownerRepos.products.create({
      name: "Galletas",
      price_cents: 500,
      active: false,
    });

    const inactiveResult = await makeAction()({
      ...baseInput(),
      clientRequestId: "req-003",
      items: [{ productId: inactive.id, quantity: 1 }],
    });
    expect(inactiveResult.ok).toBe(false);
    if (!inactiveResult.ok) expect(inactiveResult.code).toBe("NOT_FOUND");
  });

  it("es idempotente por clientRequestId: reintento no duplica stock ni venta", async () => {
    const first = await makeAction()(baseInput());
    const retry = await makeAction()(baseInput());

    expect(first.ok).toBe(true);
    expect(retry.ok).toBe(true);
    if (first.ok && retry.ok) {
      expect(retry.data.sale.id).toBe(first.data.sale.id);
    }

    const updated = await productsRepo.getById(product.id);
    expect(updated?.stock_qty).toBe(8);

    const sales = await salesRepo.list({ sessionId });
    expect(sales).toHaveLength(1);
  });

  it("exige sesión de caja y usuario autenticado", async () => {
    const noSession = await makeAction()({ ...baseInput(), sessionId: "otra-sesion" });
    expect(noSession.ok).toBe(false);

    const anon = createConfirmSaleAction({
      currentUserResolver: async () => null,
      salesRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).sales,
      productsRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).products,
    });
    const anonResult = await anon(baseInput());
    expect(anonResult.ok).toBe(false);
    if (!anonResult.ok) expect(anonResult.code).toBe("UNAUTHENTICATED");
  });
});
