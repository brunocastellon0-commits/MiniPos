import { describe, expect, it } from "vitest";
import { MemoryInventoryRepo } from "@/lib/repos/memory/inventory";
import { MemoryProductsRepo } from "@/lib/repos/memory/products";
import { MemoryPurchasesRepo } from "@/lib/repos/memory/purchases";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import { MemorySuppliersRepo } from "@/lib/repos/memory/suppliers";
import type {
  Product,
  ProductsRepo,
  Purchase,
  PurchasesRepo,
  SuppliersRepo,
  UserContext,
} from "@/lib/repos/types";
import {
  createReceivePurchaseAction,
  type PurchasesActionDeps,
} from "../purchases-core";
import type { AuthenticatedUser } from "../secure-action";

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

interface Seed {
  store: MemoryStore;
  makeDeps: (user: AuthenticatedUser | null) => PurchasesActionDeps;
  purchase: Purchase;
  arroz: Product;
  leche: Product;
}

async function setup(): Promise<Seed> {
  const store = new MemoryStore();
  const ownerContext: UserContext = { id: owner.id, role: "owner", active: true };

  const supplier = await new MemorySuppliersRepo(store, ownerContext).create({
    name: "Distribuidora Andina",
  });
  const arroz = await new MemoryProductsRepo(store, ownerContext).create({
    name: "Arroz 1kg",
    price_cents: 1500,
    cost_cents: 900,
    stock_qty: 0,
  });
  const leche = await new MemoryProductsRepo(store, ownerContext).create({
    name: "Leche 1L",
    price_cents: 800,
    cost_cents: 500,
    stock_qty: 0,
  });

  const { purchase } = await new MemoryPurchasesRepo(store, ownerContext).createPurchase(
    { supplier_id: supplier.id, status: "ordered", total_cents: 14000 },
    [
      { product_id: arroz.id, qty_ordered: 10, qty_received: 0, unit_cost_cents: 950 },
      { product_id: leche.id, qty_ordered: 5, qty_received: 0, unit_cost_cents: 500 },
    ],
  );

  const makeDeps = (user: AuthenticatedUser | null): PurchasesActionDeps => ({
    currentUserResolver: async () => user,
    purchasesRepoFactory: async (ctx: UserContext): Promise<PurchasesRepo> =>
      new MemoryPurchasesRepo(store, ctx),
    suppliersRepoFactory: async (ctx: UserContext): Promise<SuppliersRepo> =>
      new MemorySuppliersRepo(store, ctx),
    productsRepoFactory: async (ctx: UserContext): Promise<ProductsRepo> =>
      new MemoryProductsRepo(store, ctx),
  });

  return { store, makeDeps, purchase, arroz, leche };
}

async function stockOf(store: MemoryStore, productId: string): Promise<number> {
  const ownerContext: UserContext = { id: owner.id, role: "owner", active: true };
  const product = await new MemoryProductsRepo(store, ownerContext).getById(productId);
  return product?.stock_qty ?? -1;
}

async function movementCount(store: MemoryStore, productId: string): Promise<number> {
  const ownerContext: UserContext = { id: owner.id, role: "owner", active: true };
  const inventory = new MemoryInventoryRepo(store, ownerContext);
  const list = await inventory.listMovements({ productId });
  return list.length;
}

