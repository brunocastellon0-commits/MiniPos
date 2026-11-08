import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepositories, MemoryStore, type UserContext } from "@/lib/repos";
import type { Product } from "@/lib/repos/types";
import { buildProfile } from "@/test/factories";
import {
  createChargeOrderAction,
  createCreateOrderAction,
  createGetOrderAction,
  createListOrdersAction,
  createUpdateOrderStatusAction,
} from "./orders-core";
import type { AuthenticatedUser } from "./secure-action";

const owner: AuthenticatedUser = {
  id: "owner-1",
  name: "Ana Quispe",
  role: "owner",
  isActive: true,
};

const cashier: AuthenticatedUser = {
  id: "cashier-1",
  name: "Carlos Mamani",
  role: "cashier",
  isActive: true,
};

const ownerContext: UserContext = { id: "owner-1", role: "owner", active: true };
const cashierContext: UserContext = { id: "cashier-1", role: "cashier", active: true };

describe("orders actions", () => {
  let store: MemoryStore;
  let product: Product;

  beforeEach(async () => {
    store = new MemoryStore();
    store.businessSettings.operating_mode = "restaurant";
    store.businessSettings.order_charge_timing = "on_consumption";

    const ownerRepos = createMemoryRepositories(store, ownerContext);
    product = await ownerRepos.products.create({
      name: "Arroz 1kg",
      price_cents: 1500,
      stock_qty: 10,
    });

    store.profiles.set(owner.id, buildProfile({ id: owner.id, full_name: owner.name }));
    store.profiles.set(cashier.id, buildProfile({ id: cashier.id, full_name: cashier.name }));

    const cashierRepos = createMemoryRepositories(store, cashierContext);
    await cashierRepos.cash.openSession(10_000);
  });

  function makeDeps(user: AuthenticatedUser = cashier) {
    return {
      currentUserResolver: async () => user,
      ordersRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).orders,
      cashRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).cash,
      productsRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).products,
      settingsRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).settings,
      usersRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).users,
      auditRepoFactory: async (ctx: UserContext) =>
        createMemoryRepositories(store, ctx).audit,
    };
  }

  async function createPendingOrder(quantity = 2) {
    const action = createCreateOrderAction(makeDeps());
    const result = await action({
      items: [{ productId: product.id, quantity }],
      notes: "Sin cebolla",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("No se pudo crear el pedido de prueba.");
    return result.data;
  }

  describe("createOrderAction", () => {
    it("crea el pedido sin cobrar ni descontar stock en on_consumption", async () => {
      const result = await createCreateOrderAction(makeDeps())({
        items: [{ productId: product.id, quantity: 2 }],
        notes: "Para llevar",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.saleId).toBeNull();
      expect(result.data.order.status).toBe("pendiente");
      expect(result.data.order.payment_status).toBe("pendiente");
      expect(result.data.order.subtotal_cents).toBe(3000);
      expect(result.data.order.total_cents).toBe(3000);
      expect(result.data.order.notes).toBe("Para llevar");
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0]?.name_snapshot).toBe("Arroz 1kg");
      expect(result.data.items[0]?.unit_price_cents).toBe(1500);

      const updated = await createMemoryRepositories(store, cashierContext).products.getById(
        product.id,
      );
      expect(updated?.stock_qty).toBe(10);

      const created = [...store.auditLog.values()].find(
        (log) => log.action === "order_created",
      );
      expect(created).toBeDefined();
    });

    it("en on_order cobra al crear: venta, stock y caja en el mismo paso", async () => {
      store.businessSettings.order_charge_timing = "on_order";

      const result = await createCreateOrderAction(makeDeps())({
        items: [{ productId: product.id, quantity: 2 }],
        paymentMethod: "cash",
        cashReceivedCents: 5000,
        clientRequestId: "req-create-1",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.saleId).not.toBeNull();
      expect(result.data.order.payment_status).toBe("pagado");
      expect(result.data.order.sale_id).toBe(result.data.saleId);

      const updated = await createMemoryRepositories(store, cashierContext).products.getById(
        product.id,
      );
      expect(updated?.stock_qty).toBe(8);

      const sales = await createMemoryRepositories(store, ownerContext).sales.list({
        sessionId: result.data.order.session_id,
      });
      expect(sales).toHaveLength(1);
      expect(sales[0]?.payment_method).toBe("cash");
      expect(sales[0]?.total_cents).toBe(3000);
    });

    it("en on_order exige método de pago y efectivo suficiente", async () => {
      store.businessSettings.order_charge_timing = "on_order";
      const action = createCreateOrderAction(makeDeps());

      const sinPago = await action({ items: [{ productId: product.id, quantity: 1 }] });
      expect(sinPago.ok).toBe(false);
      if (sinPago.ok) return;
      expect(sinPago.code).toBe("BAD_REQUEST");

      const efectivoCorto = await action({
        items: [{ productId: product.id, quantity: 2 }],
        paymentMethod: "cash",
        cashReceivedCents: 100,
      });
      expect(efectivoCorto.ok).toBe(false);
      if (efectivoCorto.ok) return;
      expect(efectivoCorto.code).toBe("BAD_REQUEST");
    });

    it("rechaza la creación si la modalidad no es restaurante", async () => {
      store.businessSettings.operating_mode = "micromarket";

      const result = await createCreateOrderAction(makeDeps())({
        items: [{ productId: product.id, quantity: 1 }],
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("BAD_REQUEST");
    });

    it("rechaza la creación sin turno de caja abierto", async () => {
      store.cashSessions.clear();

      const result = await createCreateOrderAction(makeDeps())({
        items: [{ productId: product.id, quantity: 1 }],
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("BAD_REQUEST");
    });

    it("rechaza productos desconocidos, inactivos y cantidades inválidas", async () => {
      const action = createCreateOrderAction(makeDeps());

      const desconocido = await action({ items: [{ productId: "no-existe", quantity: 1 }] });
      expect(desconocido.ok).toBe(false);
      if (!desconocido.ok) expect(desconocido.code).toBe("NOT_FOUND");

      const ownerRepos = createMemoryRepositories(store, ownerContext);
      await ownerRepos.products.update(product.id, { active: false });
      const inactivo = await createCreateOrderAction(makeDeps(owner))({
        items: [{ productId: product.id, quantity: 1 }],
      });
      expect(inactivo.ok).toBe(false);
      if (!inactivo.ok) expect(inactivo.code).toBe("BAD_REQUEST");
      await ownerRepos.products.update(product.id, { active: true });

      const sinItems = await action({ items: [] });
      expect(sinItems.ok).toBe(false);
      if (!sinItems.ok) expect(sinItems.code).toBe("VALIDATION_ERROR");

      const claveDesconocida = await action({
        items: [{ productId: product.id, quantity: 1 }],
        extra: true,
      } as never);
      expect(claveDesconocida.ok).toBe(false);
      if (!claveDesconocida.ok) expect(claveDesconocida.code).toBe("VALIDATION_ERROR");
    });

    it("fusiona líneas repetidas del mismo producto", async () => {
      const result = await createCreateOrderAction(makeDeps())({
        items: [
          { productId: product.id, quantity: 1 },
          { productId: product.id, quantity: 2 },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0]?.quantity).toBe(3);
      expect(result.data.order.total_cents).toBe(4500);
    });

    it("rechaza a usuarios anónimos", async () => {
      const action = createCreateOrderAction({
        ...makeDeps(),
        currentUserResolver: async () => null,
      });
      const result = await action({ items: [{ productId: product.id, quantity: 1 }] });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("UNAUTHENTICATED");
    });
  });

  describe("listOrdersAction", () => {
    it("lista los pedidos del turno con sus ítems y nombres", async () => {
      await createPendingOrder(2);

      const result = await createListOrdersAction(makeDeps(owner))({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.orders).toHaveLength(1);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.cashierNames["cashier-1"]).toBe("Carlos Mamani");
      expect(result.data.cashierNames["owner-1"]).toBe("Ana Quispe");
    });

    it("el cajero solo ve el nombre propio en la lista", async () => {
      await createPendingOrder(1);

      const result = await createListOrdersAction(makeDeps(cashier))({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.cashierNames).toEqual({ "cashier-1": "Carlos Mamani" });
    });

    it("devuelve lista vacía sin turno abierto", async () => {
      store.cashSessions.clear();

      const result = await createListOrdersAction(makeDeps())({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.orders).toHaveLength(0);
      expect(result.data.items).toHaveLength(0);
    });

    it("rechaza estados inválidos", async () => {
      const result = await createListOrdersAction(makeDeps())({ status: "cobrado" as never });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("getOrderAction", () => {
    it("devuelve el pedido con ítems y nombre del responsable", async () => {
      const created = await createPendingOrder(2);

      const comoCajero = await createGetOrderAction(makeDeps(cashier))({
        orderId: created.order.id,
      });
      expect(comoCajero.ok).toBe(true);
      if (!comoCajero.ok) return;
      expect(comoCajero.data.order.id).toBe(created.order.id);
      expect(comoCajero.data.items).toHaveLength(1);
      expect(comoCajero.data.createdByName).toBe("Carlos Mamani");

      const comoDueno = await createGetOrderAction(makeDeps(owner))({
        orderId: created.order.id,
      });
      expect(comoDueno.ok).toBe(true);
      if (!comoDueno.ok) return;
      expect(comoDueno.data.createdByName).toBe("Carlos Mamani");
    });

    it("devuelve NOT_FOUND para un pedido inexistente", async () => {
      const result = await createGetOrderAction(makeDeps())({ orderId: "no-existe" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("NOT_FOUND");
    });
  });

  describe("updateOrderStatusAction", () => {
    it("avanza pendiente → en_preparación y audita el cambio", async () => {
      const created = await createPendingOrder(1);

      const result = await createUpdateOrderStatusAction(makeDeps())({
        orderId: created.order.id,
        status: "en_preparacion",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.status).toBe("en_preparacion");

      const entry = [...store.auditLog.values()].find(
        (log) => log.action === "order.status_changed",
      );
      expect(entry).toBeDefined();
      const summary = JSON.parse(entry!.summary as string) as {
        from: string;
        to: string;
      };
      expect(summary).toEqual({ from: "pendiente", to: "en_preparacion" });
    });

    it("no permite saltar estados ni retroceder", async () => {
      const created = await createPendingOrder(1);
      const action = createUpdateOrderStatusAction(makeDeps());

      const saltar = await action({ orderId: created.order.id, status: "listo" });
      expect(saltar.ok).toBe(false);
      if (!saltar.ok) expect(saltar.code).toBe("BAD_REQUEST");

      await action({ orderId: created.order.id, status: "en_preparacion" });
      const retroceder = await action({ orderId: created.order.id, status: "pendiente" });
      expect(retroceder.ok).toBe(false);
      if (!retroceder.ok) expect(retroceder.code).toBe("BAD_REQUEST");
    });

    it("permite cancelar antes del cobro y bloquea después", async () => {
      const created = await createPendingOrder(1);
      const action = createUpdateOrderStatusAction(makeDeps());

      const cancelar = await action({
        orderId: created.order.id,
        status: "cancelado",
        reason: "Cliente se fue",
      });
      expect(cancelar.ok).toBe(true);
      if (!cancelar.ok) return;
      expect(cancelar.data.status).toBe("cancelado");

      store.businessSettings.order_charge_timing = "on_order";
      const cobrable = await createCreateOrderAction(makeDeps())({
        items: [{ productId: product.id, quantity: 1 }],
        paymentMethod: "qr",
      });
      expect(cobrable.ok).toBe(true);
      if (!cobrable.ok) return;

      const trasCobro = await action({
        orderId: cobrable.data.order.id,
        status: "cancelado",
      });
      expect(trasCobro.ok).toBe(false);
      if (!trasCobro.ok) expect(trasCobro.code).toBe("BAD_REQUEST");
    });

    it("devuelve NOT_FOUND para un pedido inexistente", async () => {
      const result = await createUpdateOrderStatusAction(makeDeps())({
        orderId: "no-existe",
        status: "cancelado",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("NOT_FOUND");
    });
  });

  describe("chargeOrderAction", () => {
    it("cobra un pedido pendiente con efectivo: stock, caja y venta", async () => {
      const created = await createPendingOrder(2);

      const result = await createChargeOrderAction(makeDeps())({
        orderId: created.order.id,
        paymentMethod: "cash",
        cashReceivedCents: 5000,
        clientRequestId: "charge-1",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.saleId).toBeTruthy();
      expect(result.data.order.payment_status).toBe("pagado");

      const updated = await createMemoryRepositories(store, cashierContext).products.getById(
        product.id,
      );
      expect(updated?.stock_qty).toBe(8);
    });

    it("es idempotente: un segundo cobro no duplica stock ni venta", async () => {
      const created = await createPendingOrder(2);
      const action = createChargeOrderAction(makeDeps());
      const input = {
        orderId: created.order.id,
        paymentMethod: "cash" as const,
        cashReceivedCents: 5000,
        clientRequestId: "charge-1",
      };

      const primero = await action(input);
      expect(primero.ok).toBe(true);
      if (!primero.ok) return;

      const segundo = await action({ ...input, clientRequestId: "charge-2" });
      expect(segundo.ok).toBe(true);
      if (!segundo.ok) return;
      expect(segundo.data.saleId).toBe(primero.data.saleId);

      const updated = await createMemoryRepositories(store, cashierContext).products.getById(
        product.id,
      );
      expect(updated?.stock_qty).toBe(8);
    });

    it("valida el efectivo recibido contra el total del pedido", async () => {
      const created = await createPendingOrder(2);

      const result = await createChargeOrderAction(makeDeps())({
        orderId: created.order.id,
        paymentMethod: "cash",
        cashReceivedCents: 100,
        clientRequestId: "charge-short",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("BAD_REQUEST");
    });

    it("no cobra un pedido cancelado", async () => {
      const created = await createPendingOrder(1);
      await createUpdateOrderStatusAction(makeDeps())({
        orderId: created.order.id,
        status: "cancelado",
      });

      const result = await createChargeOrderAction(makeDeps())({
        orderId: created.order.id,
        paymentMethod: "qr",
        clientRequestId: "charge-cancelled",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("BAD_REQUEST");
    });

    it("devuelve NOT_FOUND para un pedido inexistente", async () => {
      const result = await createChargeOrderAction(makeDeps())({
        orderId: "no-existe",
        paymentMethod: "qr",
        clientRequestId: "charge-missing",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("NOT_FOUND");
    });
  });
});
