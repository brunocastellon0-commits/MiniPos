import type {
  PurchasesRepo,
  Purchase,
  PurchaseItem,
  PurchaseInsert,
  PurchaseItemInsert,
  UserContext,
} from "../types";
import type { MemoryStore } from "./memory-store";

export class MemoryPurchasesRepo implements PurchasesRepo {
  constructor(
    private store: MemoryStore,
    private user: UserContext,
  ) {}

  private checkOwner(): void {
    if (this.user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede gestionar compras.");
    }
  }

  async createPurchase(
    purchaseData: Omit<PurchaseInsert, "id" | "created_at" | "updated_at" | "created_by">,
    itemsData: Omit<PurchaseItemInsert, "id" | "purchase_id">[],
  ): Promise<{ purchase: Purchase; items: PurchaseItem[] }> {
    this.checkOwner();

    const purchaseId = crypto.randomUUID();
    const now = new Date().toISOString();

    const purchase: Purchase = {
      id: purchaseId,
      supplier_id: purchaseData.supplier_id ?? null,
      status: purchaseData.status ?? "draft",
      notes: purchaseData.notes ?? null,
      total_cents: purchaseData.total_cents ?? 0,
      created_by: this.user.id,
      created_at: now,
      updated_at: now,
    };

    const createdItems: PurchaseItem[] = [];

    for (const it of itemsData) {
      if (it.qty_ordered <= 0) {
        throw new Error("La cantidad ordenada debe ser mayor a 0.");
      }
      const itemId = crypto.randomUUID();
      const item: PurchaseItem = {
        id: itemId,
        purchase_id: purchaseId,
        product_id: it.product_id,
        qty_ordered: it.qty_ordered,
        qty_received: it.qty_received ?? 0,
        unit_cost_cents: it.unit_cost_cents,
      };
      createdItems.push(item);
      this.store.purchaseItems.set(itemId, item);
    }

    this.store.purchases.set(purchaseId, purchase);
    return { purchase, items: createdItems };
  }

  async getById(id: string): Promise<{ purchase: Purchase; items: PurchaseItem[] } | null> {
    this.checkOwner();

    const purchase = this.store.purchases.get(id);
    if (!purchase) return null;

    const items = Array.from(this.store.purchaseItems.values()).filter(
      (it) => it.purchase_id === id,
    );

    return { purchase, items };
  }

  async list(filter?: { status?: Purchase["status"]; supplierId?: string }): Promise<Purchase[]> {
    this.checkOwner();

    let list = Array.from(this.store.purchases.values());

    if (filter?.status) {
      list = list.filter((p) => p.status === filter.status);
    }
    if (filter?.supplierId) {
      list = list.filter((p) => p.supplier_id === filter.supplierId);
    }

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async updateStatus(id: string, status: Purchase["status"]): Promise<Purchase> {
    this.checkOwner();

    const purchase = this.store.purchases.get(id);
    if (!purchase) {
      throw new Error("Compra no encontrada.");
    }

    const updated: Purchase = {
      ...purchase,
      status,
      updated_at: new Date().toISOString(),
    };

    this.store.purchases.set(id, updated);
    return updated;
  }

  async receivePurchase(
    purchaseId: string,
    items: { productId: string; qtyReceived: number }[],
    updateCost: boolean,
  ): Promise<void> {
    this.checkOwner();

    const purchase = this.store.purchases.get(purchaseId);
    if (!purchase) {
      throw new Error("Compra no encontrada.");
    }
    if (items.length === 0) {
      throw new Error("Debe indicar las cantidades recibidas.");
    }

    const now = new Date().toISOString();
    let hasUpdates = false;

    for (const line of items) {
      if (!Number.isInteger(line.qtyReceived)) {
        throw new Error("Producto o cantidad recibida inválida.");
      }
      if (line.qtyReceived < 0) {
        throw new Error("La cantidad recibida no puede ser negativa.");
      }

      const item = Array.from(this.store.purchaseItems.values()).find(
        (it) => it.purchase_id === purchaseId && it.product_id === line.productId,
      );
      if (!item) {
        throw new Error("El producto no pertenece a esta compra.");
      }
      if (line.qtyReceived > item.qty_ordered) {
        throw new Error(
          `La cantidad recibida no puede superar la ordenada (pedido: ${item.qty_ordered}, recibido: ${line.qtyReceived}).`,
        );
      }

      const delta = line.qtyReceived - item.qty_received;
      if (delta === 0) continue;

      hasUpdates = true;
      item.qty_received = line.qtyReceived;

      const product = this.store.products.get(line.productId);
      if (product) {
        if (delta > 0) {
          product.stock_qty += delta;
          product.updated_at = now;
          const movementId = crypto.randomUUID();
          this.store.stockMovements.set(movementId, {
            id: movementId,
            product_id: line.productId,
            kind: "purchase",
            delta,
            reason: "Recepción de compra",
            ref_type: "purchase",
            ref_id: purchaseId,
            user_id: this.user.id,
            created_at: now,
          });
        }
        if (updateCost) {
          product.cost_cents = item.unit_cost_cents;
          product.updated_at = now;
        }
      }
    }

    const purchaseItems = Array.from(this.store.purchaseItems.values()).filter(
      (it) => it.purchase_id === purchaseId,
    );
    const remaining = purchaseItems.reduce(
      (sum, it) => sum + Math.max(it.qty_ordered - it.qty_received, 0),
      0,
    );

    if (remaining === 0) {
      purchase.status = "received";
    } else if (hasUpdates) {
      purchase.status = "partial";
    }
    if (hasUpdates) {
      purchase.updated_at = now;
    }
  }
}
