import type { ProductsRepo, Product, ProductInsert, ProductUpdate, UserContext } from "../types";
import type { MemoryStore } from "./memory-store";

export class MemoryProductsRepo implements ProductsRepo {
  constructor(
    private store: MemoryStore,
    private user: UserContext,
  ) {}

  private sanitizeForRole(product: Product): Product {
    if (this.user.role === "cashier") {
      return {
        ...product,
        cost_cents: null,
      };
    }
    return product;
  }

  async list(filter?: {
    activeOnly?: boolean;
    categoryId?: string;
    search?: string;
  }): Promise<Product[]> {
    let items = Array.from(this.store.products.values());

    // El cajero solo puede ver productos activos
    if (this.user.role === "cashier" || filter?.activeOnly) {
      items = items.filter((p) => p.active);
    }

    if (filter?.categoryId) {
      items = items.filter((p) => p.category_id === filter.categoryId);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.internal_code && p.internal_code.toLowerCase().includes(q)),
      );
    }

    return items.map((p) => this.sanitizeForRole(p));
  }

  async getById(id: string): Promise<Product | null> {
    const product = this.store.products.get(id);
    if (!product) return null;
    if (this.user.role === "cashier" && !product.active) return null;
    return this.sanitizeForRole(product);
  }

  async getByBarcode(barcode: string): Promise<Product | null> {
    const product = Array.from(this.store.products.values()).find((p) => p.barcode === barcode);
    if (!product) return null;
    if (this.user.role === "cashier" && !product.active) return null;
    return this.sanitizeForRole(product);
  }

  async create(data: ProductInsert): Promise<Product> {
    if (this.user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede crear productos.");
    }

    if (data.barcode) {
      const existing = Array.from(this.store.products.values()).find(
        (p) => p.barcode === data.barcode,
      );
      if (existing) {
        throw new Error("El código de barras ya está registrado en otro producto.");
      }
    }

    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const product: Product = {
      id,
      name: data.name,
      barcode: data.barcode ?? null,
      internal_code: data.internal_code ?? null,
      category_id: data.category_id ?? null,
      unit_label: data.unit_label ?? "unidad",
      price_cents: data.price_cents,
      cost_cents: data.cost_cents ?? null,
      stock_qty: data.stock_qty ?? 0,
      min_stock: data.min_stock ?? 5,
      active: data.active ?? true,
      created_at: data.created_at ?? now,
      updated_at: data.updated_at ?? now,
    };

    this.store.products.set(id, product);
    return this.sanitizeForRole(product);
  }

  async update(id: string, data: ProductUpdate): Promise<Product> {
    if (this.user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede editar productos.");
    }

    const existing = this.store.products.get(id);
    if (!existing) {
      throw new Error("Producto no encontrado.");
    }

    if (data.barcode && data.barcode !== existing.barcode) {
      const duplicate = Array.from(this.store.products.values()).find(
        (p) => p.barcode === data.barcode && p.id !== id,
      );
      if (duplicate) {
        throw new Error("El código de barras ya está registrado en otro producto.");
      }
    }

    const updated: Product = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };

    this.store.products.set(id, updated);
    return this.sanitizeForRole(updated);
  }

  async delete(id: string): Promise<void> {
    if (this.user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede eliminar productos.");
    }
    this.store.products.delete(id);
  }
}
