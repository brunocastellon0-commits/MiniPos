import { describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import { MemoryProductsRepo } from "@/lib/repos/memory/products";
import type { ProductsRepo, UserContext } from "@/lib/repos/types";
import {
  createGetProductsByIdsAction,
  createListPosProductsAction,
  createSearchPosProductsAction,
} from "./products-search-core";
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
  const repo = new MemoryProductsRepo(store, ownerContext);

  await repo.create({
    name: "Café molido",
    barcode: "777001",
    price_cents: 900,
    cost_cents: 500,
    stock_qty: 10,
  });
  await repo.create({
    name: "Cafetera eléctrica",
    barcode: "777002",
    price_cents: 5000,
    cost_cents: 3000,
    stock_qty: 2,
  });
  await repo.create({
    name: "Café inactivo",
    barcode: "777003",
    price_cents: 800,
    cost_cents: 400,
    stock_qty: 1,
    active: false,
  });

  const makeDeps = (user: AuthenticatedUser | null) => ({
    currentUserResolver: async () => user,
    productsRepoFactory: async (ctx: UserContext): Promise<ProductsRepo> =>
      new MemoryProductsRepo(store, ctx),
  });

  return { makeDeps, store };
}

describe("Búsqueda POS - Server Action (E2-04)", () => {
  it("busca por nombre sin acentos y solo devuelve productos activos", async () => {
    const { makeDeps } = await setup();
    const search = createSearchPosProductsAction(makeDeps(cashier));

    const result = await search({ query: "cafe" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((product) => product.name)).toEqual([
        "Café molido",
        "Cafetera eléctrica",
      ]);
    }
  });

  it("pone primero el producto cuando el código de barras coincide exactamente", async () => {
    const { makeDeps } = await setup();
    const search = createSearchPosProductsAction(makeDeps(cashier));

    const result = await search({ query: "777001" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]?.name).toBe("Café molido");
    }
  });

  it("el cajero recibe los productos sin costo; el dueño sí lo ve", async () => {
    const { makeDeps } = await setup();

    const cashierResult = await createSearchPosProductsAction(makeDeps(cashier))({
      query: "cafe",
    });
    expect(cashierResult.ok).toBe(true);
    if (cashierResult.ok) {
      expect(cashierResult.data.every((product) => product.cost_cents === null)).toBe(true);
    }

    const ownerResult = await createSearchPosProductsAction(makeDeps(owner))({ query: "cafe" });
    expect(ownerResult.ok).toBe(true);
    if (ownerResult.ok) {
      expect(ownerResult.data[0]?.cost_cents).toBe(500);
    }
  });

  it("lista solo productos activos para el catálogo del POS", async () => {
    const { makeDeps } = await setup();
    const list = createListPosProductsAction(makeDeps(cashier));

    const result = await list({});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((product) => product.name)).toEqual([
        "Café molido",
        "Cafetera eléctrica",
      ]);
    }
  });

  it("valida la consulta y exige sesión", async () => {
    const { makeDeps } = await setup();
    const search = createSearchPosProductsAction(makeDeps(cashier));

    const empty = await search({ query: "   " });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.code).toBe("VALIDATION_ERROR");

    const anon = await createSearchPosProductsAction(makeDeps(null))({ query: "cafe" });
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");
  });

  it("carga los productos por ids en una sola consulta (sin N+1, E11-05)", async () => {
    const { makeDeps, store } = await setup();
    const ownerContext: UserContext = { id: owner.id, role: "owner", active: true };
    const products = await new MemoryProductsRepo(store, ownerContext).list();
    const ids = products.map((product) => product.id);

    const getByIdsSpy = vi.spyOn(MemoryProductsRepo.prototype, "getByIds");
    const getByIdSpy = vi.spyOn(MemoryProductsRepo.prototype, "getById");
    try {
      const result = await createGetProductsByIdsAction(makeDeps(owner))({ ids });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const activeIds = products.filter((product) => product.active).map((product) => product.id);
        expect(result.data.map((product) => product.id).sort()).toEqual([...activeIds].sort());
        expect(result.data.every((product) => product.cost_cents !== null)).toBe(true);
      }
      expect(getByIdsSpy).toHaveBeenCalledTimes(1);
      expect(getByIdSpy).not.toHaveBeenCalled();
    } finally {
      getByIdsSpy.mockRestore();
      getByIdSpy.mockRestore();
    }
  });
});
