import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepositories, MemoryStore, type UserContext } from "@/lib/repos";
import type { SalesRepo } from "@/lib/repos/types";
import {
  createDeleteHeldSaleAction,
  createListHeldSalesAction,
  createSaveHeldSaleAction,
} from "./held-sales-core";
import type { AuthenticatedUser } from "./secure-action";

const cashier: AuthenticatedUser = {
  id: "cashier-1",
  name: "Carlos Mamani",
  role: "cashier",
  isActive: true,
};

const otherCashier: AuthenticatedUser = {
  id: "cashier-2",
  name: "María Choque",
  role: "cashier",
  isActive: true,
};

const owner: AuthenticatedUser = {
  id: "owner-1",
  name: "Doña Elena",
  role: "owner",
  isActive: true,
};

const sampleLine = {
  productId: "p-1",
  name: "Arroz 1kg",
  unitPriceCents: 1200,
  quantity: 2,
};

describe("Acciones de ventas pausadas (E4-05)", () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  function depsFor(user: AuthenticatedUser | null) {
    return {
      currentUserResolver: async () => user,
      salesRepoFactory: async (ctx: UserContext): Promise<SalesRepo> =>
        createMemoryRepositories(store, ctx).sales,
    };
  }

  it("guarda una venta pausada con etiqueta y líneas", async () => {
    const save = createSaveHeldSaleAction(depsFor(cashier));

    const result = await save({
      label: "Cliente al cajero",
      cart: { lines: [sampleLine] },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.label).toBe("Cliente al cajero");
      expect(result.data.cashier_id).toBe("cashier-1");
    }

    const list = await createListHeldSalesAction(depsFor(cashier))();
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data).toHaveLength(1);
  });

  it("rechaza etiqueta vacía y carrito sin productos", async () => {
    const save = createSaveHeldSaleAction(depsFor(cashier));

    const noLabel = await save({ label: "   ", cart: { lines: [sampleLine] } });
    expect(noLabel.ok).toBe(false);
    if (!noLabel.ok) expect(noLabel.code).toBe("VALIDATION_ERROR");

    const emptyCart = await save({ label: "Ok", cart: { lines: [] } });
    expect(emptyCart.ok).toBe(false);
    if (!emptyCart.ok) expect(emptyCart.code).toBe("VALIDATION_ERROR");
  });

  it("rechaza líneas con cantidad cero o precio negativo", async () => {
    const save = createSaveHeldSaleAction(depsFor(cashier));

    const zeroQty = await save({
      label: "X",
      cart: { lines: [{ ...sampleLine, quantity: 0 }] },
    });
    expect(zeroQty.ok).toBe(false);

    const negativePrice = await save({
      label: "X",
      cart: { lines: [{ ...sampleLine, unitPriceCents: -100 }] },
    });
    expect(negativePrice.ok).toBe(false);
  });

  it("el cajero solo ve y borra sus propias ventas pausadas", async () => {
    const saveOther = createSaveHeldSaleAction(depsFor(otherCashier));
    await saveOther({ label: "De María", cart: { lines: [sampleLine] } });

    const saveMine = createSaveHeldSaleAction(depsFor(cashier));
    await saveMine({ label: "De Carlos", cart: { lines: [sampleLine] } });

    const listMine = await createListHeldSalesAction(depsFor(cashier))();
    expect(listMine.ok).toBe(true);
    if (listMine.ok) {
      expect(listMine.data).toHaveLength(1);
      expect(listMine.data[0]?.label).toBe("De Carlos");
    }

    const listOther = await createListHeldSalesAction(depsFor(otherCashier))();
    expect(listOther.ok).toBe(true);
    if (listOther.ok) {
      expect(listOther.data).toHaveLength(1);
      expect(listOther.data[0]?.label).toBe("De María");
    }

    const listOwner = await createListHeldSalesAction(depsFor(owner))();
    expect(listOwner.ok).toBe(true);
    if (listOwner.ok) expect(listOwner.data).toHaveLength(2);
  });

  it("descarta una venta pausada propia y rechaza la de otro cajero", async () => {
    const saveOther = createSaveHeldSaleAction(depsFor(otherCashier));
    const otherResult = await saveOther({ label: "De María", cart: { lines: [sampleLine] } });
    expect(otherResult.ok).toBe(true);

    const deleteAction = createDeleteHeldSaleAction(depsFor(cashier));
    if (otherResult.ok) {
      const denied = await deleteAction({ id: otherResult.data.id });
      expect(denied.ok).toBe(false);
    }

    const saveMine = createSaveHeldSaleAction(depsFor(cashier));
    const mineResult = await saveMine({ label: "De Carlos", cart: { lines: [sampleLine] } });
    expect(mineResult.ok).toBe(true);
    if (mineResult.ok) {
      const deleted = await deleteAction({ id: mineResult.data.id });
      expect(deleted.ok).toBe(true);
    }

    const list = await createListHeldSalesAction(depsFor(cashier))();
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data).toHaveLength(0);
  });

  it("exige usuario autenticado", async () => {
    const list = await createListHeldSalesAction(depsFor(null))();
    expect(list.ok).toBe(false);
    if (!list.ok) expect(list.code).toBe("UNAUTHENTICATED");
  });
});
