import type {
  SuppliersRepo,
  Supplier,
  SupplierInsert,
  SupplierUpdate,
  UserContext,
} from "../types";
import type { MemoryStore } from "./memory-store";

export class MemorySuppliersRepo implements SuppliersRepo {
  constructor(
    private store: MemoryStore,
    private user: UserContext,
  ) {}

  private checkOwner(): void {
    if (this.user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede gestionar proveedores.");
    }
  }

  async list(filter?: { activeOnly?: boolean }): Promise<Supplier[]> {
    this.checkOwner();
    let list = Array.from(this.store.suppliers.values());
    if (filter?.activeOnly) {
      list = list.filter((s) => s.active);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getById(id: string): Promise<Supplier | null> {
    this.checkOwner();
    return this.store.suppliers.get(id) ?? null;
  }

  async create(data: SupplierInsert): Promise<Supplier> {
    this.checkOwner();

    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const supplier: Supplier = {
      id,
      name: data.name,
      phone: data.phone ?? null,
      notes: data.notes ?? null,
      active: data.active ?? true,
      created_at: data.created_at ?? now,
      updated_at: data.updated_at ?? now,
    };

    this.store.suppliers.set(id, supplier);
    return supplier;
  }

  async update(id: string, data: SupplierUpdate): Promise<Supplier> {
    this.checkOwner();

    const existing = this.store.suppliers.get(id);
    if (!existing) {
      throw new Error("Proveedor no encontrado.");
    }

    const updated: Supplier = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };

    this.store.suppliers.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.checkOwner();
    this.store.suppliers.delete(id);
  }
}
