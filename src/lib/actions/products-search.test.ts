import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import { MemoryProductsRepo } from "@/lib/repos/memory/products";
import type { ProductsRepo, UserContext } from "@/lib/repos/types";
import { createSearchPosProductsAction } from "./products-search-core";
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

  return { makeDeps };
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
});
