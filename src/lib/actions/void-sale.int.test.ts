import { describe, expect, it } from "vitest";
import { expectedCashCents } from "@/lib/domain/cash";
import { createMemoryRepositories } from "@/lib/repos";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import type { UserContext } from "@/lib/repos/types";
import { createVoidSaleAction } from "./sales-core";
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

const ownerCtx: UserContext = { id: owner.id, role: "owner", active: true };
const cashierCtx: UserContext = { id: cashier.id, role: "cashier", active: true };

function makeDeps(store: MemoryStore) {
  return (user: AuthenticatedUser | null) => ({
    currentUserResolver: async () => user,
    salesRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).sales,
  });
}

async function seedCashSale(store: MemoryStore) {
  const ownerRepos = createMemoryRepositories(store, ownerCtx);
  const cashierRepos = createMemoryRepositories(store, cashierCtx);

  const product = await ownerRepos.products.create({
    name: "Arroz 1kg",
    price_cents: 1500,
    stock_qty: 10,
  });
  const session = await cashierRepos.cash.openSession(10000);
  const { sale } = await cashierRepos.sales.createSale(
    {
      session_id: session.id,
      subtotal_cents: 3000,
      discount_cents: 0,
      total_cents: 3000,
      payment_method: "cash",
      cash_received_cents: 5000,
      client_request_id: "req-void-1",
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

  return { product, session, sale };
}

describe("voidSaleAction (E5-02 · D-005)", () => {
  it("anula con motivo: estado voided, reversa de stock y del efectivo esperado", async () => {
    const store = new MemoryStore();
    const { product, session, sale } = await seedCashSale(store);
    const deps = makeDeps(store);

    // Efectivo esperado antes: apertura 10000 + venta en efectivo 3000
    const before = expectedCashCents({
      openingCents: session.opening_cents,
      sales: await createMemoryRepositories(store, ownerCtx).sales.list(),
      movements: [],
    });
    expect(before).toBe(13000);

    const result = await createVoidSaleAction(deps(owner))({
      saleId: sale.id,
      reason: "Error de cobro",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("voided");
    expect(result.data.void_reason).toBe("Error de cobro");
    expect(result.data.voided_by).toBe("owner-1");
    expect(result.data.voided_at).toBeTruthy();

    // Stock revertido: 8 -> 10
    const updated = await createMemoryRepositories(store, ownerCtx).products.getById(product.id);
    expect(updated?.stock_qty).toBe(10);

    const movements = await createMemoryRepositories(store, ownerCtx).inventory.listMovements({
      productId: product.id,
    });
    const voidMov = movements.find((m) => m.kind === "void_return");
    expect(voidMov?.delta).toBe(2);

    // La venta anulada deja de contar en el efectivo esperado
    const after = expectedCashCents({
      openingCents: session.opening_cents,
      sales: await createMemoryRepositories(store, ownerCtx).sales.list(),
      movements: [],
    });
    expect(after).toBe(10000);
  });

  it("exige motivo: vacío o en blanco es VALIDATION_ERROR", async () => {
    const store = new MemoryStore();
    const { sale } = await seedCashSale(store);
    const deps = makeDeps(store);

    const empty = await createVoidSaleAction(deps(owner))({ saleId: sale.id, reason: "" });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.code).toBe("VALIDATION_ERROR");

    const blank = await createVoidSaleAction(deps(owner))({ saleId: sale.id, reason: "   " });
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.code).toBe("VALIDATION_ERROR");
  });

  it("solo el dueño puede anular; cajero y anónimo no", async () => {
    const store = new MemoryStore();
    const { sale } = await seedCashSale(store);
    const deps = makeDeps(store);

    const byCashier = await createVoidSaleAction(deps(cashier))({
      saleId: sale.id,
      reason: "Cajero intenta anular",
    });
    expect(byCashier.ok).toBe(false);
    if (!byCashier.ok) expect(byCashier.code).toBe("FORBIDDEN");

    const anon = await createVoidSaleAction(deps(null))({ saleId: sale.id, reason: "Anónimo" });
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");

    // La venta sigue intacta
    const intact = await createMemoryRepositories(store, ownerCtx).sales.getById(sale.id);
    expect(intact?.sale.status).toBe("paid");
  });

  it("nunca borra: la venta queda en el historial como anulada", async () => {
    const store = new MemoryStore();
    const { sale } = await seedCashSale(store);
    const deps = makeDeps(store);

    await createVoidSaleAction(deps(owner))({ saleId: sale.id, reason: "Cancelación" });

    const all = await createMemoryRepositories(store, ownerCtx).sales.list();
    expect(all.map((s) => s.id)).toContain(sale.id);
    expect(all.find((s) => s.id === sale.id)?.status).toBe("voided");

    const paid = await createMemoryRepositories(store, ownerCtx).sales.list({ status: "paid" });
    expect(paid).toHaveLength(0);
    const voided = await createMemoryRepositories(store, ownerCtx).sales.list({ status: "voided" });
    expect(voided).toHaveLength(1);
  });

  it("es idempotente: anular dos veces no duplica la reversa de stock", async () => {
    const store = new MemoryStore();
    const { product, sale } = await seedCashSale(store);
    const deps = makeDeps(store);

    const first = await createVoidSaleAction(deps(owner))({ saleId: sale.id, reason: "Primera" });
    const second = await createVoidSaleAction(deps(owner))({ saleId: sale.id, reason: "Segunda" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.data.void_reason).toBe("Primera");
    }

    const updated = await createMemoryRepositories(store, ownerCtx).products.getById(product.id);
    expect(updated?.stock_qty).toBe(10);

    const movements = await createMemoryRepositories(store, ownerCtx).inventory.listMovements({
      productId: product.id,
    });
    expect(movements.filter((m) => m.kind === "void_return")).toHaveLength(1);
  });

  it("venta inexistente responde NOT_FOUND", async () => {
    const store = new MemoryStore();
    const deps = makeDeps(store);

    const result = await createVoidSaleAction(deps(owner))({
      saleId: "no-existe",
      reason: "Motivo",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });
});
