import { describe, expect, it, vi } from "vitest";
import { MemoryProductsRepo } from "@/lib/repos/memory/products";
import { MemoryPurchasesRepo } from "@/lib/repos/memory/purchases";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import { MemorySuppliersRepo } from "@/lib/repos/memory/suppliers";
import type {
  ProductsRepo,
  PurchasesRepo,
  SuppliersRepo,
  UserContext,
} from "@/lib/repos/types";
import {
  createCreatePurchaseAction,
  createGetPurchaseAction,
  createListPurchasesAction,
  type PurchasesActionDeps,
} from "./purchases-core";
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

  const supplier = await new MemorySuppliersRepo(store, ownerContext).create({
    name: "Distribuidora Andina",
  });
  const inactiveSupplier = await new MemorySuppliersRepo(store, ownerContext).create({
    name: "Proveedor Inactivo",
    active: false,
  });

  const productsRepo = new MemoryProductsRepo(store, ownerContext);
  const arroz = await productsRepo.create({
    name: "Arroz 1kg",
    price_cents: 1500,
    cost_cents: 900,
    stock_qty: 0,
  });
  const leche = await productsRepo.create({
    name: "Leche 1L",
    price_cents: 800,
    cost_cents: 500,
    stock_qty: 0,
  });
  const retired = await productsRepo.create({
    name: "Producto Retirado",
    price_cents: 100,
    stock_qty: 0,
    active: false,
  });

  const makeDeps = (user: AuthenticatedUser | null): PurchasesActionDeps => ({
    currentUserResolver: async () => user,
    purchasesRepoFactory: async (ctx: UserContext): Promise<PurchasesRepo> =>
      new MemoryPurchasesRepo(store, ctx),
    suppliersRepoFactory: async (ctx: UserContext): Promise<SuppliersRepo> =>
      new MemorySuppliersRepo(store, ctx),
    productsRepoFactory: async (ctx: UserContext): Promise<ProductsRepo> =>
      new MemoryProductsRepo(store, ctx),
  });

  return { store, makeDeps, supplier, inactiveSupplier, arroz, leche, retired };
}

