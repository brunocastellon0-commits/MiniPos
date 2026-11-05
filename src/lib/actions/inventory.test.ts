import { describe, expect, it } from "vitest";
import { MemoryInventoryRepo } from "@/lib/repos/memory/inventory";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import { MemoryProductsRepo } from "@/lib/repos/memory/products";
import type { InventoryRepo, ProductsRepo, UserContext } from "@/lib/repos/types";
import {
  createAdjustStockAction,
  createCountLowStockAction,
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

  return { store, makeDeps, coca, galletas };
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

  it("cuenta solo activos con stock <= mínimo (badge de stock bajo)", async () => {
    const { makeDeps, store } = await setup();
    const ownerContext: UserContext = { id: owner.id, role: "owner", active: true };
    const productsRepo = new MemoryProductsRepo(store, ownerContext);

    // Siembra base: coca (activo, 1 <= 5) ya es stock bajo; galletas está inactiva.
    await productsRepo.create({ name: "En el límite", price_cents: 100, stock_qty: 5, min_stock: 5 });
    await productsRepo.create({ name: "Stock sano", price_cents: 100, stock_qty: 6, min_stock: 5 });
    await productsRepo.create({
      name: "Inactivo bajo",
      price_cents: 100,
      stock_qty: 0,
      min_stock: 5,
      active: false,
    });

    const result = await createCountLowStockAction(makeDeps(owner))();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(2);
  });

  it("el conteo de stock bajo es solo del dueño (cajero y anónimo)", async () => {
    const { makeDeps } = await setup();

    const byCashier = await createCountLowStockAction(makeDeps(cashier))();
    expect(byCashier.ok).toBe(false);
    if (!byCashier.ok) expect(byCashier.code).toBe("FORBIDDEN");

    const anon = await createCountLowStockAction(makeDeps(null))();
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");
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

describe("Ajustes y mermas (E6-02 · RPC adjust_stock)", () => {
  it("el dueño ajusta el stock y queda movimiento con motivo, ref manual y usuario", async () => {
    const { makeDeps, coca } = await setup();
    const adjust = createAdjustStockAction(makeDeps(owner));

    // stock tras la siembra: 3 - 2 = 1
    const result = await adjust({
      productId: coca.id,
      delta: 3,
      kind: "adjustment",
      reason: "  Conteo de almacén  ",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(4);

    const products = await createListInventoryProductsAction(makeDeps(owner))();
    expect(products.ok).toBe(true);
    if (products.ok) {
      const updated = products.data.find((product) => product.id === coca.id);
      expect(updated?.stock_qty).toBe(4);
    }

    const movements = await createListStockMovementsAction(makeDeps(owner))({
      productId: coca.id,
    });
    expect(movements.ok).toBe(true);
    if (movements.ok) {
      const manual = movements.data.find((movement) => movement.kind === "adjustment");
      expect(manual?.delta).toBe(3);
      expect(manual?.reason).toBe("Conteo de almacén");
      expect(manual?.ref_type).toBe("manual");
      expect(manual?.user_id).toBe(owner.id);
    }
  });

  it("una merma reduce el stock", async () => {
    const { makeDeps, coca } = await setup();
    const adjust = createAdjustStockAction(makeDeps(owner));

    const result = await adjust({
      productId: coca.id,
      delta: -1,
      kind: "waste",
      reason: "Paquete dañado",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(0);
  });

  it("valida delta ≠ 0, motivo obligatorio y tipo de movimiento", async () => {
    const { makeDeps, coca } = await setup();
    const adjust = createAdjustStockAction(makeDeps(owner));

    const zeroDelta = await adjust({
      productId: coca.id,
      delta: 0,
      kind: "adjustment",
      reason: "Motivo",
    });
    expect(zeroDelta.ok).toBe(false);
    if (!zeroDelta.ok) expect(zeroDelta.code).toBe("VALIDATION_ERROR");

    const emptyReason = await adjust({
      productId: coca.id,
      delta: 2,
      kind: "adjustment",
      reason: "   ",
    });
    expect(emptyReason.ok).toBe(false);
    if (!emptyReason.ok) expect(emptyReason.code).toBe("VALIDATION_ERROR");

    const badKind = await adjust({
      productId: coca.id,
      delta: 2,
      kind: "sale" as "adjustment",
      reason: "Motivo",
    });
    expect(badKind.ok).toBe(false);
    if (!badKind.ok) expect(badKind.code).toBe("VALIDATION_ERROR");

    const unknownKey = await adjust({
      productId: coca.id,
      delta: 2,
      kind: "adjustment",
      reason: "Motivo",
      extra: true,
    } as never);
    expect(unknownKey.ok).toBe(false);
    if (!unknownKey.ok) expect(unknownKey.code).toBe("VALIDATION_ERROR");
  });

  it("bloquea dejar el stock en negativo (BAD_REQUEST) y producto inexistente (NOT_FOUND)", async () => {
    const { makeDeps, coca } = await setup();
    const adjust = createAdjustStockAction(makeDeps(owner));

    const negative = await adjust({
      productId: coca.id,
      delta: -99,
      kind: "waste",
      reason: "Merma grande",
    });
    expect(negative.ok).toBe(false);
    if (!negative.ok) {
      expect(negative.code).toBe("BAD_REQUEST");
      expect(negative.message).toContain("negativo");
    }

    const missing = await adjust({
      productId: "no-existe",
      delta: 1,
      kind: "adjustment",
      reason: "Motivo",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("NOT_FOUND");
  });

  it("solo el dueño ajusta; cajero y anónimo no", async () => {
    const { makeDeps, coca } = await setup();

    const byCashier = await createAdjustStockAction(makeDeps(cashier))({
      productId: coca.id,
      delta: 1,
      kind: "adjustment",
      reason: "Intento",
    });
    expect(byCashier.ok).toBe(false);
    if (!byCashier.ok) expect(byCashier.code).toBe("FORBIDDEN");

    const anon = await createAdjustStockAction(makeDeps(null))({
      productId: coca.id,
      delta: 1,
      kind: "adjustment",
      reason: "Intento",
    });
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");
  });
});
