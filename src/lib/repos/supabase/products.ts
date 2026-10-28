import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProductsRepo, Product, ProductInsert, ProductUpdate, UserContext } from "../types";

export class SupabaseProductsRepo implements ProductsRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private user: UserContext,
  ) {}

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

    const { data, error } = await this.supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
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

    const { data, error } = await this.supabase
      .from("products")
      .select("*")
      .eq("barcode", barcode)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  async create(data: ProductInsert): Promise<Product> {
    const { data: created, error } = await this.supabase
      .from("products")
      .insert(data)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("El código de barras ya está registrado.");
      }
      throw new Error(`Error al crear producto: ${error.message}`);
    }

    return created;
  }

  async update(id: string, data: ProductUpdate): Promise<Product> {
    const { data: updated, error } = await this.supabase
      .from("products")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("El código de barras ya está registrado.");
      }
      throw new Error(`Error al actualizar producto: ${error.message}`);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from("products").delete().eq("id", id);
    if (error) throw new Error(`Error al eliminar producto: ${error.message}`);
  }
}