describe("Recepción de compras (E7-03 · RPC receive_purchase)", () => {
  it("flujo completo: parcial, idempotencia, exceso, completado y costo", async () => {
    const { store, makeDeps, purchase, arroz, leche } = await setup();
    const receive = createReceivePurchaseAction(makeDeps(owner));

    // 1) Recepción parcial: 4 de 10 arroz, 0 de 5 leche
    const partial = await receive({
      purchaseId: purchase.id,
      items: [
        { productId: arroz.id, qtyReceived: 4 },
        { productId: leche.id, qtyReceived: 0 },
      ],
    });
    expect(partial.ok).toBe(true);
    if (partial.ok) expect(partial.data.purchase.status).toBe("partial");
    expect(await stockOf(store, arroz.id)).toBe(4);
    expect(await stockOf(store, leche.id)).toBe(0);
    const movementsAfterFirst = await movementCount(store, arroz.id);
    expect(movementsAfterFirst).toBe(1);

    // 2) Idempotente: repetir la misma recepción no vuelve a sumar stock
    const repeated = await receive({
      purchaseId: purchase.id,
      items: [
        { productId: arroz.id, qtyReceived: 4 },
        { productId: leche.id, qtyReceived: 0 },
      ],
    });
    expect(repeated.ok).toBe(true);
    expect(await stockOf(store, arroz.id)).toBe(4);
    expect(await movementCount(store, arroz.id)).toBe(1);

    // 3) No se puede recibir más de lo ordenado
    const overOrder = await receive({
      purchaseId: purchase.id,
      items: [{ productId: arroz.id, qtyReceived: 11 }],
    });
    expect(overOrder.ok).toBe(false);
    if (!overOrder.ok) {
      expect(overOrder.code).toBe("BAD_REQUEST");
      expect(overOrder.message).toContain("superar la ordenada");
    }
    expect(await stockOf(store, arroz.id)).toBe(4);

    // 4) Completar todo → estado received
    const complete = await receive({
      purchaseId: purchase.id,
      items: [
        { productId: arroz.id, qtyReceived: 10 },
        { productId: leche.id, qtyReceived: 5 },
      ],
      updateCost: true,
    });
    expect(complete.ok).toBe(true);
    if (complete.ok) expect(complete.data.purchase.status).toBe("received");
    expect(await stockOf(store, arroz.id)).toBe(10);
    expect(await stockOf(store, leche.id)).toBe(5);

    // 5) updateCost: costo del producto pasa a ser el de la compra
    const ownerContext: UserContext = { id: owner.id, role: "owner", active: true };
    const updatedArroz = await new MemoryProductsRepo(store, ownerContext).getById(arroz.id);
    expect(updatedArroz?.cost_cents).toBe(950);
  });

  it("valida entradas: compra inexistente, cancelada, sin ítems y claves desconocidas", async () => {
    const { store, makeDeps, purchase, arroz } = await setup();
    const receive = createReceivePurchaseAction(makeDeps(owner));

    const missing = await receive({ purchaseId: "no-existe", items: [{ productId: arroz.id, qtyReceived: 1 }] });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("NOT_FOUND");

    const ownerContext: UserContext = { id: owner.id, role: "owner", active: true };
    await new MemoryPurchasesRepo(store, ownerContext).updateStatus(purchase.id, "cancelled");
    const cancelled = await receive({ purchaseId: purchase.id, items: [{ productId: arroz.id, qtyReceived: 1 }] });
    expect(cancelled.ok).toBe(false);
    if (!cancelled.ok) expect(cancelled.code).toBe("BAD_REQUEST");

    await new MemoryPurchasesRepo(store, ownerContext).updateStatus(purchase.id, "ordered");
    const noItems = await receive({ purchaseId: purchase.id, items: [] });
    expect(noItems.ok).toBe(false);
    if (!noItems.ok) expect(noItems.code).toBe("VALIDATION_ERROR");

    const unknownKey = await receive({
      purchaseId: purchase.id,
      items: [{ productId: arroz.id, qtyReceived: 1 }],
      extra: true,
    } as never);
    expect(unknownKey.ok).toBe(false);
    if (!unknownKey.ok) expect(unknownKey.code).toBe("VALIDATION_ERROR");
  });

  it("solo el dueño recibe; cajero y anónimo no", async () => {
    const { makeDeps, purchase, arroz } = await setup();
    const payload = { purchaseId: purchase.id, items: [{ productId: arroz.id, qtyReceived: 1 }] };

    const byCashier = await createReceivePurchaseAction(makeDeps(cashier))(payload);
    expect(byCashier.ok).toBe(false);
    if (!byCashier.ok) expect(byCashier.code).toBe("FORBIDDEN");

    const anon = await createReceivePurchaseAction(makeDeps(null))(payload);
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");
  });
});
