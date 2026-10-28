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
    purchaseData: Omit<PurchaseInsert, "id" | "created_at" | "updated_at">,
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
}
