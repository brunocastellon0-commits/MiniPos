import { describe, expect, it } from "vitest";
import { MemoryAuditRepo } from "@/lib/repos/memory/audit";
import { MemoryCategoriesRepo } from "@/lib/repos/memory/categories";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import { MemoryProductsRepo } from "@/lib/repos/memory/products";
import { MemorySettingsRepo } from "@/lib/repos/memory/settings";
import type {
  AuditRepo,
  CategoriesRepo,
  ProductsRepo,
  SettingsRepo,
  UserContext,
} from "@/lib/repos/types";
import {
  createImportProductsCsvAction,
  createPreviewProductsCsvAction,
  type ProductsCsvActionDeps,
} from "./products-csv-core";
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

const header = "nombre,codigo_barras,codigo_interno,categoria,unidad,precio,costo,stock,stock_minimo";

async function setup() {
  const store = new MemoryStore();
  const ownerContext: UserContext = { id: owner.id, role: "owner", active: true };
  const category = await new MemoryCategoriesRepo(store, ownerContext).create({
    name: "Bebidas",
    sort_order: 0,
  });

  const makeDeps = (user: AuthenticatedUser | null): ProductsCsvActionDeps => ({
    currentUserResolver: async () => user,
    productsRepoFactory: async (ctx: UserContext): Promise<ProductsRepo> =>
      new MemoryProductsRepo(store, ctx),
    categoriesRepoFactory: async (ctx: UserContext): Promise<CategoriesRepo> =>
      new MemoryCategoriesRepo(store, ctx),
    auditRepoFactory: async (ctx: UserContext): Promise<AuditRepo> =>
      new MemoryAuditRepo(store, ctx),
    settingsRepoFactory: async (ctx: UserContext): Promise<SettingsRepo> =>
      new MemorySettingsRepo(store, ctx),
  });

  return { store, category, makeDeps };
}

describe("Importación CSV - Server Actions (E2-03)", () => {
  it("previsualiza filas válidas y errores por fila", async () => {
    const { makeDeps } = await setup();
    const csv = [
      header,
      "Coca-Cola,,,Bebidas,unidad,12.50,8.00,24,6",
      "Sin precio,,,Bebidas,unidad,,,1,1",
    ].join("\n");

    const result = await createPreviewProductsCsvAction(makeDeps(owner))({ csv });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalRows).toBe(2);
      expect(result.data.validRows).toBe(1);
      expect(result.data.errors[0]?.line).toBe(3);
      expect(result.data.preview[0]?.categoryName).toBe("Bebidas");
    }
  });

  it("importa todas las filas de forma atómica y registra auditoría", async () => {
    const { makeDeps, store, category } = await setup();
    const csv = [
      header,
      "Coca-Cola,777,,Bebidas,unidad,12.50,8.00,24,6",
      "Fanta,778,,Bebidas,unidad,10.00,,12,4",
    ].join("\n");

    const result = await createImportProductsCsvAction(makeDeps(owner))({ csv });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.imported).toBe(2);

    const products = Array.from(store.products.values());
    expect(products).toHaveLength(2);
    expect(products.map((product) => product.category_id)).toEqual([category.id, category.id]);
    expect(
      Array.from(store.auditLog.values()).some((log) => log.action === "products.import_csv"),
    ).toBe(true);
  });

  it("usa low_stock_default cuando la fila no trae stock_minimo (E10-02)", async () => {
    const { makeDeps, store } = await setup();
    store.businessSettings.low_stock_default = 3;
    const csv = [header, "Arroz 1kg,779,,Bebidas,unidad,8.00,,5,"].join("\n");

    const result = await createImportProductsCsvAction(makeDeps(owner))({ csv });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.imported).toBe(1);
    expect(Array.from(store.products.values())[0]?.min_stock).toBe(3);
  });

  it("no importa ninguna fila si el archivo tiene errores", async () => {    const { makeDeps, store } = await setup();
    const csv = [
      header,
      "Válido,,,Bebidas,unidad,5.00,,1,1",
      "Inválido,,,NoExiste,unidad,5.00,,1,1",
    ].join("\n");

    const result = await createImportProductsCsvAction(makeDeps(owner))({ csv });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.imported).toBe(0);
      expect(result.data.errors).toHaveLength(1);
    }
    expect(store.products.size).toBe(0);
  });

  it("no importa duplicados de barcode ya existentes", async () => {
    const { makeDeps, store } = await setup();
    await new MemoryProductsRepo(store, { id: owner.id, role: "owner", active: true }).create({
      name: "Existente",
      barcode: "777",
      price_cents: 100,
    });

    const csv = [header, "Nuevo,777,,Bebidas,unidad,5.00,,1,1"].join("\n");
    const result = await createImportProductsCsvAction(makeDeps(owner))({ csv });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.imported).toBe(0);
    expect(store.products.size).toBe(1);
  });

  it("valida tamaño máximo y deniega a cajeros", async () => {
    const { makeDeps } = await setup();

    const huge = await createPreviewProductsCsvAction(makeDeps(owner))({
      csv: "a".repeat(1_000_001),
    });
    expect(huge.ok).toBe(false);
    if (!huge.ok) expect(huge.code).toBe("VALIDATION_ERROR");

    const forbidden = await createPreviewProductsCsvAction(makeDeps(cashier))({ csv: header });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.code).toBe("FORBIDDEN");

    const anon = await createImportProductsCsvAction(makeDeps(null))({ csv: header });
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");
  });
});
