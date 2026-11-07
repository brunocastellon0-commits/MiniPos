import type {
  OrdersRepo,
  OrdersListFilter,
  Order,
  OrderItem,
  UserContext,
} from "../types";
import type { MemoryStore } from "./memory-store";
import { MemorySalesRepo } from "./sales";

export class MemoryOrdersRepo implements OrdersRepo {
  constructor(
    private store: MemoryStore,
    private user: UserContext,
  ) {}

  async createOrder(input: {
    sessionId: string;
    items: { productId: string; quantity: number }[];
    discountCents?: number;
    notes?: string | null;
  }): Promise<{ order: Order; items: OrderItem[] }> {
    if (!this.user.active) {
      throw new Error("Operación rechazada: se requiere personal activo.");
    }

    if (!input.items || input.items.length === 0) {
      throw new Error("El pedido debe contener al menos un producto.");
    }

    const session = this.store.cashSessions.get(input.sessionId);
    if (!session || session.status !== "open") {
      throw new Error("No hay un turno de caja abierto para registrar el pedido.");
    }

    const discount = input.discountCents ?? 0;
    if (discount < 0) {
      throw new Error("El descuento no puede ser negativo.");
    }

    let subtotalCents = 0;
    const itemsToCreate: Array<{
      productId: string;
      nameSnapshot: string;
      unitPriceCents: number;
      quantity: number;
      lineTotalCents: number;
    }> = [];

    for (const line of input.items) {
      if (!line.productId || line.quantity <= 0) {
        throw new Error("Línea con producto o cantidad inválida.");
      }
      const prod = this.store.products.get(line.productId);
      if (!prod || !prod.active) {
        throw new Error("Producto no encontrado o inactivo.");
      }

      const lineTotalCents = prod.price_cents * line.quantity;
      subtotalCents += lineTotalCents;
      itemsToCreate.push({
        productId: prod.id,
        nameSnapshot: prod.name,
        unitPriceCents: prod.price_cents,
        quantity: line.quantity,
        lineTotalCents,
      });
    }

    if (discount > subtotalCents) {
      throw new Error("El descuento no puede superar el subtotal.");
    }

    if (discount > 0 && this.user.role !== "owner") {
      const bs = this.store.businessSettings;
      if (!bs.cashier_can_discount) {
        throw new Error("Los cajeros no tienen autorización para aplicar descuentos.");
      }
      if (bs.cashier_max_discount_cents > 0 && discount > bs.cashier_max_discount_cents) {
        throw new Error("El descuento solicitado supera el límite autorizado para cajeros.");
      }
    }

    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();

    const order: Order = {
      id: orderId,
      order_number: this.store.nextOrderNumber(),
      session_id: input.sessionId,
      created_by: this.user.id,
      status: "pendiente",
      payment_status: "pendiente",
      sale_id: null,
      subtotal_cents: subtotalCents,
      discount_cents: discount,
      total_cents: subtotalCents - discount,
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
      preparing_at: null,
      ready_at: null,
      delivered_at: null,
      cancelled_at: null,
    };

    this.store.orders.set(orderId, order);

    const createdItems: OrderItem[] = [];
    for (const item of itemsToCreate) {
      const orderItem: OrderItem = {
        id: crypto.randomUUID(),
        order_id: orderId,
        product_id: item.productId,
        name_snapshot: item.nameSnapshot,
        unit_price_cents: item.unitPriceCents,
        quantity: item.quantity,
        line_total_cents: item.lineTotalCents,
      };
      this.store.orderItems.set(orderItem.id, orderItem);
      createdItems.push(orderItem);
    }

    this.store.auditLog.set(crypto.randomUUID(), {
      id: crypto.randomUUID(),
      at: now,
      user_id: this.user.id,
      action: "order_created",
      entity: "order",
      entity_id: orderId,
      summary: {
        order_id: orderId,
        subtotal_cents: subtotalCents,
        discount_cents: discount,
        total_cents: subtotalCents - discount,
        items_count: createdItems.length,
      },
      reason: null,
    });

    return { order: { ...order }, items: createdItems.map((i) => ({ ...i })) };
  }