describe("Compras - Server Actions (E7-02)", () => {
  it("registra una compra ordered con total calculado en el servidor", async () => {
    const { makeDeps, supplier, arroz, leche } = await setup();

    const result = await createCreatePurchaseAction(makeDeps(owner))({
      supplierId: supplier.id,
      notes: "Entrega el viernes",
      items: [
        { productId: arroz.id, quantity: 10, unitCostCents: 900 },
        { productId: leche.id, quantity: 6, unitCostCents: 500 },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // 10*900 + 6*500 = 12.000
      expect(result.data.purchase.total_cents).toBe(12000);
      expect(result.data.purchase.status).toBe("ordered");
      expect(result.data.purchase.supplier_id).toBe(supplier.id);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items.every((item) => item.qty_received === 0)).toBe(true);
    }
  });

  it("valida los items de la compra en una sola consulta (sin N+1, E11-05)", async () => {
    const { makeDeps, supplier, arroz, leche } = await setup();

    const getByIdsSpy = vi.spyOn(MemoryProductsRepo.prototype, "getByIds");
    const getByIdSpy = vi.spyOn(MemoryProductsRepo.prototype, "getById");
    try {
      const result = await createCreatePurchaseAction(makeDeps(owner))({
        supplierId: supplier.id,
        items: [
          { productId: arroz.id, quantity: 10, unitCostCents: 900 },
          { productId: leche.id, quantity: 6, unitCostCents: 500 },
        ],
      });

      expect(result.ok).toBe(true);
      expect(getByIdsSpy).toHaveBeenCalledTimes(1);
      expect(getByIdSpy).not.toHaveBeenCalled();
    } finally {
      getByIdsSpy.mockRestore();
      getByIdSpy.mockRestore();
    }
  });

  it("rechaza proveedor inexistente/inactivo y producto inexistente/inactivo", async () => {
    const { makeDeps, supplier, inactiveSupplier, arroz, retired } = await setup();
    const create = createCreatePurchaseAction(makeDeps(owner));

    const missingSupplier = await create({
      supplierId: "no-existe",
      items: [{ productId: arroz.id, quantity: 1, unitCostCents: 100 }],
    });
    expect(missingSupplier.ok).toBe(false);
    if (!missingSupplier.ok) expect(missingSupplier.code).toBe("NOT_FOUND");

    const inactive = await create({
      supplierId: inactiveSupplier.id,
      items: [{ productId: arroz.id, quantity: 1, unitCostCents: 100 }],
    });
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) expect(inactive.code).toBe("BAD_REQUEST");

    const missingProduct = await create({
      supplierId: supplier.id,
      items: [{ productId: "no-existe", quantity: 1, unitCostCents: 100 }],
    });
    expect(missingProduct.ok).toBe(false);
    if (!missingProduct.ok) expect(missingProduct.code).toBe("NOT_FOUND");

    const inactiveProduct = await create({
      supplierId: supplier.id,
      items: [{ productId: retired.id, quantity: 1, unitCostCents: 100 }],
    });
    expect(inactiveProduct.ok).toBe(false);
    if (!inactiveProduct.ok) expect(inactiveProduct.code).toBe("BAD_REQUEST");
  });

  it("valida ítems: vacío, repetidos, cantidad y costo", async () => {
    const { makeDeps, supplier, arroz } = await setup();
    const create = createCreatePurchaseAction(makeDeps(owner));

    const empty = await create({ supplierId: supplier.id, items: [] });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.code).toBe("VALIDATION_ERROR");

    const duplicated = await create({
      supplierId: supplier.id,
      items: [
        { productId: arroz.id, quantity: 1, unitCostCents: 100 },
        { productId: arroz.id, quantity: 2, unitCostCents: 200 },
      ],
    });
    expect(duplicated.ok).toBe(false);
    if (!duplicated.ok) expect(duplicated.code).toBe("VALIDATION_ERROR");

    const zeroQty = await create({
      supplierId: supplier.id,
      items: [{ productId: arroz.id, quantity: 0, unitCostCents: 100 }],
    });
    expect(zeroQty.ok).toBe(false);
    if (!zeroQty.ok) expect(zeroQty.code).toBe("VALIDATION_ERROR");

    const negativeCost = await create({
      supplierId: supplier.id,
      items: [{ productId: arroz.id, quantity: 1, unitCostCents: -50 }],
    });
    expect(negativeCost.ok).toBe(false);
    if (!negativeCost.ok) expect(negativeCost.code).toBe("VALIDATION_ERROR");
  });

  it("lista compras y devuelve detalle con NOT_FOUND si no existe", async () => {
    const { makeDeps, supplier, arroz } = await setup();
    const created = await createCreatePurchaseAction(makeDeps(owner))({
      supplierId: supplier.id,
      items: [{ productId: arroz.id, quantity: 2, unitCostCents: 900 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const list = await createListPurchasesAction(makeDeps(owner))();
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data.map((purchase) => purchase.id)).toContain(created.data.purchase.id);

    const detail = await createGetPurchaseAction(makeDeps(owner))({ id: created.data.purchase.id });
    expect(detail.ok).toBe(true);
    if (detail.ok) expect(detail.data.items).toHaveLength(1);

    const missing = await createGetPurchaseAction(makeDeps(owner))({ id: "no-existe" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("NOT_FOUND");
  });

  it("el cajero no registra compras y sin sesión es UNAUTHENTICATED", async () => {
    const { makeDeps, supplier, arroz } = await setup();
    const payload = {
      supplierId: supplier.id,
      items: [{ productId: arroz.id, quantity: 1, unitCostCents: 100 }],
    };

    const byCashier = await createCreatePurchaseAction(makeDeps(cashier))(payload);
    expect(byCashier.ok).toBe(false);
    if (!byCashier.ok) expect(byCashier.code).toBe("FORBIDDEN");

    const anon = await createCreatePurchaseAction(makeDeps(null))(payload);
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");
  });
});
