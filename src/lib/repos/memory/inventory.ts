import type { InventoryRepo, StockMovement, StockMovementInsert, UserContext } from "../types";
import type { MemoryStore } from "./memory-store";

export class MemoryInventoryRepo implements InventoryRepo {
  constructor(
    private store: MemoryStore,
    private user: UserContext,
  ) {}

  async listMovements(filter?: { productId?: string; limit?: number }): Promise<StockMovement[]> {
    if (this.user.role !== "owner") {
      throw new Error(
        "Acceso denegado: solo el propietario puede consultar el historial de movimientos de inventario.",
      );
    }

    let movements = Array.from(this.store.stockMovements.values());

    if (filter?.productId) {
      movements = movements.filter((m) => m.product_id === filter.productId);
    }

    return movements
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, filter?.limit ?? 100);
  }

  async addMovement(movementData: StockMovementInsert): Promise<StockMovement> {
    if (this.user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede realizar ajustes de inventario.");
    }

    if (movementData.delta === 0) {
      throw new Error("El delta de ajuste no puede ser cero.");
    }

    const product = this.store.products.get(movementData.product_id);
    if (!product) {
      throw new Error("Producto no encontrado.");
    }

    const allowNegative = this.store.businessSettings.allow_negative_stock;
    if (!allowNegative && product.stock_qty + movementData.delta < 0) {
      throw new Error("El ajuste dejaría el stock del producto en negativo.");
    }

    const id = movementData.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const movement: StockMovement = {
      id,
      product_id: movementData.product_id,
      kind: movementData.kind,
      delta: movementData.delta,
      reason: movementData.reason ?? null,
      ref_type: movementData.ref_type ?? null,
      ref_id: movementData.ref_id ?? null,
      user_id: this.user.id,
      created_at: now,
    };

    product.stock_qty += movementData.delta;
    product.updated_at = now;

    this.store.stockMovements.set(id, movement);
    return movement;
  }
}