  async getById(id: string): Promise<{ order: Order; items: OrderItem[] } | null> {
    const order = this.store.orders.get(id);
    if (!order) return null;

    const items: OrderItem[] = [];
    for (const item of this.store.orderItems.values()) {
      if (item.order_id === id) {
        items.push({ ...item });
      }
    }

    return { order: { ...order }, items };
  }

  async list(filter?: OrdersListFilter): Promise<Order[]> {
    let result = Array.from(this.store.orders.values());

    if (filter?.sessionId) {
      result = result.filter((o) => o.session_id === filter.sessionId);
    }
    if (filter?.status) {
      result = result.filter((o) => o.status === filter.status);
    }
    if (filter?.paymentStatus) {
      result = result.filter((o) => o.payment_status === filter.paymentStatus);
    }

    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (filter?.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return result.map((o) => ({ ...o }));
  }

  async listItemsForOrders(orderIds: readonly string[]): Promise<OrderItem[]> {
    if (orderIds.length === 0) return [];
    const idSet = new Set(orderIds);
    const items: OrderItem[] = [];
    for (const item of this.store.orderItems.values()) {
      if (idSet.has(item.order_id)) {
        items.push({ ...item });
      }
    }
    return items;
  }

  async updateStatus(id: string, status: Order["status"]): Promise<Order> {
    const order = this.store.orders.get(id);
    if (!order) {
      throw new Error("Pedido no encontrado.");
    }

    const now = new Date().toISOString();
    order.status = status;
    order.updated_at = now;

    if (status === "en_preparacion" && !order.preparing_at) {
      order.preparing_at = now;
    } else if (status === "listo" && !order.ready_at) {
      order.ready_at = now;
    } else if (status === "entregado" && !order.delivered_at) {
      order.delivered_at = now;
    } else if (status === "cancelado" && !order.cancelled_at) {
      order.cancelled_at = now;
    }

    return { ...order };
  }

  async chargeOrder(input: {
    orderId: string;
    paymentMethod: "cash" | "qr" | "card";
    clientRequestId: string;
    cashReceivedCents?: number | null;
  }): Promise<{ saleId: string; order: Order }> {
    const order = this.store.orders.get(input.orderId);
    if (!order) {
      throw new Error("Pedido no encontrado.");
    }

    if (order.payment_status === "pagado" && order.sale_id) {
      return { saleId: order.sale_id, order: { ...order } };
    }

    if (order.status === "cancelado") {
      throw new Error("No se puede cobrar un pedido cancelado.");
    }

    const items: OrderItem[] = [];
    for (const item of this.store.orderItems.values()) {
      if (item.order_id === input.orderId) {
        items.push(item);
      }
    }

    if (items.length === 0) {
      throw new Error("El pedido no contiene ítems para cobrar.");
    }

    const salesRepo = new MemorySalesRepo(this.store, this.user);
    const { sale } = await salesRepo.createSale(
      {
        session_id: order.session_id,
        subtotal_cents: order.subtotal_cents,
        discount_cents: order.discount_cents,
        total_cents: order.total_cents,
        payment_method: input.paymentMethod,
        cash_received_cents: input.cashReceivedCents ?? null,
        client_request_id: input.clientRequestId,
        status: "paid",
      },
      items.map((i) => ({
        product_id: i.product_id,
        name_snapshot: i.name_snapshot,
        unit_price_cents: i.unit_price_cents,
        quantity: i.quantity,
        line_total_cents: i.line_total_cents,
      })),
    );

    order.payment_status = "pagado";
    order.sale_id = sale.id;
    order.updated_at = new Date().toISOString();

    this.store.auditLog.set(crypto.randomUUID(), {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      user_id: this.user.id,
      action: "order_charged",
      entity: "order",
      entity_id: input.orderId,
      summary: {
        order_id: input.orderId,
        sale_id: sale.id,
        payment_method: input.paymentMethod,
        total_cents: order.total_cents,
      },
      reason: null,
    });

    return { saleId: sale.id, order: { ...order } };
  }
}
