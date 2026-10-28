import type {
  SalesRepo,
  Sale,
  SaleItem,
  HeldSale,
  SaleInsert,
  SaleItemInsert,
  StockMovement,
  UserContext,
} from "../types";
import type { MemoryStore } from "./memory-store";

export class MemorySalesRepo implements SalesRepo {
  constructor(
    private store: MemoryStore,
    private user: UserContext,
  ) {}

  async createSale(
    saleData: Omit<SaleInsert, "number" | "id" | "created_at" | "cashier_id">,
    itemsData: Omit<SaleItemInsert, "id" | "sale_id">[],
  ): Promise<{ sale: Sale; items: SaleItem[] }> {
    // 1. Idempotencia: si ya existe por client_request_id, devolver la original
    const existingSale = await this.getByClientRequestId(saleData.client_request_id);
    if (existingSale) {
      return existingSale;
    }

    // 2. Verificar que la sesión de caja exista y esté abierta
    const session = this.store.cashSessions.get(saleData.session_id);
    if (!session || session.status !== "open") {
      throw new Error("No se puede registrar una venta sin una sesión de caja abierta.");
    }

    // 3. Validar totales
    if (saleData.subtotal_cents < 0) {
      throw new Error("El subtotal no puede ser negativo.");
    }
    const discount = saleData.discount_cents ?? 0;
    if (discount < 0 || discount > saleData.subtotal_cents) {
      throw new Error("El descuento es inválido.");
    }
    const expectedTotal = saleData.subtotal_cents - discount;
    if (saleData.total_cents !== expectedTotal) {
      throw new Error("El total no coincide con subtotal - descuento.");
    }

    // 4. Validar método de pago en efectivo
    if (saleData.payment_method === "cash") {
      if (
        saleData.cash_received_cents === null ||
        saleData.cash_received_cents === undefined ||
        saleData.cash_received_cents < saleData.total_cents
      ) {
        throw new Error("El efectivo recibido es insuficiente.");
      }
    }

    // 5. Validar stock disponible
    const allowNegative = this.store.businessSettings.allow_negative_stock;
    for (const item of itemsData) {
      if (item.quantity <= 0) {
        throw new Error("La cantidad del producto debe ser mayor a 0.");
      }
      if (item.product_id) {
        const prod = this.store.products.get(item.product_id);
        if (prod && !allowNegative && prod.stock_qty < item.quantity) {
          throw new Error(
            `Stock insuficiente para el producto '${prod.name}'. Disponible: ${prod.stock_qty}, Solicitado: ${item.quantity}.`,
          );
        }
      }
    }

    const saleId = crypto.randomUUID();
    const now = new Date().toISOString();
    const number = this.store.nextSaleNumber();

    const sale: Sale = {
      id: saleId,
      number,
      session_id: saleData.session_id,
      cashier_id: this.user.id,
      status: "paid",
      subtotal_cents: saleData.subtotal_cents,
      discount_cents: discount,
      total_cents: saleData.total_cents,
      payment_method: saleData.payment_method,
      cash_received_cents: saleData.cash_received_cents ?? null,
      client_request_id: saleData.client_request_id,
      voided_by: null,
      voided_at: null,
      void_reason: null,
      created_at: now,
    };

    const createdItems: SaleItem[] = [];

    // 6. Descontar stock y registrar movimientos
    for (const item of itemsData) {
      const itemId = crypto.randomUUID();
      const lineTotal = item.unit_price_cents * item.quantity;

      const saleItem: SaleItem = {
        id: itemId,
        sale_id: saleId,
        product_id: item.product_id ?? null,
        name_snapshot: item.name_snapshot,
        unit_price_cents: item.unit_price_cents,
        quantity: item.quantity,
        line_total_cents: lineTotal,
      };

      createdItems.push(saleItem);
      this.store.saleItems.set(itemId, saleItem);

      if (item.product_id) {
        const prod = this.store.products.get(item.product_id);
        if (prod) {
          prod.stock_qty -= item.quantity;
          prod.updated_at = now;

          const movementId = crypto.randomUUID();
          const movement: StockMovement = {
            id: movementId,
            product_id: item.product_id,
            kind: "sale",
            delta: -item.quantity,
            reason: `Venta #${number}`,
            ref_type: "sale",
            ref_id: saleId,
            user_id: this.user.id,
            created_at: now,
          };
          this.store.stockMovements.set(movementId, movement);
        }
      }
    }

    this.store.sales.set(saleId, sale);
    return { sale, items: createdItems };
  }

