import { describe, expect, it } from "vitest";
import { laPazDayKey } from "@/lib/dates";
import { createMemoryRepositories, MemoryStore } from "@/lib/repos/memory";
import { buildCashMovement, buildCashSession, buildProduct, buildSale, buildSaleItem } from "@/test/factories";
import type { UserContext } from "@/lib/repos/types";
import { createGetPanelInsightsAction, type PanelInsightsActionDeps } from "./panel-core";
import type { AuthenticatedUser } from "./secure-action";

const owner: AuthenticatedUser = {
  id: "owner-1",
  name: "Doña Elena",
  role: "owner",
  isActive: true,
};

const cashier: AuthenticatedUser = {
  id: "cashier-1",
  name: "Carlos Mamani",
  role: "cashier",
  isActive: true,
};

const DAY_KEY = laPazDayKey(new Date());
const TODAY_ISO = new Date().toISOString();
const YESTERDAY_ISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function seed(store: MemoryStore, options: { missingCost?: boolean } = {}): void {
  store.products.set(
    "prod-a",
    buildProduct({
      id: "prod-a",
      name: "Coca-Cola 2L",
      price_cents: 1500,
      cost_cents: 700,
      stock_qty: 10,
    }),
  );
  store.products.set(
    "prod-b",
    buildProduct({
      id: "prod-b",
      name: "Arroz 1kg",
      price_cents: 800,
      cost_cents: options.missingCost ? null : 300,
      stock_qty: 5,
    }),
  );

  store.sales.set(
    "sale-1",
    buildSale({
      id: "sale-1",
      status: "paid",
      subtotal_cents: 5300,
      discount_cents: 0,
      total_cents: 5300,
      created_at: TODAY_ISO,
    }),
  );
  store.saleItems.set(
    "item-1",
    buildSaleItem({
      id: "item-1",
      sale_id: "sale-1",
      product_id: "prod-a",
      name_snapshot: "Coca-Cola 2L",
      quantity: 3,
      unit_price_cents: 1500,
      line_total_cents: 4500,
    }),
  );
  store.saleItems.set(
    "item-2",
    buildSaleItem({
      id: "item-2",
      sale_id: "sale-1",
      product_id: "prod-b",
      name_snapshot: "Arroz 1kg",
      quantity: 1,
      unit_price_cents: 800,
      line_total_cents: 800,
    }),
  );
  store.sales.set(
    "sale-voided",
    buildSale({
      id: "sale-voided",
      status: "voided",
      subtotal_cents: 9999,
      total_cents: 9999,
      created_at: TODAY_ISO,
    }),
  );
  store.saleItems.set(
    "item-voided",
    buildSaleItem({
      id: "item-voided",
      sale_id: "sale-voided",
      product_id: "prod-a",
      name_snapshot: "Coca-Cola 2L",
      quantity: 9,
      unit_price_cents: 1111,
      line_total_cents: 9999,
    }),
  );

  store.cashSessions.set(
    "session-today",
    buildCashSession({
      id: "session-today",
      status: "open",
      opened_at: TODAY_ISO,
      closed_at: null,
    }),
  );
  store.cashMovements.set(
    "mov-in",
    buildCashMovement({
      id: "mov-in",
      session_id: "session-today",
      kind: "in",
      amount_cents: 10000,
      created_at: TODAY_ISO,
    }),
  );
  store.cashMovements.set(
    "mov-out",
    buildCashMovement({
      id: "mov-out",
      session_id: "session-today",
      kind: "out",
      amount_cents: 2500,
      created_at: TODAY_ISO,
    }),
  );
  store.cashMovements.set(
    "mov-yesterday",
    buildCashMovement({
      id: "mov-yesterday",
      session_id: "session-today",
      kind: "in",
      amount_cents: 999,
      created_at: YESTERDAY_ISO,
    }),
  );

  store.cashSessions.set(
    "session-old",
    buildCashSession({
      id: "session-old",
      status: "closed",
      opened_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      closed_at: YESTERDAY_ISO,
    }),
  );
  store.cashMovements.set(
    "mov-old-session",
    buildCashMovement({
      id: "mov-old-session",
      session_id: "session-old",
      kind: "in",
      amount_cents: 777,
      created_at: TODAY_ISO,
    }),
  );
}

function makeDeps(user: AuthenticatedUser | null, options: { missingCost?: boolean } = {}): PanelInsightsActionDeps {
  const store = new MemoryStore();
  seed(store, options);
  return {
    currentUserResolver: async () => user,
    salesRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).sales,
    cashRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).cash,
    productsRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).products,
  };
}

describe("Panel - Server Actions (D7)", () => {
  it("devuelve top productos, margen e ingresos/egresos del día para el dueño", async () => {
    const result = await createGetPanelInsightsAction(makeDeps(owner))({ dayKey: DAY_KEY });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Solo la venta pagada: 3 de Coca-Cola y 1 de Arroz (la anulada no cuenta).
    expect(result.data.topProducts).toHaveLength(2);
    expect(result.data.topProducts[0]).toMatchObject({
      productId: "prod-a",
      name: "Coca-Cola 2L",
      units: 3,
      totalCents: 4500,
    });

    // Ingresos 10.000 y egresos 2.500 de hoy; ignoran el movimiento de ayer
    // y los de la sesión cerrada antes de hoy.
    expect(result.data.cashDay).toEqual({ incomeCents: 10000, expenseCents: 2500 });

    // Margen: ingresos 5.300 − costo (3×700 + 1×300) = 2.400 → 2.900
    expect(result.data.margin).toEqual({
      marginCents: 2900,
      revenueCents: 5300,
      costCents: 2400,
    });
  });

  it("oculta el margen (null) cuando algún producto vendido no tiene costo", async () => {
    const result = await createGetPanelInsightsAction(makeDeps(owner, { missingCost: true }))({
      dayKey: DAY_KEY,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.margin).toBeNull();
    expect(result.data.topProducts).toHaveLength(2);
  });

  it("rechaza a cajeros y usuarios no autenticados", async () => {
    const forCashier = await createGetPanelInsightsAction(makeDeps(cashier))({ dayKey: DAY_KEY });
    expect(forCashier.ok).toBe(false);
    if (!forCashier.ok) expect(forCashier.code).toBe("FORBIDDEN");

    const forAnonymous = await createGetPanelInsightsAction(makeDeps(null))({ dayKey: DAY_KEY });
    expect(forAnonymous.ok).toBe(false);
    if (!forAnonymous.ok) expect(forAnonymous.code).toBe("UNAUTHENTICATED");
  });

  it("valida el formato de la fecha con Zod estricto", async () => {
    const result = await createGetPanelInsightsAction(makeDeps(owner))({
      dayKey: "03-11-2026",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_ERROR");
  });
});
