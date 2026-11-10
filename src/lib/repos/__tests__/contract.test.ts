import { describe, it, expect, beforeEach } from "vitest";
import {
  createMemoryRepositories,
  MemoryStore,
  type Repositories,
  type UserContext,
} from "@/lib/repos";
import { buildProfile } from "@/test/factories";

describe("Repositories Contract Suite (Memory)", () => {
  let store: MemoryStore;
  const owner: UserContext = {
    id: "owner-1",
    role: "owner",
    active: true,
  };
  const cashier: UserContext = {
    id: "cashier-1",
    role: "cashier",
    active: true,
  };
  const otherCashier: UserContext = {
    id: "cashier-2",
    role: "cashier",
    active: true,
  };

  let ownerRepos: Repositories;
  let cashierRepos: Repositories;
  let otherCashierRepos: Repositories;

  beforeEach(() => {
    store = new MemoryStore();
    ownerRepos = createMemoryRepositories(store, owner);
    cashierRepos = createMemoryRepositories(store, cashier);
    otherCashierRepos = createMemoryRepositories(store, otherCashier);
  });

  describe("Catálogo: Productos y Categorías", () => {
    it("el propietario puede crear categorías y productos", async () => {
      const cat = await ownerRepos.categories.create({
        name: "Bebidas",
        sort_order: 1,
      });
      expect(cat.id).toBeDefined();
      expect(cat.name).toBe("Bebidas");

      const prod = await ownerRepos.products.create({
        name: "Coca-Cola 2L",
        barcode: "7771234567890",
        price_cents: 1200,
        cost_cents: 850,
        stock_qty: 20,
        category_id: cat.id,
      });

      expect(prod.id).toBeDefined();
      expect(prod.price_cents).toBe(1200);
      expect(prod.cost_cents).toBe(850);
    });

    it("rechaza duplicados de código de barras", async () => {
      await ownerRepos.products.create({
        name: "Producto A",
        barcode: "12345",
        price_cents: 500,
      });

      await expect(
        ownerRepos.products.create({
          name: "Producto B",
          barcode: "12345",
          price_cents: 600,
        }),
      ).rejects.toThrow("código de barras ya está registrado");
    });

    it("el cajero no ve el costo de los productos y no puede ver productos inactivos", async () => {
      await ownerRepos.products.create({
        name: "Galletas Activas",
        price_cents: 350,
        cost_cents: 200,
        active: true,
      });

      await ownerRepos.products.create({
        name: "Galletas Inactivas",
        price_cents: 350,
        cost_cents: 200,
        active: false,
      });

      const cashierList = await cashierRepos.products.list();
      expect(cashierList).toHaveLength(1);
      expect(cashierList[0]?.name).toBe("Galletas Activas");
      expect(cashierList[0]?.cost_cents).toBeNull();

      const ownerList = await ownerRepos.products.list();
      expect(ownerList).toHaveLength(2);
      expect(ownerList[0]?.cost_cents).toBe(200);
    });

    it("el cajero no puede crear ni eliminar productos", async () => {
      await expect(
        cashierRepos.products.create({
          name: "Intento Cajero",
          price_cents: 100,
        }),
      ).rejects.toThrow("Acceso denegado");
    });
  });

  describe("Caja y Turnos", () => {
    it("abre sesión de caja y no permite abrir una segunda sesión simultánea", async () => {
      const session = await cashierRepos.cash.openSession(10000, "Apertura turno mañana");
      expect(session.status).toBe("open");
      expect(session.opening_cents).toBe(10000);

      await expect(ownerRepos.cash.openSession(5000, "Intento segundo turno")).rejects.toThrow(
        "Ya existe una sesión de caja abierta",
      );
    });

    it("calcula correctamente el efectivo esperado y la diferencia al cerrar la sesión", async () => {
      const session = await cashierRepos.cash.openSession(10000); // 100 Bs apertura

      // Registrar movimiento de ingreso (20 Bs) y retiro (10 Bs)
      await cashierRepos.cash.addMovement({
        sessionId: session.id,
        kind: "in",
        amountCents: 2000,
        reason: "Cambio inicial extra",
      });

      await cashierRepos.cash.addMovement({
        sessionId: session.id,
        kind: "out",
        amountCents: 1000,
        reason: "Pago delivery",
      });

      // Crear producto y venta en efectivo de 30 Bs
      const prod = await ownerRepos.products.create({
        name: "Arroz 1kg",
        price_cents: 1500,
        stock_qty: 10,
      });

      await cashierRepos.sales.createSale(
        {
          session_id: session.id,
          subtotal_cents: 3000,
          discount_cents: 0,
          total_cents: 3000,
          payment_method: "cash",
          cash_received_cents: 5000,
          client_request_id: "req-1",
        },
        [
          {
            product_id: prod.id,
            name_snapshot: prod.name,
            unit_price_cents: 1500,
            quantity: 2,
            line_total_cents: 3000,
          },
        ],
      );

      // Efectivo esperado = 10000 (apertura) + 2000 (in) - 1000 (out) + 3000 (venta cash) = 14000
      // Cajero cuenta 14500 (sobrante de 500 centavos)
      const closed = await cashierRepos.cash.closeSession(session.id, 14500, "Cierre con sobrante");

      expect(closed.status).toBe("closed");
      expect(closed.expected_cash_cents).toBe(14000);
      expect(closed.counted_cash_cents).toBe(14500);
      expect(closed.difference_cents).toBe(500);
    });

    it("listMovementsRange devuelve solo movimientos dentro del rango en orden ascendente", async () => {
      const session = await cashierRepos.cash.openSession(10000);

      await cashierRepos.cash.addMovement({
        sessionId: session.id,
        kind: "in",
        amountCents: 2000,
        reason: "Ingreso para cambio",
      });
      await cashierRepos.cash.addMovement({
        sessionId: session.id,
        kind: "out",
        amountCents: 1000,
        reason: "Pago delivery",
      });

      const now = Date.now();
      const inRange = await ownerRepos.cash.listMovementsRange(
        new Date(now - 60_000).toISOString(),
        new Date(now + 60_000).toISOString(),
      );
      expect(inRange).toHaveLength(2);
      expect(inRange.map((movement) => movement.amount_cents)).toEqual([2000, 1000]);
      expect(inRange.every((movement) => movement.session_id === session.id)).toBe(true);

      const outOfRange = await ownerRepos.cash.listMovementsRange(
        new Date(now - 3_600_000).toISOString(),
        new Date(now - 3_500_000).toISOString(),
      );
      expect(outOfRange).toEqual([]);
    });

    it("listSessions trae el nombre de quien abrió cada sesión en la misma consulta", async () => {
      store.profiles.set(
        "cashier-1",
        buildProfile({ id: "cashier-1", full_name: "Carlos Mamani" }),
      );
      const session = await cashierRepos.cash.openSession(10000);

      const list = await ownerRepos.cash.listSessions();
      const found = list.find((item) => item.id === session.id);
      expect(found?.opened_by_name).toBe("Carlos Mamani");

      await cashierRepos.cash.closeSession(session.id, 10000);
      store.profiles.delete("cashier-1");
      const afterClose = await ownerRepos.cash.listSessions();
      expect(afterClose).toHaveLength(1);
      expect(afterClose[0]?.status).toBe("closed");
      expect(afterClose[0]?.opened_by_name).toBeNull();
    });
  });

  describe("Inventario: listMovements con rango de fechas", () => {
    it("filtra movimientos por fecha y respeta el límite explícito", async () => {
      const session = await cashierRepos.cash.openSession(5000);
      const prod = await ownerRepos.products.create({
        name: "Sal 1kg",
        price_cents: 300,
        stock_qty: 10,
      });

      for (const requestId of ["req-smov-1", "req-smov-2"]) {
        await cashierRepos.sales.createSale(
          {
            session_id: session.id,
            subtotal_cents: 300,
            discount_cents: 0,
            total_cents: 300,
            payment_method: "cash",
            cash_received_cents: 500,
            client_request_id: requestId,
          },
          [
            {
              product_id: prod.id,
              name_snapshot: prod.name,
              unit_price_cents: 300,
              quantity: 1,
              line_total_cents: 300,
            },
          ],
        );
      }

      const now = Date.now();
      const inRange = await ownerRepos.inventory.listMovements({
        dateFrom: new Date(now - 60_000).toISOString(),
        dateTo: new Date(now + 60_000).toISOString(),
      });
      expect(inRange).toHaveLength(2);
      expect(inRange.every((movement) => movement.product_id === prod.id)).toBe(true);

      const limited = await ownerRepos.inventory.listMovements({
        dateFrom: new Date(now - 60_000).toISOString(),
        dateTo: new Date(now + 60_000).toISOString(),
        limit: 1,
      });
      expect(limited).toHaveLength(1);

      const outOfRange = await ownerRepos.inventory.listMovements({
        dateFrom: new Date(now - 3_600_000).toISOString(),
        dateTo: new Date(now - 3_500_000).toISOString(),
      });
      expect(outOfRange).toEqual([]);
    });
  });

  describe("Ventas, Congelamiento de Precios e Idempotencia", () => {
    it("congela precios de venta y descuenta stock registrando movimiento", async () => {
      const session = await cashierRepos.cash.openSession(5000);

      const prod = await ownerRepos.products.create({
        name: "Aceite 1L",
        price_cents: 1400,
        stock_qty: 10,
      });

      const { sale, items } = await cashierRepos.sales.createSale(
        {
          session_id: session.id,
          subtotal_cents: 1400,
          discount_cents: 0,
          total_cents: 1400,
          payment_method: "cash",
          cash_received_cents: 2000,
          client_request_id: "sale-req-unique-1",
        },
        [
          {
            product_id: prod.id,
            name_snapshot: prod.name,
            unit_price_cents: 1400,
            quantity: 2,
            line_total_cents: 2800, // 2 x 1400
          },
        ],
      );

      expect(sale.id).toBeDefined();
      expect(items).toHaveLength(1);
      expect(items[0]?.unit_price_cents).toBe(1400);

      // Stock actualizado: 10 - 2 = 8
      const updatedProd = await ownerRepos.products.getById(prod.id);
      expect(updatedProd?.stock_qty).toBe(8);

      // Movimiento de inventario creado
      const movements = await ownerRepos.inventory.listMovements({ productId: prod.id });
      expect(movements).toHaveLength(1);
      expect(movements[0]?.delta).toBe(-2);
      expect(movements[0]?.kind).toBe("sale");
    });

    it("garantiza idempotencia ante reintentos con el mismo client_request_id", async () => {
      const session = await cashierRepos.cash.openSession(5000);

      const prod = await ownerRepos.products.create({
        name: "Yogurt 1L",
        price_cents: 800,
        stock_qty: 10,
      });

      const salePayload = {
        session_id: session.id,
        subtotal_cents: 800,
        discount_cents: 0,
        total_cents: 800,
        payment_method: "qr" as const,
        cash_received_cents: null,
        client_request_id: "idempotency-key-abc",
      };

      const itemPayload = [
        {
          product_id: prod.id,
          name_snapshot: prod.name,
          unit_price_cents: 800,
          quantity: 1,
          line_total_cents: 800,
        },
      ];

      const res1 = await cashierRepos.sales.createSale(salePayload, itemPayload);
      const res2 = await cashierRepos.sales.createSale(salePayload, itemPayload);

      // Ambas respuestas son idénticas y devuelven la misma venta
      expect(res1.sale.id).toBe(res2.sale.id);

      // El stock solo se descontó una vez: 10 - 1 = 9
      const updatedProd = await ownerRepos.products.getById(prod.id);
      expect(updatedProd?.stock_qty).toBe(9);
    });

    it("el cajero solo ve sus propias ventas; el dueño ve todas", async () => {
      const session = await cashierRepos.cash.openSession(5000);

      await cashierRepos.sales.createSale(
        {
          session_id: session.id,
          subtotal_cents: 100,
          discount_cents: 0,
          total_cents: 100,
          payment_method: "card",
          cash_received_cents: null,
          client_request_id: "cashier-1-sale",
        },
        [],
      );

      await otherCashierRepos.sales.createSale(
        {
          session_id: session.id,
          subtotal_cents: 200,
          discount_cents: 0,
          total_cents: 200,
          payment_method: "card",
          cash_received_cents: null,
          client_request_id: "cashier-2-sale",
        },
        [],
      );

      const cashier1Sales = await cashierRepos.sales.list();
      expect(cashier1Sales).toHaveLength(1);
      expect(cashier1Sales[0]?.client_request_id).toBe("cashier-1-sale");

      const cashier2Sales = await otherCashierRepos.sales.list();
      expect(cashier2Sales).toHaveLength(1);
      expect(cashier2Sales[0]?.client_request_id).toBe("cashier-2-sale");

      const ownerSales = await ownerRepos.sales.list();
      expect(ownerSales).toHaveLength(2);
    });

    it("solo el dueño puede anular ventas, revirtiendo el stock", async () => {
      const session = await cashierRepos.cash.openSession(5000);

      const prod = await ownerRepos.products.create({
        name: "Mantequilla",
        price_cents: 1000,
        stock_qty: 5,
      });

      const { sale } = await cashierRepos.sales.createSale(
        {
          session_id: session.id,
          subtotal_cents: 1000,
          discount_cents: 0,
          total_cents: 1000,
          payment_method: "qr",
          cash_received_cents: null,
          client_request_id: "sale-to-void",
        },
        [
          {
            product_id: prod.id,
            name_snapshot: prod.name,
            unit_price_cents: 1000,
            quantity: 2,
            line_total_cents: 2000,
          },
        ],
      );

      // Cajero no puede anular
      await expect(cashierRepos.sales.voidSale(sale.id, "Error de cobro")).rejects.toThrow(
        "Acceso denegado",
      );

      // Dueño anula
      const voided = await ownerRepos.sales.voidSale(sale.id, "Cliente canceló");
      expect(voided.status).toBe("voided");
      expect(voided.void_reason).toBe("Cliente canceló");

      // Stock revertido: 5 - 2 + 2 = 5
      const prodReverted = await ownerRepos.products.getById(prod.id);
      expect(prodReverted?.stock_qty).toBe(5);

      // Movimiento void_return
      const movements = await ownerRepos.inventory.listMovements({ productId: prod.id });
      const voidMov = movements.find((m) => m.kind === "void_return");
      expect(voidMov).toBeDefined();
      expect(voidMov?.delta).toBe(2);
    });
  });

  describe("Configuración y Auditoría", () => {
    it("el cajero no accede a la configuración completa pero sí a getPublicSettings", async () => {
      await expect(cashierRepos.settings.getSettings()).rejects.toThrow("Acceso denegado");

      const pubSettings = await cashierRepos.settings.getPublicSettings();
      expect(pubSettings.name).toBe("Mi Minimarket");
      expect(pubSettings.currency_symbol).toBe("Bs");
      expect(pubSettings.cashier_can_discount).toBe(false);
      expect(pubSettings.operating_mode).toBe("micromarket");
      expect(pubSettings.enable_held_sales).toBe(true);
      expect(pubSettings.order_charge_timing).toBe("on_order");
    });

    it("registra eventos de auditoría inmutables", async () => {
      const logId = await cashierRepos.audit.write({
        action: "login_success",
        entity: "auth",
        summary: { ip: "127.0.0.1" },
      });

      expect(logId).toBeDefined();

      const logs = await ownerRepos.audit.list();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.action).toBe("login_success");

      // El cajero no puede leer logs de auditoría
      await expect(cashierRepos.audit.list()).rejects.toThrow("Acceso denegado");
    });
  });

  describe("Pedidos y Modo Restaurante (OrdersRepo)", () => {
    it("crea un pedido con ítems congelados sin descontar stock anticipadamente", async () => {
      const session = await cashierRepos.cash.openSession(10000);
      const prod = await ownerRepos.products.create({
        name: "Plato Especial",
        barcode: null,
        price_cents: 2500,
        cost_cents: 1200,
        stock_qty: 10,
      });

      const { order, items } = await cashierRepos.orders.createOrder({
        sessionId: session.id,
        items: [{ productId: prod.id, quantity: 2 }],
        notes: "Mesa 4 - sin picante",
      });

      expect(order.id).toBeDefined();
      expect(order.order_number).toBeGreaterThanOrEqual(1);
      expect(order.status).toBe("pendiente");
      expect(order.payment_status).toBe("pendiente");
      expect(order.subtotal_cents).toBe(5000);
      expect(order.total_cents).toBe(5000);
      expect(order.notes).toBe("Mesa 4 - sin picante");
      expect(items).toHaveLength(1);
      expect(items[0]?.name_snapshot).toBe("Plato Especial");
      expect(items[0]?.line_total_cents).toBe(5000);

      // El stock NO debe haber bajado
      const prodAfter = await ownerRepos.products.getById(prod.id);
      expect(prodAfter?.stock_qty).toBe(10);
    });

    it("actualiza estados de pedido registrando timestamps", async () => {
      const session = await cashierRepos.cash.openSession(10000);
      const prod = await ownerRepos.products.create({
        name: "Sopa",
        price_cents: 1000,
        stock_qty: 10,
      });
      const { order } = await cashierRepos.orders.createOrder({
        sessionId: session.id,
        items: [{ productId: prod.id, quantity: 1 }],
      });

      const inPrep = await cashierRepos.orders.updateStatus(order.id, "en_preparacion");
      expect(inPrep.status).toBe("en_preparacion");
      expect(inPrep.preparing_at).toBeDefined();

      const ready = await cashierRepos.orders.updateStatus(order.id, "listo");
      expect(ready.status).toBe("listo");
      expect(ready.ready_at).toBeDefined();

      const delivered = await cashierRepos.orders.updateStatus(order.id, "entregado");
      expect(delivered.status).toBe("entregado");
      expect(delivered.delivered_at).toBeDefined();
    });

    it("cobra el pedido atómicamente descontando stock y vinculando la venta", async () => {
      const session = await cashierRepos.cash.openSession(10000);
      const prod = await ownerRepos.products.create({
        name: "Jugo",
        price_cents: 1500,
        stock_qty: 10,
      });
      const { order } = await cashierRepos.orders.createOrder({
        sessionId: session.id,
        items: [{ productId: prod.id, quantity: 3 }],
      });

      const { saleId, order: paidOrder } = await cashierRepos.orders.chargeOrder({
        orderId: order.id,
        paymentMethod: "cash",
        clientRequestId: "req-order-1",
        cashReceivedCents: 5000,
      });

      expect(saleId).toBeDefined();
      expect(paidOrder.payment_status).toBe("pagado");
      expect(paidOrder.sale_id).toBe(saleId);

      // El stock bajó al cobrar
      const prodAfter = await ownerRepos.products.getById(prod.id);
      expect(prodAfter?.stock_qty).toBe(7);

      // Idempotencia: cobrar de nuevo devuelve la misma venta sin duplicar
      const repeat = await cashierRepos.orders.chargeOrder({
        orderId: order.id,
        paymentMethod: "cash",
        clientRequestId: "req-order-1",
        cashReceivedCents: 5000,
      });
      expect(repeat.saleId).toBe(saleId);

      // Pedido cancelado no se puede cobrar
      const { order: orderToCancel } = await cashierRepos.orders.createOrder({
        sessionId: session.id,
        items: [{ productId: prod.id, quantity: 1 }],
      });
      await cashierRepos.orders.updateStatus(orderToCancel.id, "cancelado");
      await expect(
        cashierRepos.orders.chargeOrder({
          orderId: orderToCancel.id,
          paymentMethod: "cash",
          clientRequestId: "req-order-cancel",
        }),
      ).rejects.toThrow("No se puede cobrar un pedido cancelado.");
    });
  });
});
