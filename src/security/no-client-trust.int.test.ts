import { beforeEach, describe, expect, it } from "vitest";
import { confirmSaleSchema } from "@/lib/actions/sales-schema";
import { createConfirmSaleAction } from "@/lib/actions/sales-core";
import type { AuthenticatedUser } from "@/lib/actions/secure-action";
import { createMemoryRepositories, MemoryStore, type UserContext } from "@/lib/repos";
import type { Product } from "@/lib/repos/types";

const cashier: AuthenticatedUser = {
  id: "cashier-1",
  name: "Carlos Mamani",
  role: "cashier",
  isActive: true,
};

const cashierContext: UserContext = { id: "cashier-1", role: "cashier", active: true };

describe("El cliente no es de fiar (no-client-trust)", () => {
  const baseInput = {
    sessionId: "s-1",
    paymentMethod: "cash" as const,
    clientRequestId: "req-1",
    items: [{ productId: "p-1", quantity: 2 }],
  };

  it("el esquema del cobro rechaza precios, totales, rol e ids enviados por el cliente", () => {
    expect(confirmSaleSchema.safeParse({ ...baseInput, priceCents: 1 }).success).toBe(false);
    expect(confirmSaleSchema.safeParse({ ...baseInput, totalCents: 1 }).success).toBe(false);
    expect(confirmSaleSchema.safeParse({ ...baseInput, subtotalCents: 1 }).success).toBe(false);
    expect(confirmSaleSchema.safeParse({ ...baseInput, role: "owner" }).success).toBe(false);
    expect(confirmSaleSchema.safeParse({ ...baseInput, userId: "otro" }).success).toBe(false);
    expect(confirmSaleSchema.safeParse({ ...baseInput, cashier_id: "otro" }).success).toBe(false);
    expect(confirmSaleSchema.safeParse({ ...baseInput, status: "paid" }).success).toBe(false);
  });

  it("el esquema rechaza precio o estado dentro de cada línea de producto", () => {
    expect(
      confirmSaleSchema.safeParse({
        ...baseInput,
        items: [{ productId: "p-1", quantity: 2, priceCents: 1 }],
      }).success,
    ).toBe(false);

    expect(
      confirmSaleSchema.safeParse({
        ...baseInput,
        items: [{ productId: "p-1", quantity: 2, unitPriceCents: 1 }],
      }).success,
    ).toBe(false);
  });

  describe("cobro con datos calculados solo en el servidor", () => {
    let store: MemoryStore;
    let product: Product;
    let sessionId: string;

    beforeEach(async () => {
      store = new MemoryStore();
      const ownerRepos = createMemoryRepositories(store, {
        id: "owner-1",
        role: "owner",
        active: true,
      });
      product = await ownerRepos.products.create({
        name: "Arroz 1kg",
        barcode: "777001",
        price_cents: 1500,
        stock_qty: 10,
      });
      const session = await createMemoryRepositories(store, cashierContext).cash.openSession(10000);

      sessionId = session.id;
    });

    function makeAction(user: AuthenticatedUser = cashier) {
      return createConfirmSaleAction({
        currentUserResolver: async () => user,
        salesRepoFactory: async (ctx) => createMemoryRepositories(store, ctx).sales,
        productsRepoFactory: async (ctx) => createMemoryRepositories(store, ctx).products,
        settingsRepoFactory: async (ctx) => createMemoryRepositories(store, ctx).settings,
      });
    }

    it("total, precios y descuento de stock salen del catálogo del servidor, no del cliente", async () => {
      const result = await makeAction()({
        sessionId,
        paymentMethod: "cash",
        clientRequestId: "req-server-trust",
        items: [{ productId: product.id, quantity: 2 }],
        cashReceivedCents: 9999,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.sale.subtotal_cents).toBe(3000);
      expect(result.data.sale.discount_cents).toBe(0);
      expect(result.data.sale.total_cents).toBe(3000);
      expect(result.data.sale.cashier_id).toBe("cashier-1");
      expect(result.data.sale.status).toBe("paid");

      const updated = await createMemoryRepositories(store, cashierContext).products.getById(
        product.id,
      );
      expect(updated?.stock_qty).toBe(8);
    });

    it("el rol sale de la sesión: un cajero no puede declararse dueño en la petición", async () => {
      const result = await makeAction()({
        sessionId,
        paymentMethod: "cash",
        clientRequestId: "req-rol-falso",
        items: [{ productId: product.id, quantity: 1 }],
        cashReceivedCents: 2000,
        role: "owner",
      } as never);

      expect(result.ok).toBe(false);
    });
  });
});
