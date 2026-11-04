import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRepositories, MemoryStore, type UserContext } from "@/lib/repos";
import { MemoryProductsRepo } from "@/lib/repos/memory/products";
import type { Product, ProductsRepo, SalesRepo } from "@/lib/repos/types";
import { buildProfile, buildSale, buildSaleItem } from "@/test/factories";
import {
  createConfirmSaleAction,
  createGetSaleDetailAction,
  createGetSaleTicketAction,
  createListSalesAction,
} from "./sales-core";
import type { AuthenticatedUser } from "./secure-action";

const cashier: AuthenticatedUser = {
  id: "cashier-1",
  name: "Carlos Mamani",
  role: "cashier",
  isActive: true,
};

const cashierContext: UserContext = { id: "cashier-1", role: "cashier", active: true };

const ownerContext: UserContext = { id: "owner-1", role: "owner", active: true };

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

  function makeAction(user: AuthenticatedUser = cashier) {
    return createConfirmSaleAction({
      currentUserResolver: async () => user,
      salesRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).sales,
      productsRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).products,
      settingsRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).settings,
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

  it("valida los items en una sola consulta de productos (sin N+1, E11-05)", async () => {
    const ownerRepos = createMemoryRepositories(store, {
      id: "owner-1",
      role: "owner",
      active: true,
    });
    const second = await ownerRepos.products.create({
      name: "Azucar 1kg",
      price_cents: 800,
      stock_qty: 5,
    });

    const getByIdsSpy = vi.spyOn(MemoryProductsRepo.prototype, "getByIds");
    const getByIdSpy = vi.spyOn(MemoryProductsRepo.prototype, "getById");
    try {
      const result = await makeAction()({
        ...baseInput(),
        items: [
          { productId: product.id, quantity: 2 },
          { productId: second.id, quantity: 1 },
        ],
        cashReceivedCents: 4000,
      });

      expect(result.ok).toBe(true);
      expect(getByIdsSpy).toHaveBeenCalledTimes(1);
      expect(getByIdSpy).not.toHaveBeenCalled();
    } finally {
      getByIdsSpy.mockRestore();
      getByIdSpy.mockRestore();
    }
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

  it("el cajero no puede aplicar descuentos sin permiso (D-008)", async () => {
    const result = await makeAction()({ ...baseInput(), discountCents: 500 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN");

    const updated = await productsRepo.getById(product.id);
    expect(updated?.stock_qty).toBe(10);
    const sales = await salesRepo.list({ sessionId });
    expect(sales).toHaveLength(0);
  });

  it("el cajero puede aplicar descuentos cuando cashier_can_discount está habilitado", async () => {
    const ownerRepos = createMemoryRepositories(store, {
      id: "owner-1",
      role: "owner",
      active: true,
    });
    await ownerRepos.settings.updateSettings({ cashier_can_discount: true });

    const result = await makeAction()({
      ...baseInput(),
      clientRequestId: "req-desc-ok",
      discountCents: 500,
      cashReceivedCents: 3000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sale.discount_cents).toBe(500);
    expect(result.data.sale.total_cents).toBe(2500);
  });

  it("el cajero no puede superar el máximo de descuento configurado (umbral)", async () => {
    const ownerRepos = createMemoryRepositories(store, {
      id: "owner-1",
      role: "owner",
      active: true,
    });
    await ownerRepos.settings.updateSettings({
      cashier_can_discount: true,
      cashier_max_discount_cents: 200,
    });

    const result = await makeAction()({
      ...baseInput(),
      clientRequestId: "req-umbral-excedido",
      discountCents: 500,
      cashReceivedCents: 3000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FORBIDDEN");
      expect(result.message).toContain("Bs 2,00");
    }

    const updated = await productsRepo.getById(product.id);
    expect(updated?.stock_qty).toBe(10);
    const sales = await salesRepo.list({ sessionId });
    expect(sales).toHaveLength(0);
  });

  it("el cajero puede aplicar el descuento justo en su máximo", async () => {
    const ownerRepos = createMemoryRepositories(store, {
      id: "owner-1",
      role: "owner",
      active: true,
    });
    await ownerRepos.settings.updateSettings({
      cashier_can_discount: true,
      cashier_max_discount_cents: 500,
    });

    const result = await makeAction()({
      ...baseInput(),
      clientRequestId: "req-umbral-justo",
      discountCents: 500,
      cashReceivedCents: 3000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sale.discount_cents).toBe(500);
    expect(result.data.sale.total_cents).toBe(2500);
  });

  it("el dueño no tiene límite de descuento aunque el umbral sea menor", async () => {
    const ownerRepos = createMemoryRepositories(store, {
      id: "owner-1",
      role: "owner",
      active: true,
    });
    await ownerRepos.settings.updateSettings({
      cashier_can_discount: true,
      cashier_max_discount_cents: 100,
    });

    const result = await makeAction({
      id: "owner-1",
      name: "Ana Quispe",
      role: "owner",
      isActive: true,
    })({
      ...baseInput(),
      clientRequestId: "req-umbral-dueno",
      discountCents: 500,
      cashReceivedCents: 3000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sale.discount_cents).toBe(500);
    expect(result.data.sale.total_cents).toBe(2500);
  });

  it("el dueño siempre puede aplicar descuentos sin la casilla habilitada", async () => {
    const owner: AuthenticatedUser = {
      id: "owner-1",
      name: "Ana Quispe",
      role: "owner",
      isActive: true,
    };

    const result = await makeAction(owner)({
      ...baseInput(),
      clientRequestId: "req-owner-desc",
      discountCents: 500,
      cashReceivedCents: 3000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sale.discount_cents).toBe(500);
    expect(result.data.sale.total_cents).toBe(2500);
  });

  it("el cajero sin permiso cobra sin descuento normalmente", async () => {
    const result = await makeAction()({ ...baseInput(), clientRequestId: "req-sin-desc" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sale.discount_cents).toBe(0);
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

describe("getSaleTicketAction (E4-06)", () => {
  let store: MemoryStore;
  let saleId: string;

  beforeEach(async () => {
    store = new MemoryStore();
    const ownerRepos = createMemoryRepositories(store, {
      id: "owner-1",
      role: "owner",
      active: true,
    });
    const product = await ownerRepos.products.create({
      name: "Arroz 1kg",
      price_cents: 1500,
      stock_qty: 10,
    });

    const cashierRepos = createMemoryRepositories(store, cashierContext);
    const session = await cashierRepos.cash.openSession(10000);
    const { sale } = await cashierRepos.sales.createSale(
      {
        session_id: session.id,
        subtotal_cents: 3000,
        discount_cents: 0,
        total_cents: 3000,
        payment_method: "cash",
        cash_received_cents: 5000,
        client_request_id: "ticket-req-1",
      },
      [
        {
          product_id: product.id,
          name_snapshot: "Arroz 1kg",
          unit_price_cents: 1500,
          quantity: 2,
          line_total_cents: 3000,
        },
      ],
    );
    saleId = sale.id;
  });

  function makeTicketAction(user: AuthenticatedUser | null) {
    return createGetSaleTicketAction({
      currentUserResolver: async () => user,
      salesRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).sales,
      settingsRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).settings,
    });
  }

  it("devuelve venta, ítems y datos públicos del negocio", async () => {
    const result = await makeTicketAction(cashier)({ saleId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.sale.id).toBe(saleId);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]?.name_snapshot).toBe("Arroz 1kg");
    expect(result.data.business.name).toBeTruthy();
    expect(result.data.business.currency_symbol).toBe("Bs");
  });

  it("un cajero no puede ver la venta de otro cajero", async () => {
    const result = await makeTicketAction({
      id: "cashier-9",
      name: "Otra",
      role: "cashier",
      isActive: true,
    })({ saleId });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("rechaza venta inexistente y usuario no autenticado", async () => {
    const missing = await makeTicketAction(cashier)({ saleId: "no-existe" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("NOT_FOUND");

    const anon = await makeTicketAction(null)({ saleId });
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");
  });
});

const ownerUser: AuthenticatedUser = {
  id: "owner-1",
  name: "Ana Quispe",
  role: "owner",
  isActive: true,
};

function seedSalesStore(store: MemoryStore): void {
  store.profiles.set(
    "owner-1",
    buildProfile({ id: "owner-1", full_name: "Ana Quispe", role: "owner" }),
  );
  store.profiles.set(
    "cashier-1",
    buildProfile({ id: "cashier-1", full_name: "Carlos Mamani", role: "cashier" }),
  );
  store.sales.set(
    "sale-1",
    buildSale({
      id: "sale-1",
      number: 101,
      cashier_id: "cashier-1",
      payment_method: "cash",
      created_at: "2026-10-01T12:00:00.000Z",
    }),
  );
  store.sales.set(
    "sale-2",
    buildSale({
      id: "sale-2",
      number: 102,
      cashier_id: "owner-1",
      payment_method: "qr",
      created_at: "2026-11-01T18:00:00.000Z",
    }),
  );
}

function makeListAction(store: MemoryStore, user: AuthenticatedUser | null) {
  return createListSalesAction({
    currentUserResolver: async () => user,
    salesRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).sales,
    usersRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).users,
  });
}

function makeDetailAction(store: MemoryStore, user: AuthenticatedUser | null) {
  return createGetSaleDetailAction({
    currentUserResolver: async () => user,
    salesRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).sales,
    usersRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).users,
  });
}

describe("listSalesAction (E5-01)", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
    seedSalesStore(store);
  });

  it("el dueño lista todas las ventas con nombres de cajeros", async () => {
    const result = await makeListAction(store, ownerUser)({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sales.map((sale) => sale.id).sort()).toEqual(["sale-1", "sale-2"]);
    expect(result.data.cashierNames).toEqual({
      "cashier-1": "Carlos Mamani",
      "owner-1": "Ana Quispe",
    });
  });

  it("filtra por método de pago", async () => {
    const result = await makeListAction(store, ownerUser)({ paymentMethod: "qr" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sales.map((sale) => sale.id)).toEqual(["sale-2"]);
  });

  it("filtra por estado pagadas/anuladas", async () => {
    const ownerRepos = createMemoryRepositories(store, ownerContext);
    await ownerRepos.sales.voidSale("sale-1", "Error de cobro");

    const voided = await makeListAction(store, ownerUser)({ status: "voided" });
    expect(voided.ok).toBe(true);
    if (!voided.ok) return;
    expect(voided.data.sales.map((sale) => sale.id)).toEqual(["sale-1"]);

    const paid = await makeListAction(store, ownerUser)({ status: "paid" });
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.data.sales.map((sale) => sale.id)).toEqual(["sale-2"]);
  });

  it("filtra por rango de fechas en zona La Paz", async () => {
    const from = await makeListAction(store, ownerUser)({ dateFrom: "2026-11-01" });
    expect(from.ok).toBe(true);
    if (!from.ok) return;
    expect(from.data.sales.map((sale) => sale.id)).toEqual(["sale-2"]);

    const to = await makeListAction(store, ownerUser)({ dateTo: "2026-10-31" });
    expect(to.ok).toBe(true);
    if (!to.ok) return;
    expect(to.data.sales.map((sale) => sale.id)).toEqual(["sale-1"]);
  });

  it("rechaza fechas inválidas y rangos invertidos", async () => {
    const invalid = await makeListAction(store, ownerUser)({ dateFrom: "2026-99-99" });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.code).toBe("VALIDATION_ERROR");

    const inverted = await makeListAction(store, ownerUser)({
      dateFrom: "2026-11-02",
      dateTo: "2026-11-01",
    });
    expect(inverted.ok).toBe(false);
    if (!inverted.ok) expect(inverted.code).toBe("VALIDATION_ERROR");
  });

  it("el cajero solo lista las suyas aunque pida otro cajero", async () => {
    const result = await makeListAction(store, cashier)({ cashierId: "owner-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sales.map((sale) => sale.id)).toEqual(["sale-1"]);
    expect(result.data.cashierNames).toEqual({ "cashier-1": "Carlos Mamani" });
  });

  it("pagina por defecto en 100 filas y avisa cuando hay más", async () => {
    for (let index = 0; index < 105; index += 1) {
      const id = `sale-extra-${index}`;
      store.sales.set(id, buildSale({ id, number: 200 + index, cashier_id: "owner-1" }));
    }

    const page = await makeListAction(store, ownerUser)({});
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.data.sales).toHaveLength(100);
    expect(page.data.hasMore).toBe(true);

    const all = await makeListAction(store, ownerUser)({ limit: 1000 });
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    expect(all.data.sales).toHaveLength(107);
    expect(all.data.hasMore).toBe(false);
  });

  it("exige usuario autenticado", async () => {
    const anon = await makeListAction(store, null)({});
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");
  });
});

describe("getSaleDetailAction (E5-01)", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
    seedSalesStore(store);
    store.saleItems.set(
      "item-1",
      buildSaleItem({
        id: "item-1",
        sale_id: "sale-1",
        name_snapshot: "Arroz 1kg",
        unit_price_cents: 1500,
        quantity: 2,
        line_total_cents: 3000,
      }),
    );
  });

  it("el dueño ve la venta de un cajero con su nombre e ítems congelados", async () => {
    const result = await makeDetailAction(store, ownerUser)({ saleId: "sale-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sale.id).toBe("sale-1");
    expect(result.data.cashierName).toBe("Carlos Mamani");
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]?.name_snapshot).toBe("Arroz 1kg");
    expect(result.data.items[0]?.unit_price_cents).toBe(1500);
  });

  it("el cajero ve el detalle de su propia venta", async () => {
    const result = await makeDetailAction(store, cashier)({ saleId: "sale-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sale.id).toBe("sale-1");
    expect(result.data.cashierName).toBe("Carlos Mamani");
  });

  it("el cajero no ve ventas de otro cajero", async () => {
    const result = await makeDetailAction(store, cashier)({ saleId: "sale-2" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("venta inexistente y usuario no autenticado", async () => {
    const missing = await makeDetailAction(store, ownerUser)({ saleId: "no-existe" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("NOT_FOUND");

    const anon = await makeDetailAction(store, null)({ saleId: "sale-1" });
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");
  });
});
