import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  CategoriesRepo,
  Category,
  CategoryInsert,
  CategoryUpdate,
  UserContext,
} from "../types";

export class SupabaseCategoriesRepo implements CategoriesRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private _user: UserContext,
  ) {}

  async list(filter?: { activeOnly?: boolean }): Promise<Category[]> {
    let query = this.supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (filter?.activeOnly) {
      query = query.eq("active", true);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async getById(id: string): Promise<Category | null> {
    const { data, error } = await this.supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  async create(data: CategoryInsert): Promise<Category> {
    const { data: created, error } = await this.supabase
      .from("categories")
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return created;
  }

  async update(id: string, data: CategoryUpdate): Promise<Category> {
    const { data: updated, error } = await this.supabase
      .from("categories")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated;
  }

  async reorder(ids: string[]): Promise<Category[]> {
    if (this._user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede ordenar categorías.");
    }

    for (const [index, id] of ids.entries()) {
      const { error } = await this.supabase
        .from("categories")
        .update({ sort_order: index })
        .eq("id", id);

      if (error) throw new Error(`Error al ordenar categorías: ${error.message}`);
    }

    return this.list();
  }

  async delete(id: string): Promise<void> {
    const { data: assignedProducts, error: productsError } = await this.supabase
      .from("products")
      .select("id")
      .eq("category_id", id)
      .limit(1);

    if (productsError) {
      throw new Error(`Error al verificar productos de la categoría: ${productsError.message}`);
    }

    if (assignedProducts && assignedProducts.length > 0) {
      throw new Error(
        "La categoría tiene productos asociados. Desactívala o reasigna sus productos antes de eliminarla.",
      );
    }

    const { error } = await this.supabase.from("categories").delete().eq("id", id);

    if (error) throw new Error(error.message);
  }
}
