import { describe, expect, it } from "vitest";
import { MemoryAuditRepo } from "@/lib/repos/memory/audit";
import { MemoryCategoriesRepo } from "@/lib/repos/memory/categories";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import { MemoryProductsRepo } from "@/lib/repos/memory/products";
import { MemorySettingsRepo } from "@/lib/repos/memory/settings";
import type { AuditRepo, ProductsRepo, SettingsRepo, UserContext } from "@/lib/repos/types";
import {
  createCreateProductAction,
  createListProductsAction,
  createSetProductActiveAction,
  createUpdateProductAction,
  type ProductsActionDeps,
} from "./products-core";
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
  const category = await new MemoryCategoriesRepo(store, ownerContext).create({
    name: "Bebidas",
    sort_order: 0,
  });

  const makeDeps = (user: AuthenticatedUser | null): ProductsActionDeps => ({
    currentUserResolver: async () => user,
    productsRepoFactory: async (ctx: UserContext): Promise<ProductsRepo> =>
      new MemoryProductsRepo(store, ctx),
    auditRepoFactory: async (ctx: UserContext): Promise<AuditRepo> =>
      new MemoryAuditRepo(store, ctx),
    settingsRepoFactory: async (ctx: UserContext): Promise<SettingsRepo> =>
      new MemorySettingsRepo(store, ctx),
  });

  return { store, category, makeDeps };
}

describe("Productos - Server Actions (E2-02)", () => {
  it("crea un producto con precio en centavos, stock inicial y auditoría", async () => {
    const { makeDeps, store, category } = await setup();
    const create = createCreateProductAction(makeDeps(owner));

    const result = await create({
      name: "  Coca-Cola 2L  ",
      barcode: " 7771234567890 ",
      categoryId: category.id,
      priceCents: 1250,
      costCents: 800,
      stockQty: 24,
      minStock: 6,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Coca-Cola 2L");
      expect(result.data.barcode).toBe("7771234567890");
      expect(result.data.price_cents).toBe(1250);
      expect(result.data.stock_qty).toBe(24);
      expect(result.data.category_id).toBe(category.id);
    }

    expect(Array.from(store.auditLog.values()).some((log) => log.action === "products.create")).toBe(
      true,
    );
  });

  it("usa el umbral de stock bajo por defecto de la configuración (E10-02)", async () => {
    const { makeDeps, store } = await setup();
    store.businessSettings.low_stock_default = 2;

    const result = await createCreateProductAction(makeDeps(owner))({
      name: "Yerba Mate 1kg",
      priceCents: 4500,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.min_stock).toBe(2);
  });

  it("rechaza códigos de barras duplicados con un mensaje claro", async () => {    const { makeDeps } = await setup();
    await createCreateProductAction(makeDeps(owner))({
      name: "Producto A",
      barcode: "12345",
      priceCents: 500,
    });

    const result = await createCreateProductAction(makeDeps(owner))({
      name: "Producto B",
      barcode: "12345",
      priceCents: 600,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CONFLICT");
      expect(result.message).toContain("código de barras ya está registrado");
    }
  });

  it("valida precio, campos estrictos y stock negativo", async () => {
    const { makeDeps } = await setup();

    const negative = await createCreateProductAction(makeDeps(owner))({
      name: "Inválido",
      priceCents: -1,
    });
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.code).toBe("VALIDATION_ERROR");

    const extra = await createCreateProductAction(makeDeps(owner))({
      name: "Inválido",
      priceCents: 100,
      role: "owner",
    } as never);
    expect(extra.ok).toBe(false);
    if (!extra.ok) expect(extra.code).toBe("VALIDATION_ERROR");
  });

  it("lista con búsqueda sin acentos, filtros de estado y paginación", async () => {
    const { makeDeps } = await setup();
    const create = createCreateProductAction(makeDeps(owner));

    await create({ name: "Café molido", priceCents: 900, stockQty: 10, minStock: 5 });
    await create({ name: "Cafetera", priceCents: 5000, stockQty: 2, minStock: 5 });
    await create({ name: "Yerba", priceCents: 400, stockQty: 0, minStock: 3, active: false });

    const list = createListProductsAction(makeDeps(owner));

    const search = await list({ search: "cafe" });
    expect(search.ok).toBe(true);
    if (search.ok) {
      expect(search.data.items.map((product) => product.name)).toEqual([
        "Café molido",
        "Cafetera",
      ]);
    }

    const low = await list({ status: "low" });
    expect(low.ok).toBe(true);
    if (low.ok) {
      expect(low.data.items.map((product) => product.name)).toEqual(["Cafetera", "Yerba"]);
    }

    const inactive = await list({ status: "inactive" });
    expect(inactive.ok).toBe(true);
    if (inactive.ok) expect(inactive.data.items).toHaveLength(1);

    const paged = await list({ page: 2, pageSize: 2 });
    expect(paged.ok).toBe(true);
    if (paged.ok) {
      expect(paged.data.total).toBe(3);
      expect(paged.data.totalPages).toBe(2);
      expect(paged.data.page).toBe(2);
      expect(paged.data.items).toHaveLength(1);
    }
  });

  it("edita un producto sin modificar el stock y permite activar o desactivar", async () => {
    const { makeDeps, store } = await setup();
    const created = await createCreateProductAction(makeDeps(owner))({
      name: "Arroz 1kg",
      priceCents: 1500,
      stockQty: 10,
    });
    if (!created.ok) throw new Error("No se pudo crear el producto de prueba");

    const updated = await createUpdateProductAction(makeDeps(owner))({
      id: created.data.id,
      name: "Arroz grano largo 1kg",
      priceCents: 1800,
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.price_cents).toBe(1800);
      expect(updated.data.stock_qty).toBe(10);
    }

    const deactivated = await createSetProductActiveAction(makeDeps(owner))({
      id: created.data.id,
      active: false,
    });
    expect(deactivated.ok).toBe(true);
    if (deactivated.ok) expect(deactivated.data.active).toBe(false);

    expect(store.products.get(created.data.id)?.stock_qty).toBe(10);
    expect(Array.from(store.auditLog.values()).some((log) => log.action === "products.update")).toBe(
      true,
    );
  });

  it("deniega listar o mutar productos a un cajero y a una sesión anónima", async () => {
    const { makeDeps } = await setup();

    const cashierList = await createListProductsAction(makeDeps(cashier))({});
    expect(cashierList.ok).toBe(false);
    if (!cashierList.ok) expect(cashierList.code).toBe("FORBIDDEN");

    const cashierCreate = await createCreateProductAction(makeDeps(cashier))({
      name: "Intento",
      priceCents: 100,
    });
    expect(cashierCreate.ok).toBe(false);
    if (!cashierCreate.ok) expect(cashierCreate.code).toBe("FORBIDDEN");

    const anon = await createListProductsAction(makeDeps(null))({});
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");
  });
});
