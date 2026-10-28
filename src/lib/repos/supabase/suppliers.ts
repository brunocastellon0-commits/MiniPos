import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  SuppliersRepo,
  Supplier,
  SupplierInsert,
  SupplierUpdate,
  UserContext,
} from "../types";

export class SupabaseSuppliersRepo implements SuppliersRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private _user: UserContext,
  ) {}

  async list(filter?: { activeOnly?: boolean }): Promise<Supplier[]> {
    let query = this.supabase.from("suppliers").select("*").order("name", { ascending: true });

    if (filter?.activeOnly) {
      query = query.eq("active", true);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async getById(id: string): Promise<Supplier | null> {
    const { data, error } = await this.supabase
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  async create(data: SupplierInsert): Promise<Supplier> {
    const { data: created, error } = await this.supabase
      .from("suppliers")
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return created;
  }

  async update(id: string, data: SupplierUpdate): Promise<Supplier> {
    const { data: updated, error } = await this.supabase
      .from("suppliers")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from("suppliers").delete().eq("id", id);

    if (error) throw new Error(error.message);
  }
}
