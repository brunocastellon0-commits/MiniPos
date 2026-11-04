import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProductsRepo, Product, ProductInsert, ProductUpdate, UserContext } from "../types";

export class SupabaseProductsRepo implements ProductsRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private user: UserContext,
  ) {}

  private sanitizeForRole(product: Product): Product {
    return this.user.role === "cashier" ? { ...product, cost_cents: null } : product;
  }

  // `cost_cents` no tiene GRANT de SELECT en la tabla products (solo el dueño lo
  // obtiene vía products_with_cost), por lo que las filas de escritura se piden
  // con las columnas permitidas y el costo se completa aparte.
  private static readonly SAFE_COLUMNS =
    "id, name, barcode, internal_code, category_id, unit_label, price_cents, stock_qty, min_stock, active, created_at, updated_at";

  private async fetchCostById(id: string): Promise<number | null> {
    const { data, error } = await this.supabase.rpc("products_with_cost");
    if (error) throw new Error(`Error al consultar el producto: ${error.message}`);
    const rows = (data ?? []) as Product[];
    return rows.find((row) => row.id === id)?.cost_cents ?? null;
  }

  async list(filter?: {
    activeOnly?: boolean;
    categoryId?: string;
    search?: string;
  }): Promise<Product[]> {
    if (this.user.role === "cashier") {
      let query = this.supabase.from("products_pos").select("*");

      if (filter?.categoryId) {
        query = query.eq("category_id", filter.categoryId);
      }
      if (filter?.search) {
        query = query.ilike("name", `%${filter.search}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Error al listar productos: ${error.message}`);

      return (data || []).map((p) => ({
        ...p,
        cost_cents: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    }

    // Rol owner: usa función RPC con costos
    const { data, error } = await this.supabase.rpc("products_with_cost");
    if (error) throw new Error(`Error al listar productos con costo: ${error.message}`);

    let items = (data || []) as Product[];
    if (filter?.activeOnly) {
      items = items.filter((p) => p.active);
    }
    if (filter?.categoryId) {
      items = items.filter((p) => p.category_id === filter.categoryId);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q)),
      );
    }

    return items;
  }

  async getById(id: string): Promise<Product | null> {
    if (this.user.role === "cashier") {
      const { data, error } = await this.supabase
        .from("products_pos")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;

      return {
        ...data,
        cost_cents: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Rol owner: la columna cost_cents no tiene GRANT de SELECT, se lee por RPC
    const { data, error } = await this.supabase.rpc("products_with_cost");
    if (error) throw new Error(`Error al consultar el producto: ${error.message}`);
    const rows = (data ?? []) as Product[];
    return rows.find((row) => row.id === id) ?? null;
  }

  async getByIds(ids: string[]): Promise<Product[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];

    if (this.user.role === "cashier") {
      const { data, error } = await this.supabase
        .from("products_pos")
        .select("*")
        .in("id", uniqueIds);

      if (error) throw new Error(error.message);
      const now = new Date().toISOString();
      return (data ?? []).map((row) => ({
        ...row,
        cost_cents: null,
        created_at: now,
        updated_at: now,
      }));
    }

    // Rol owner: una sola llamada a la RPC en lugar de N consultas por id
    const { data, error } = await this.supabase.rpc("products_with_cost");
    if (error) throw new Error(`Error al consultar los productos: ${error.message}`);
    const wanted = new Set(uniqueIds);
    return ((data ?? []) as Product[]).filter((row) => wanted.has(row.id));
  }

  async getByBarcode(barcode: string): Promise<Product | null> {
    if (this.user.role === "cashier") {
      const { data, error } = await this.supabase
        .from("products_pos")
        .select("*")
        .eq("barcode", barcode)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;

      return {
        ...data,
        cost_cents: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Rol owner: la columna cost_cents no tiene GRANT de SELECT, se lee por RPC
    const { data, error } = await this.supabase.rpc("products_with_cost");
    if (error) throw new Error(`Error al consultar el producto: ${error.message}`);
    const rows = (data ?? []) as Product[];
    return rows.find((row) => row.barcode === barcode) ?? null;
  }

  async create(data: ProductInsert): Promise<Product> {
    const { data: created, error } = await this.supabase
      .from("products")
      .insert(data)
      .select(SupabaseProductsRepo.SAFE_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("El código de barras ya está registrado.");
      }
      throw new Error(`Error al crear producto: ${error.message}`);
    }

    return { ...created, cost_cents: data.cost_cents ?? null };
  }

  async createMany(items: ProductInsert[]): Promise<Product[]> {
    if (items.length === 0) return [];

    const { data, error } = await this.supabase
      .from("products")
      .insert(items)
      .select(SupabaseProductsRepo.SAFE_COLUMNS);

    if (error) {
      if (error.code === "23505") {
        throw new Error("El código de barras ya está registrado en otro producto.");
      }
      throw new Error(`Error al importar productos: ${error.message}`);
    }

    const rows = data || [];
    const { data: withCost, error: costError } = await this.supabase.rpc("products_with_cost");
    if (costError) throw new Error(`Error al importar productos: ${costError.message}`);
    const costById = new Map(
      ((withCost ?? []) as Product[]).map((product) => [product.id, product.cost_cents]),
    );
    return rows.map((product) =>
      this.sanitizeForRole({ ...product, cost_cents: costById.get(product.id) ?? null }),
    );
  }

  async update(id: string, data: ProductUpdate): Promise<Product> {
    const { data: updated, error } = await this.supabase
      .from("products")
      .update(data)
      .eq("id", id)
      .select(SupabaseProductsRepo.SAFE_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("El código de barras ya está registrado.");
      }
      throw new Error(`Error al actualizar producto: ${error.message}`);
    }

    const cost = data.cost_cents !== undefined ? data.cost_cents : await this.fetchCostById(id);
    return { ...updated, cost_cents: cost };
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from("products").delete().eq("id", id);
    if (error) throw new Error(`Error al eliminar producto: ${error.message}`);
  }
}
