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

  async adjustStock(input: {
    productId: string;
    delta: number;
    kind: "adjustment" | "waste";
    reason: string;
  }): Promise<number> {
    if (this.user.role !== "owner") {
      throw new Error("Solo el propietario puede ajustar el inventario.");
    }
    if (input.kind !== "adjustment" && input.kind !== "waste") {
      throw new Error("Tipo de movimiento inválido (adjustment o waste).");
    }
    if (input.delta === 0) {
      throw new Error("El delta debe ser distinto de cero.");
    }

    const reason = input.reason.trim();
    if (reason.length === 0) {
      throw new Error("El motivo es obligatorio.");
    }
    if (reason.length > 300) {
      throw new Error("El motivo no puede superar 300 caracteres.");
    }

    const product = this.store.products.get(input.productId);
    if (!product) {
      throw new Error("Producto no encontrado.");
    }
    if (product.stock_qty + input.delta < 0 && !this.store.businessSettings.allow_negative_stock) {
      throw new Error(
        `El ajuste dejaría el stock en negativo (disponible: ${product.stock_qty}, delta: ${input.delta}).`,
      );
    }

    await this.addMovement({
      product_id: input.productId,
      kind: input.kind,
      delta: input.delta,
      reason,
      ref_type: "manual",
      ref_id: null,
      user_id: this.user.id,
    });

    // addMovement muta el producto del store en el lugar
    return product.stock_qty;
  }
}
