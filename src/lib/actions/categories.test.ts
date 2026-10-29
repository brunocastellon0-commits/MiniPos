import { describe, expect, it } from "vitest";
import { MemoryAuditRepo } from "@/lib/repos/memory/audit";
import { MemoryCategoriesRepo } from "@/lib/repos/memory/categories";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import { MemoryProductsRepo } from "@/lib/repos/memory/products";
import type { AuditRepo, CategoriesRepo, ProductsRepo, UserContext } from "@/lib/repos/types";
import type { AuthenticatedUser } from "./secure-action";
import {
  type CategoriesActionDeps,
  createCreateCategoryAction,
  createDeleteCategoryAction,
  createListCategoriesAction,
  createReorderCategoriesAction,
  createUpdateCategoryAction,
} from "./categories-core";

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

function setup() {
  const store = new MemoryStore();

  const makeDeps = (user: AuthenticatedUser | null): CategoriesActionDeps => ({
    currentUserResolver: async () => user,
    categoriesRepoFactory: async (ctx: UserContext): Promise<CategoriesRepo> =>
      new MemoryCategoriesRepo(store, ctx),
    productsRepoFactory: async (ctx: UserContext): Promise<ProductsRepo> =>
      new MemoryProductsRepo(store, ctx),
    auditRepoFactory: async (ctx: UserContext): Promise<AuditRepo> =>
      new MemoryAuditRepo(store, ctx),
  });

  return { store, makeDeps };
}

describe("Categorías - Server Actions (E2-01)", () => {
  it("lista categorías ordenadas", async () => {
    const { makeDeps } = setup();
    await createCreateCategoryAction(makeDeps(owner))({ name: "Bebidas", sortOrder: 2 });
    await createCreateCategoryAction(makeDeps(owner))({ name: "Abarrotes", sortOrder: 1 });

    const result = await createListCategoriesAction(makeDeps(owner))();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((category) => category.name)).toEqual(["Abarrotes", "Bebidas"]);
    }
  });

  it("crea una categoría, normaliza el nombre y registra auditoría", async () => {
    const { makeDeps, store } = setup();
    const create = createCreateCategoryAction(makeDeps(owner));

    const result = await create({ name: "  Bebidas   frías  " });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Bebidas frías");
      expect(result.data.sort_order).toBe(0);
      expect(result.data.active).toBe(true);
    }

    const logs = Array.from(store.auditLog.values());
    expect(logs.some((log) => log.action === "categories.create")).toBe(true);
  });

  it("rechaza nombres duplicados sin distinguir mayúsculas", async () => {
    const { makeDeps } = setup();
    await createCreateCategoryAction(makeDeps(owner))({ name: "Bebidas" });

    const result = await createCreateCategoryAction(makeDeps(owner))({ name: "bebidas" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Ya existe una categoría");
    }
  });

  it("permite renombrar y desactivar una categoría", async () => {
    const { makeDeps } = setup();
    const created = await createCreateCategoryAction(makeDeps(owner))({ name: "Bebidas" });
    if (!created.ok) throw new Error("No se pudo crear la categoría de prueba");

    const result = await createUpdateCategoryAction(makeDeps(owner))({
      id: created.data.id,
      name: "Bebidas y jugos",
      active: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Bebidas y jugos");
      expect(result.data.active).toBe(false);
    }
  });

  it("reordena categorías y rechaza listas obsoletas", async () => {
    const { makeDeps } = setup();
    const first = await createCreateCategoryAction(makeDeps(owner))({ name: "Abarrotes" });
    const second = await createCreateCategoryAction(makeDeps(owner))({ name: "Bebidas" });
    const third = await createCreateCategoryAction(makeDeps(owner))({ name: "Lácteos" });
    if (!first.ok || !second.ok || !third.ok) throw new Error("No se pudieron crear categorías");

    const result = await createReorderCategoriesAction(makeDeps(owner))({
      ids: [third.data.id, first.data.id, second.data.id],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((category) => category.name)).toEqual([
        "Lácteos",
        "Abarrotes",
        "Bebidas",
      ]);
      expect(result.data.map((category) => category.sort_order)).toEqual([0, 1, 2]);
    }

    const stale = await createReorderCategoriesAction(makeDeps(owner))({
      ids: [first.data.id, second.data.id],
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.code).toBe("CONFLICT");
    }
  });

  it("bloquea eliminar una categoría con productos y permite eliminarla vacía", async () => {
    const { makeDeps, store } = setup();
    const cat = await createCreateCategoryAction(makeDeps(owner))({ name: "Lácteos" });
    if (!cat.ok) throw new Error("No se pudo crear la categoría");

    await new MemoryProductsRepo(store, { id: owner.id, role: "owner", active: true }).create({
      name: "Leche",
      price_cents: 700,
      category_id: cat.data.id,
    });

    const blocked = await createDeleteCategoryAction(makeDeps(owner))({ id: cat.data.id });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.message).toContain("productos");
    }
    expect(store.categories.has(cat.data.id)).toBe(true);

    const empty = await createCreateCategoryAction(makeDeps(owner))({ name: "Sin productos" });
    if (!empty.ok) throw new Error("No se pudo crear la categoría vacía");
    const deleted = await createDeleteCategoryAction(makeDeps(owner))({ id: empty.data.id });
    expect(deleted.ok).toBe(true);
    expect(store.categories.has(empty.data.id)).toBe(false);
  });

  it("deniega mutaciones a un cajero y a una sesión anónima", async () => {
    const { makeDeps } = setup();

    const cashierResult = await createCreateCategoryAction(makeDeps(cashier))({ name: "Bebidas" });
    expect(cashierResult.ok).toBe(false);
    if (!cashierResult.ok) expect(cashierResult.code).toBe("FORBIDDEN");

    const anonResult = await createCreateCategoryAction(makeDeps(null))({ name: "Bebidas" });
    expect(anonResult.ok).toBe(false);
    if (!anonResult.ok) expect(anonResult.code).toBe("UNAUTHENTICATED");
  });
});