  async getById(id: string): Promise<{ sale: Sale; items: SaleItem[] } | null> {
    const sale = this.store.sales.get(id);
    if (!sale) return null;

    if (this.user.role === "cashier" && sale.cashier_id !== this.user.id) {
      return null;
    }

    const items = Array.from(this.store.saleItems.values()).filter((it) => it.sale_id === id);

    return { sale, items };
  }

  async getByClientRequestId(
    clientRequestId: string,
  ): Promise<{ sale: Sale; items: SaleItem[] } | null> {
    const sale = Array.from(this.store.sales.values()).find(
      (s) => s.client_request_id === clientRequestId,
    );
    if (!sale) return null;

    if (this.user.role === "cashier" && sale.cashier_id !== this.user.id) {
      return null;
    }

    const items = Array.from(this.store.saleItems.values()).filter((it) => it.sale_id === sale.id);

    return { sale, items };
  }

  async list(filter?: { sessionId?: string; cashierId?: string; limit?: number }): Promise<Sale[]> {
    let sales = Array.from(this.store.sales.values());

    if (this.user.role === "cashier") {
      sales = sales.filter((s) => s.cashier_id === this.user.id);
    } else if (filter?.cashierId) {
      sales = sales.filter((s) => s.cashier_id === filter.cashierId);
    }

    if (filter?.sessionId) {
      sales = sales.filter((s) => s.session_id === filter.sessionId);
    }

    return sales
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, filter?.limit ?? 50);
  }

  async voidSale(id: string, reason: string): Promise<Sale> {
    if (this.user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede anular ventas.");
    }
    if (!reason || !reason.trim()) {
      throw new Error("El motivo de anulación es obligatorio.");
    }

    const sale = this.store.sales.get(id);
    if (!sale) {
      throw new Error("Venta no encontrada.");
    }

    // Idempotencia de anulación
    if (sale.status === "voided") {
      return sale;
    }

    const now = new Date().toISOString();
    const updatedSale: Sale = {
      ...sale,
      status: "voided",
      voided_by: this.user.id,
      voided_at: now,
      void_reason: reason.trim(),
    };

    // Revertir stock
    const items = Array.from(this.store.saleItems.values()).filter((it) => it.sale_id === id);

    for (const item of items) {
      if (item.product_id) {
        const prod = this.store.products.get(item.product_id);
        if (prod) {
          prod.stock_qty += item.quantity;
          prod.updated_at = now;

          const movementId = crypto.randomUUID();
          const movement: StockMovement = {
            id: movementId,
            product_id: item.product_id,
            kind: "void_return",
            delta: item.quantity,
            reason: `Anulación venta #${sale.number}: ${reason.trim()}`,
            ref_type: "sale",
            ref_id: sale.id,
            user_id: this.user.id,
            created_at: now,
          };
          this.store.stockMovements.set(movementId, movement);
        }
      }
    }

    this.store.sales.set(id, updatedSale);
    return updatedSale;
  }

  async getHeldSales(): Promise<HeldSale[]> {
    let held = Array.from(this.store.heldSales.values());
    if (this.user.role === "cashier") {
      held = held.filter((h) => h.cashier_id === this.user.id);
    }
    return held.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async saveHeldSale(label: string, items: unknown[]): Promise<HeldSale> {
    if (!label.trim()) {
      throw new Error("La etiqueta de la venta pausada es obligatoria.");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const held: HeldSale = {
      id,
      cashier_id: this.user.id,
      label: label.trim(),
      items: JSON.stringify(items),
      created_at: now,
      updated_at: now,
    };

    this.store.heldSales.set(id, held);
    return held;
  }

  async deleteHeldSale(id: string): Promise<void> {
    const held = this.store.heldSales.get(id);
    if (!held) return;

    if (this.user.role === "cashier" && held.cashier_id !== this.user.id) {
      throw new Error("No puedes eliminar ventas pausadas de otro usuario.");
    }

    this.store.heldSales.delete(id);
  }
}
