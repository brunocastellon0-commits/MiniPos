import type {
  CategoriesRepo,
  Category,
  CategoryInsert,
  CategoryUpdate,
  UserContext,
} from "../types";
import type { MemoryStore } from "./memory-store";

export class MemoryCategoriesRepo implements CategoriesRepo {
  constructor(
    private store: MemoryStore,
    private user: UserContext,
  ) {}

  async list(filter?: { activeOnly?: boolean }): Promise<Category[]> {
    let items = Array.from(this.store.categories.values());
    if (this.user.role === "cashier" || filter?.activeOnly) {
      items = items.filter((c) => c.active);
    }
    return items.sort((a, b) => a.sort_order - b.sort_order);
  }

  async getById(id: string): Promise<Category | null> {
    const category = this.store.categories.get(id);
    if (!category) return null;
    if (this.user.role === "cashier" && !category.active) return null;
    return category;
  }

  async create(data: CategoryInsert): Promise<Category> {
    if (this.user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede crear categorías.");
    }

    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const category: Category = {
      id,
      name: data.name,
      sort_order: data.sort_order ?? 0,
      active: data.active ?? true,
      created_at: data.created_at ?? now,
      updated_at: data.updated_at ?? now,
    };

    this.store.categories.set(id, category);
    return category;
  }

  async update(id: string, data: CategoryUpdate): Promise<Category> {
    if (this.user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede editar categorías.");
    }

    const existing = this.store.categories.get(id);
    if (!existing) {
      throw new Error("Categoría no encontrada.");
    }

    const updated: Category = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };

    this.store.categories.set(id, updated);
    return updated;
  }

  async reorder(ids: string[]): Promise<Category[]> {
    if (this.user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede ordenar categorías.");
    }

    const current = Array.from(this.store.categories.values());
    if (ids.length !== current.length) {
      throw new Error("La lista de categorías cambió. Recarga la página e intenta de nuevo.");
    }

    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new Error("La lista de categorías contiene identificadores repetidos.");
    }

    for (const id of ids) {
      if (!this.store.categories.has(id)) {
        throw new Error("Categoría no encontrada.");
      }
    }

    const now = new Date().toISOString();
    ids.forEach((id, index) => {
      const category = this.store.categories.get(id);
      if (!category) return;
      this.store.categories.set(id, { ...category, sort_order: index, updated_at: now });
    });

    return Array.from(this.store.categories.values()).sort((a, b) => a.sort_order - b.sort_order);
  }

  async delete(id: string): Promise<void> {
    if (this.user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede eliminar categorías.");
    }

    const hasProducts = Array.from(this.store.products.values()).some(
      (product) => product.category_id === id,
    );
    if (hasProducts) {
      throw new Error(
        "La categoría tiene productos asociados. Desactívala o reasigna sus productos antes de eliminarla.",
      );
    }

    this.store.categories.delete(id);
  }
}
