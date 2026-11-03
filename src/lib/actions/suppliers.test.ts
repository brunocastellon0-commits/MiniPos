import { describe, expect, it } from "vitest";
import { MemoryPurchasesRepo } from "@/lib/repos/memory/purchases";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import { MemorySuppliersRepo } from "@/lib/repos/memory/suppliers";
import type { PurchasesRepo, SuppliersRepo, UserContext } from "@/lib/repos/types";
import {
  createCreateSupplierAction,
  createDeleteSupplierAction,
  createListSuppliersAction,
  createUpdateSupplierAction,
  type SuppliersActionDeps,
} from "./suppliers-core";
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

  const makeDeps = (user: AuthenticatedUser | null): SuppliersActionDeps => ({
    currentUserResolver: async () => user,
    suppliersRepoFactory: async (ctx: UserContext): Promise<SuppliersRepo> =>
      new MemorySuppliersRepo(store, ctx),
    purchasesRepoFactory: async (ctx: UserContext): Promise<PurchasesRepo> =>
      new MemoryPurchasesRepo(store, ctx),
  });

  return { store, makeDeps };
}

describe("Proveedores - Server Actions (E7-01)", () => {
  it("el dueño crea y lista proveedores con nombre normalizado", async () => {
    const { makeDeps } = await setup();

    const created = await createCreateSupplierAction(makeDeps(owner))({
      name: "  Distribuidora Andina  ",
      phone: "71234567",
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.data.name).toBe("Distribuidora Andina");
      expect(created.data.phone).toBe("71234567");
      expect(created.data.notes).toBeNull();
      expect(created.data.active).toBe(true);
    }

    const list = await createListSuppliersAction(makeDeps(owner))();
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data).toHaveLength(1);
  });

  it("actualiza un proveedor y responde NOT_FOUND si no existe", async () => {
    const { makeDeps } = await setup();
    const created = await createCreateSupplierAction(makeDeps(owner))({ name: "Proveedor Uno" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await createUpdateSupplierAction(makeDeps(owner))({
      id: created.data.id,
      name: "Proveedor Uno SRL",
      active: false,
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.name).toBe("Proveedor Uno SRL");
      expect(updated.data.active).toBe(false);
    }

    const missing = await createUpdateSupplierAction(makeDeps(owner))({
      id: "no-existe",
      name: "Otro",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("NOT_FOUND");
  });

  it("elimina solo proveedores sin compras; con compras responde CONFLICT", async () => {
    const { store, makeDeps } = await setup();

    const created = await createCreateSupplierAction(makeDeps(owner))({ name: "Sin Compras" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const ownerContext: UserContext = { id: owner.id, role: "owner", active: true };
    const withPurchases = await createCreateSupplierAction(makeDeps(owner))({
      name: "Con Compras",
    });
    expect(withPurchases.ok).toBe(true);
    if (!withPurchases.ok) return;
    await new MemoryPurchasesRepo(store, ownerContext).createPurchase(
      { supplier_id: withPurchases.data.id, status: "ordered", total_cents: 1000 },
      [{ product_id: "prod-1", qty_ordered: 1, qty_received: 0, unit_cost_cents: 1000 }],
    );

    const conflict = await createDeleteSupplierAction(makeDeps(owner))({
      id: withPurchases.data.id,
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.code).toBe("CONFLICT");
      expect(conflict.message).toContain("compras registradas");
    }

    const deleted = await createDeleteSupplierAction(makeDeps(owner))({ id: created.data.id });
    expect(deleted.ok).toBe(true);

    const list = await createListSuppliersAction(makeDeps(owner))();
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data.map((supplier) => supplier.id)).not.toContain(created.data.id);
  });

  it("valida nombre mínimo y claves desconocidas (Zod estricto)", async () => {
    const { makeDeps } = await setup();
    const create = createCreateSupplierAction(makeDeps(owner));

    const shortName = await create({ name: "A" });
    expect(shortName.ok).toBe(false);
    if (!shortName.ok) expect(shortName.code).toBe("VALIDATION_ERROR");

    const unknownKey = await create({ name: "Proveedor X", email: "x@y.bo" } as never);
    expect(unknownKey.ok).toBe(false);
    if (!unknownKey.ok) expect(unknownKey.code).toBe("VALIDATION_ERROR");
  });

  it("el cajero no gestiona proveedores y sin sesión es UNAUTHENTICATED", async () => {
    const { makeDeps } = await setup();

    const byCashier = await createListSuppliersAction(makeDeps(cashier))();
    expect(byCashier.ok).toBe(false);
    if (!byCashier.ok) expect(byCashier.code).toBe("FORBIDDEN");

    const anon = await createCreateSupplierAction(makeDeps(null))({ name: "Anónimo" });
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");
  });
});
