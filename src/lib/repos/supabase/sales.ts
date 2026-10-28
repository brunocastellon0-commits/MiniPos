import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type {
  SalesRepo,
  Sale,
  SaleItem,
  HeldSale,
  SaleInsert,
  SaleItemInsert,
  UserContext,
} from "../types";

export class SupabaseSalesRepo implements SalesRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private user: UserContext,
  ) {}

  async createSale(
    saleData: Omit<SaleInsert, "number" | "id" | "created_at" | "cashier_id">,
    itemsData: Omit<SaleItemInsert, "id" | "sale_id">[],
  ): Promise<{ sale: Sale; items: SaleItem[] }> {
    // En tareas posteriores (E4), esto se delegará a la RPC confirm_sale
    const { data: sale, error: saleError } = await this.supabase
      .from("sales")
      .insert({
        ...saleData,
        cashier_id: this.user.id,
      })
      .select()
      .single();

    if (saleError) throw new Error(saleError.message);

    const itemsToInsert = itemsData.map((item) => ({
      ...item,
      sale_id: sale.id,
    }));

    const { data: items, error: itemsError } = await this.supabase
      .from("sale_items")
      .insert(itemsToInsert)
      .select();

    if (itemsError) throw new Error(itemsError.message);

    return { sale, items };
  }

  async getById(id: string): Promise<{ sale: Sale; items: SaleItem[] } | null> {
    const { data: sale, error: saleError } = await this.supabase
      .from("sales")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (saleError) throw new Error(saleError.message);
    if (!sale) return null;

    const { data: items, error: itemsError } = await this.supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", id);

    if (itemsError) throw new Error(itemsError.message);

    return { sale, items: items || [] };
  }

  async getByClientRequestId(
    clientRequestId: string,
  ): Promise<{ sale: Sale; items: SaleItem[] } | null> {
    const { data: sale, error: saleError } = await this.supabase
      .from("sales")
      .select("*")
      .eq("client_request_id", clientRequestId)
      .maybeSingle();

    if (saleError) throw new Error(saleError.message);
    if (!sale) return null;

    const { data: items, error: itemsError } = await this.supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", sale.id);

    if (itemsError) throw new Error(itemsError.message);

    return { sale, items: items || [] };
  }

  async list(filter?: { sessionId?: string; cashierId?: string; limit?: number }): Promise<Sale[]> {
    let query = this.supabase.from("sales").select("*").order("created_at", { ascending: false });

    if (filter?.sessionId) {
      query = query.eq("session_id", filter.sessionId);
    }
    if (filter?.cashierId) {
      query = query.eq("cashier_id", filter.cashierId);
    }
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async voidSale(id: string, reason: string): Promise<Sale> {
    // En tareas posteriores (E5), esto se delegará a la RPC void_sale
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("sales")
      .update({
        status: "voided",
        voided_by: this.user.id,
        voided_at: now,
        void_reason: reason,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async getHeldSales(): Promise<HeldSale[]> {
    const { data, error } = await this.supabase
      .from("held_sales")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async saveHeldSale(label: string, items: unknown[]): Promise<HeldSale> {
    const { data, error } = await this.supabase
      .from("held_sales")
      .insert({
        cashier_id: this.user.id,
        label,
        items: items as Json,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async deleteHeldSale(id: string): Promise<void> {
    const { error } = await this.supabase.from("held_sales").delete().eq("id", id);

    if (error) throw new Error(error.message);
  }
}
