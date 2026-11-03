import { describe, expect, it } from "vitest";
import {
  buildCashSession,
  buildProduct,
  buildPurchase,
  buildSale,
  buildSaleItem,
} from "@/test/factories";
import { createMemoryRepositories, MemoryStore } from "@/lib/repos/memory";
import type { UserContext } from "@/lib/repos/types";
import {
  createExportSalesReportCsvAction,
  createGetReportsDataAction,
  type ReportsActionDeps,
} from "./reports-core";
import type { AuthenticatedUser } from "./secure-action";

const owner: AuthenticatedUser = {
  id: "owner-1",
  name: "Ana Quispe",
  role: "owner",
  isActive: true,
};

const cashier: AuthenticatedUser = {
  id: "cashier-1",
  name: "Carlos Mamani",
  role: "cashier",
  isActive: true,
};

function seed(store: MemoryStore): void {
  store.sales.set(
    "sale-1",
    buildSale({
      id: "sale-1",
      status: "paid",
      subtotal_cents: 2500,
      discount_cents: 0,
      total_cents: 2500,
      created_at: "2026-11-01T12:00:00.000Z",
    }),
  );
  store.saleItems.set(
    "item-1",
    buildSaleItem({
      id: "item-1",
      sale_id: "sale-1",
      product_id: "prod-1",
      name_snapshot: "Coca-Cola 2L",
      quantity: 2,
      unit_price_cents: 1250,
      line_total_cents: 2500,
    }),
  );
  store.sales.set(
    "sale-2",
    buildSale({
      id: "sale-2",
      status: "paid",
      subtotal_cents: 700,
      discount_cents: 100,
      total_cents: 600,
      created_at: "2026-11-02T18:00:00.000Z",
    }),
  );
  store.saleItems.set(
    "item-2",
    buildSaleItem({
      id: "item-2",
      sale_id: "sale-2",
      product_id: "prod-2",
      name_snapshot: "Arroz 1kg",
      quantity: 1,
      unit_price_cents: 700,
      line_total_cents: 700,
    }),
  );
  store.sales.set(
    "sale-3",
    buildSale({
      id: "sale-3",
      status: "voided",
      subtotal_cents: 900,
      discount_cents: 0,
      total_cents: 900,
      created_at: "2026-11-02T19:00:00.000Z",
    }),
  );
  store.sales.set(
    "sale-prev",
    buildSale({
      id: "sale-prev",
      status: "paid",
      subtotal_cents: 1000,
      discount_cents: 0,
      total_cents: 1000,
      created_at: "2026-10-31T12:00:00.000Z",
    }),
  );
  store.products.set(
    "prod-1",
    buildProduct({ id: "prod-1", name: "Coca-Cola 2L", stock_qty: 10, price_cents: 2500, cost_cents: 1800 }),
  );
  store.products.set(
    "prod-2",
    buildProduct({ id: "prod-2", name: "Arroz 1kg", stock_qty: 5, price_cents: 700, cost_cents: null }),
  );
  store.products.set(
    "prod-3",
    buildProduct({ id: "prod-3", name: "Harina 1kg", stock_qty: 8, price_cents: 900, cost_cents: 500 }),
  );
  store.purchases.set(
    "pur-1",
    buildPurchase({
      id: "pur-1",
      status: "received",
      total_cents: 30000,
      created_at: "2026-11-01T10:00:00.000Z",
    }),
  );
  store.cashSessions.set(
    "cash-1",
    buildCashSession({
      id: "cash-1",
      status: "closed",
      closed_at: "2026-11-01T22:00:00.000Z",
      difference_cents: 150,
    }),
  );
}

function makeDeps(user: AuthenticatedUser | null): ReportsActionDeps {
  const store = new MemoryStore();
  seed(store);
  return {
    currentUserResolver: async () => user,
    salesRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).sales,
    purchasesRepoFactory: async (ctx: UserContext) =>
      createMemoryRepositories(store, ctx).purchases,
    cashRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).cash,
    productsRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).products,
  };
}

