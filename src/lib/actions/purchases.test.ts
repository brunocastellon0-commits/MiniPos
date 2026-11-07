import { describe, expect, it, vi } from "vitest";
import { MemoryAuditRepo } from "@/lib/repos/memory/audit";
import { MemoryProductsRepo } from "@/lib/repos/memory/products";
import { MemoryPurchasesRepo } from "@/lib/repos/memory/purchases";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import { MemorySuppliersRepo } from "@/lib/repos/memory/suppliers";
import { MemoryUsersRepo } from "@/lib/repos/memory/users";
import { buildProfile } from "@/test/factories";
import type {
  AuditRepo,
  ProductsRepo,
  PurchasesRepo,
  SuppliersRepo,
  UserContext,
  UsersRepo,
} from "@/lib/repos/types";
import {
  createCancelPurchaseAction,
  createCreatePurchaseAction,
  createGetPurchaseAction,
  createGetPurchaseTimelineAction,
  createListPurchasesAction,
  createReceivePurchaseAction,
  createRegisterPurchaseVisitAction,
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

  store.profiles.set(
    owner.id,
    buildProfile({ id: owner.id, full_name: owner.name, role: "owner" }),
  );

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
    auditRepoFactory: async (ctx: UserContext): Promise<AuditRepo> =>
      new MemoryAuditRepo(store, ctx),
    usersRepoFactory: async (ctx: UserContext): Promise<UsersRepo> =>
      new MemoryUsersRepo(store, ctx),
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

describe("Compras - seguimiento, cancelación y auditoría (D4)", () => {
  async function seedPurchase() {
    const ctx = await setup();
    const created = await createCreatePurchaseAction(ctx.makeDeps(owner))({
      supplierId: ctx.supplier.id,
      notes: "Entrega el viernes",
      items: [{ productId: ctx.arroz.id, quantity: 10, unitCostCents: 900 }],
    });
    if (!created.ok) throw new Error("No se pudo sembrar la compra");
    return { ...ctx, purchaseId: created.data.purchase.id };
  }

  it("escribe auditoría al crear una compra y al recibirla", async () => {
    const { makeDeps, store, supplier, arroz, purchaseId } = await seedPurchase();

    const auditRepo = new MemoryAuditRepo(store, {
      id: owner.id,
      role: "owner",
      active: true,
    });
    const afterCreate = await auditRepo.list({ entity: "purchase" });
    const createEntry = afterCreate.find((entry) => entry.action === "purchases.create");
    expect(createEntry).toBeDefined();
    expect(createEntry?.entity_id).toBe(purchaseId);

    const received = await createReceivePurchaseAction(makeDeps(owner))({
      purchaseId,
      items: [{ productId: arroz.id, qtyReceived: 10 }],
    });
    expect(received.ok).toBe(true);

    const afterReceive = await auditRepo.list({ entity: "purchase" });
    const receiveEntry = afterReceive.find((entry) => entry.action === "purchases.receive");
    expect(receiveEntry).toBeDefined();
    expect(receiveEntry?.entity_id).toBe(purchaseId);

    const otherPurchase = await createCreatePurchaseAction(makeDeps(owner))({
      supplierId: supplier.id,
      items: [{ productId: arroz.id, quantity: 1, unitCostCents: 100 }],
    });
    expect(otherPurchase.ok).toBe(true);
    const allEntries = await auditRepo.list({ entity: "purchase" });
    expect(allEntries.filter((entry) => entry.entity_id === purchaseId)).toHaveLength(2);
  });

  it("cancela una compra activa con motivo y bloquea la cancelación de una recibida", async () => {
    const { makeDeps, store, purchaseId } = await seedPurchase();
    const cancel = createCancelPurchaseAction(makeDeps(owner));

    const invalidReason = await cancel({ purchaseId, reason: "no" });
    expect(invalidReason.ok).toBe(false);
    if (!invalidReason.ok) expect(invalidReason.code).toBe("VALIDATION_ERROR");

    const missing = await cancel({ purchaseId: "no-existe", reason: "Sin proveedor" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("NOT_FOUND");

    const cancelled = await cancel({ purchaseId, reason: "El proveedor no tiene mercadería" });
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) expect(cancelled.data.status).toBe("cancelled");

    const auditRepo = new MemoryAuditRepo(store, {
      id: owner.id,
      role: "owner",
      active: true,
    });
    const entries = await auditRepo.list({ entity: "purchase" });
    const cancelEntry = entries.find((entry) => entry.action === "purchases.cancel");
    expect(cancelEntry?.reason).toBe("El proveedor no tiene mercadería");
    expect(cancelEntry?.entity_id).toBe(purchaseId);

    const twice = await cancel({ purchaseId, reason: "Otra vez por si acaso" });
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.code).toBe("BAD_REQUEST");

    const receivedSetup = await seedPurchase();
    const receive = await createReceivePurchaseAction(receivedSetup.makeDeps(owner))({
      purchaseId: receivedSetup.purchaseId,
      items: [{ productId: receivedSetup.arroz.id, qtyReceived: 10 }],
    });
    expect(receive.ok).toBe(true);
    const cancelReceived = await createCancelPurchaseAction(receivedSetup.makeDeps(owner))({
      purchaseId: receivedSetup.purchaseId,
      reason: "Intento de cancelar lo recibido",
    });
    expect(cancelReceived.ok).toBe(false);
    if (!cancelReceived.ok) expect(cancelReceived.code).toBe("BAD_REQUEST");

    const byCashier = await createCancelPurchaseAction(makeDeps(cashier))({
      purchaseId,
      reason: "El cajero no puede cancelar",
    });
    expect(byCashier.ok).toBe(false);
    if (!byCashier.ok) expect(byCashier.code).toBe("FORBIDDEN");
  });

  it("registra la visita del preventista con motivo en la bitácora", async () => {
    const { makeDeps, store, purchaseId } = await seedPurchase();
    const registerVisit = createRegisterPurchaseVisitAction(makeDeps(owner));

    const missing = await registerVisit({ purchaseId: "no-existe" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("NOT_FOUND");

    const withNotes = await registerVisit({ purchaseId, notes: "Dejó muestras" });
    expect(withNotes.ok).toBe(true);

    const withoutNotes = await registerVisit({ purchaseId });
    expect(withoutNotes.ok).toBe(true);

    const auditRepo = new MemoryAuditRepo(store, {
      id: owner.id,
      role: "owner",
      active: true,
    });
    const entries = await auditRepo.list({ entity: "purchase" });
    const visits = entries.filter((entry) => entry.action === "purchases.visit");
    expect(visits).toHaveLength(2);
    expect(visits.map((entry) => entry.reason)).toContain("Dejó muestras");
    expect(visits.map((entry) => entry.reason)).toContain("Visita de preventista");
    expect(visits.every((entry) => entry.entity_id === purchaseId)).toBe(true);
  });

  it("devuelve el historial de una compra con el nombre del usuario", async () => {
    const { makeDeps, purchaseId } = await seedPurchase();
    await createRegisterPurchaseVisitAction(makeDeps(owner))({
      purchaseId,
      notes: "Habló con el vendedor",
    });
    await createCancelPurchaseAction(makeDeps(owner))({
      purchaseId,
      reason: "Se cancela el pedido",
    });

    const timeline = await createGetPurchaseTimelineAction(makeDeps(owner))({ purchaseId });
    expect(timeline.ok).toBe(true);
    if (!timeline.ok) return;
    expect(timeline.data.length).toBeGreaterThanOrEqual(3);
    expect(timeline.data.every((entry) => entry.userName === owner.name)).toBe(true);
    expect(timeline.data.map((entry) => entry.action)).toContain("purchases.visit");
    expect(timeline.data.map((entry) => entry.action)).toContain("purchases.cancel");

    const other = await seedPurchase();
    const otherTimeline = await createGetPurchaseTimelineAction(other.makeDeps(owner))({
      purchaseId: other.purchaseId,
    });
    expect(otherTimeline.ok).toBe(true);
    if (otherTimeline.ok) {
      expect(otherTimeline.data.every((entry) => entry.action === "purchases.create")).toBe(true);
    }

    const byCashier = await createGetPurchaseTimelineAction(makeDeps(cashier))({ purchaseId });
    expect(byCashier.ok).toBe(false);
    if (!byCashier.ok) expect(byCashier.code).toBe("FORBIDDEN");
  });

  it("el cajero no registra visitas ni cancela compras", async () => {
    const { makeDeps, purchaseId } = await seedPurchase();

    const visitByCashier = await createRegisterPurchaseVisitAction(makeDeps(cashier))({
      purchaseId,
    });
    expect(visitByCashier.ok).toBe(false);
    if (!visitByCashier.ok) expect(visitByCashier.code).toBe("FORBIDDEN");

    const cancelByCashier = await createCancelPurchaseAction(makeDeps(cashier))({
      purchaseId,
      reason: "No autorizado",
    });
    expect(cancelByCashier.ok).toBe(false);
    if (!cancelByCashier.ok) expect(cancelByCashier.code).toBe("FORBIDDEN");
  });
});
