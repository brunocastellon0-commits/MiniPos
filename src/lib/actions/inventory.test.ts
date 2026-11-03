import { describe, expect, it } from "vitest";
import { MemoryInventoryRepo } from "@/lib/repos/memory/inventory";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import { MemoryProductsRepo } from "@/lib/repos/memory/products";
import type { InventoryRepo, ProductsRepo, UserContext } from "@/lib/repos/types";
import {
  createListInventoryProductsAction,
  createListStockMovementsAction,
  type InventoryActionDeps,
} from "./inventory-core";
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

async function setup() {
  const store = new MemoryStore();
  const ownerContext: UserContext = { id: owner.id, role: "owner", active: true };

  const productsRepo = new MemoryProductsRepo(store, ownerContext);
  const coca = await productsRepo.create({
    name: "Coca-Cola 2L",
    barcode: "7771234567890",
    price_cents: 1250,
    stock_qty: 3,
    min_stock: 5,
  });
  const galletas = await productsRepo.create({
    name: "Galletas",
    price_cents: 350,
    stock_qty: 20,
    min_stock: 5,
    active: false,
  });

  const inventoryRepo = new MemoryInventoryRepo(store, ownerContext);
  await inventoryRepo.addMovement({
    product_id: coca.id,
    kind: "sale",
    delta: -2,
    reason: "Venta",
    ref_type: "sale",
    ref_id: "sale-1",
    user_id: owner.id,
  });
  await inventoryRepo.addMovement({
    product_id: galletas.id,
    kind: "adjustment",
    delta: 5,
    reason: "Conteo de almacén",
    user_id: owner.id,
  });

  const makeDeps = (user: AuthenticatedUser | null): InventoryActionDeps => ({
    currentUserResolver: async () => user,
    productsRepoFactory: async (ctx: UserContext): Promise<ProductsRepo> =>
      new MemoryProductsRepo(store, ctx),
    inventoryRepoFactory: async (ctx: UserContext): Promise<InventoryRepo> =>
      new MemoryInventoryRepo(store, ctx),
  });

  return { makeDeps, coca, galletas };
}

describe("Inventario - Server Actions (E6-01 / E6-03)", () => {
  it("el dueño lista todos los productos (incluidos inactivos) con stock y mínimo", async () => {
    const { makeDeps } = await setup();
    const result = await createListInventoryProductsAction(makeDeps(owner))();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      const names = result.data.map((product) => product.name).sort();
      expect(names).toEqual(["Coca-Cola 2L", "Galletas"]);
      const coca = result.data.find((product) => product.name === "Coca-Cola 2L");
      // 3 iniciales menos el movimiento de venta de -2 registrado en la siembra
      expect(coca?.stock_qty).toBe(1);
      expect(coca?.min_stock).toBe(5);
    }
  });

  it("el dueño lista el historial de movimientos con filtro por producto y límite", async () => {
    const { makeDeps, coca } = await setup();

    const all = await createListStockMovementsAction(makeDeps(owner))({});
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.data).toHaveLength(2);
      const deltas = all.data.map((movement) => movement.delta).sort();
      expect(deltas).toEqual([-2, 5]);
    }

    const filtered = await createListStockMovementsAction(makeDeps(owner))({
      productId: coca.id,
    });
    expect(filtered.ok).toBe(true);
    if (filtered.ok) {
      expect(filtered.data).toHaveLength(1);
      expect(filtered.data[0]?.kind).toBe("sale");
      expect(filtered.data[0]?.ref_id).toBe("sale-1");
    }

    const limited = await createListStockMovementsAction(makeDeps(owner))({ limit: 1 });
    expect(limited.ok).toBe(true);
    if (limited.ok) expect(limited.data).toHaveLength(1);
  });

  it("el cajero no puede listar productos ni movimientos (FORBIDDEN)", async () => {
    const { makeDeps } = await setup();

    const products = await createListInventoryProductsAction(makeDeps(cashier))();
    expect(products.ok).toBe(false);
    if (!products.ok) expect(products.code).toBe("FORBIDDEN");

    const movements = await createListStockMovementsAction(makeDeps(cashier))({});
    expect(movements.ok).toBe(false);
    if (!movements.ok) expect(movements.code).toBe("FORBIDDEN");
  });

  it("sin sesión el acceso es UNAUTHENTICATED", async () => {
    const { makeDeps } = await setup();

    const products = await createListInventoryProductsAction(makeDeps(null))();
    expect(products.ok).toBe(false);
    if (!products.ok) expect(products.code).toBe("UNAUTHENTICATED");

    const movements = await createListStockMovementsAction(makeDeps(null))({});
    expect(movements.ok).toBe(false);
    if (!movements.ok) expect(movements.code).toBe("UNAUTHENTICATED");
  });

  it("rechaza entradas inválidas o claves desconocidas (Zod estricto)", async () => {
    const { makeDeps } = await setup();
    const list = createListStockMovementsAction(makeDeps(owner));

    const zeroLimit = await list({ limit: 0 });
    expect(zeroLimit.ok).toBe(false);
    if (!zeroLimit.ok) expect(zeroLimit.code).toBe("VALIDATION_ERROR");

    const emptyProductId = await list({ productId: "" });
    expect(emptyProductId.ok).toBe(false);
    if (!emptyProductId.ok) expect(emptyProductId.code).toBe("VALIDATION_ERROR");

    const unknownKey = await list({ page: 2 } as never);
    expect(unknownKey.ok).toBe(false);
    if (!unknownKey.ok) expect(unknownKey.code).toBe("VALIDATION_ERROR");
  });
});