describe("getReportsDataAction (E9-01)", () => {
  it("deniega a cajero y anónimo", async () => {
    const deniedCashier = await createGetReportsDataAction(makeDeps(cashier))({
      dateFrom: "2026-11-01",
      dateTo: "2026-11-03",
    });
    expect(deniedCashier.ok).toBe(false);

    const deniedAnon = await createGetReportsDataAction(makeDeps(null))({
      dateFrom: "2026-11-01",
      dateTo: "2026-11-03",
    });
    expect(deniedAnon.ok).toBe(false);
  });

  it("rechaza rango invertido, claves inválidas y claves extra (strict)", async () => {
    const action = createGetReportsDataAction(makeDeps(owner));

    const inverted = await action({ dateFrom: "2026-11-03", dateTo: "2026-11-01" });
    expect(inverted.ok).toBe(false);

    const invalid = await action({ dateFrom: "no-fecha", dateTo: "2026-11-01" });
    expect(invalid.ok).toBe(false);

    const extra = await action({
      dateFrom: "2026-11-01",
      dateTo: "2026-11-03",
      hacker: true,
    } as never);
    expect(extra.ok).toBe(false);
  });

  it("resume el periodo pedido: cobrado, bruto, descuento y anuladas", async () => {
    const result = await createGetReportsDataAction(makeDeps(owner))({
      dateFrom: "2026-11-01",
      dateTo: "2026-11-02",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.stats).toMatchObject({
      grossCents: 3200,
      discountCents: 100,
      totalCents: 3100,
      transactionCount: 2,
      voidedCount: 1,
      voidedCents: 900,
      averageTicketCents: 1550,
    });
    expect(result.data.previousStats.totalCents).toBe(1000);
    expect(result.data.previousDateTo).toBe("2026-10-31");
    expect(result.data.dailyRows).toHaveLength(2);
    expect(result.data.dailyRows[0]).toMatchObject({
      dayKey: "2026-11-01",
      transactionCount: 1,
      collectedCents: 2500,
    });
    expect(result.data.dailyRows[1]).toMatchObject({
      dayKey: "2026-11-02",
      voidedCount: 1,
      voidedCents: 900,
    });
  });

  it("agrupa productos vendidos, incluye no vendidos, compras, caja y valoriza inventario", async () => {
    const result = await createGetReportsDataAction(makeDeps(owner))({
      dateFrom: "2026-11-01",
      dateTo: "2026-11-02",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.topProducts[0]).toMatchObject({
      productId: "prod-1",
      units: 2,
      totalCents: 2500,
    });
    expect(
      result.data.leastProducts.find((row) => row.productId === "prod-2"),
    ).toMatchObject({ units: 1, totalCents: 700 });
    expect(result.data.leastProducts.some((row) => row.units === 0)).toBe(true);

    expect(result.data.purchasesSummary.totalCents).toBe(30_000);
    expect(result.data.cashSummary).toEqual({
      closedCount: 1,
      totalDifferenceCents: 150,
      withDifferenceCount: 1,
    });
    expect(result.data.inventoryValuation).toMatchObject({
      retailValueCents: 10 * 2500 + 5 * 700 + 8 * 900,
      costValueCents: 10 * 1800 + 8 * 500,
      costedProductCount: 2,
      uncostedProductCount: 1,
    });
  });

  it("ignora compras y cierres fuera del rango", async () => {
    const result = await createGetReportsDataAction(makeDeps(owner))({
      dateFrom: "2026-11-02",
      dateTo: "2026-11-02",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.purchasesSummary.totalCount).toBe(0);
    expect(result.data.cashSummary.closedCount).toBe(0);
  });
});

describe("exportSalesReportCsvAction (E9-05)", () => {
  it("solo dueño: devuelve CSV y nombre de archivo coherente con el rango", async () => {
    const denied = await createExportSalesReportCsvAction(makeDeps(cashier))({
      dateFrom: "2026-11-01",
      dateTo: "2026-11-02",
    });
    expect(denied.ok).toBe(false);

    const result = await createExportSalesReportCsvAction(makeDeps(owner))({
      dateFrom: "2026-11-01",
      dateTo: "2026-11-02",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.filename).toBe("ventas_2026-11-01_2026-11-02.csv");
    expect(result.data.csv).toContain("fecha,transacciones,bruto_bs,descuento_bs,cobrado_bs");
    expect(result.data.csv).toContain("2026-11-01,1,25.00,0.00,25.00");
    expect(result.data.csv).toContain("2026-11-02,1,7.00,1.00,6.00");
    expect(result.data.csv).toContain("2026-11-02,1,7.00,1.00,6.00,1,9.00");
  });

  it("rechaza el rango invertido", async () => {
    const result = await createExportSalesReportCsvAction(makeDeps(owner))({
      dateFrom: "2026-11-03",
      dateTo: "2026-11-01",
    });
    expect(result.ok).toBe(false);
  });
});
