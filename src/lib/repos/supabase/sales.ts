import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type {
  SalesRepo,
  SalesListFilter,
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
    const { data: saleId, error: rpcError } = await this.supabase.rpc("confirm_sale", {
      p_session_id: saleData.session_id,
      p_payment_method: saleData.payment_method,
      p_client_request_id: saleData.client_request_id,
      p_items: itemsData.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
      p_discount_cents: saleData.discount_cents ?? 0,
      p_cash_received_cents: saleData.cash_received_cents ?? null,
    });

    if (rpcError) throw new Error(rpcError.message);

    const { data: sale, error: saleError } = await this.supabase
      .from("sales")
      .select("*")
      .eq("id", saleId)
      .single();

    if (saleError) throw new Error(saleError.message);

    const { data: items, error: itemsError } = await this.supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", saleId);

    if (itemsError) throw new Error(itemsError.message);

    return { sale, items: items || [] };
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

  async listItemsForSales(saleIds: readonly string[]): Promise<SaleItem[]> {
    const ids = Array.from(new Set(saleIds));
    const items: SaleItem[] = [];
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data, error } = await this.supabase.from("sale_items").select("*").in("sale_id", chunk);
      if (error) throw new Error(error.message);
      items.push(...(data || []));
    }
    return items;
  }

  async list(filter?: SalesListFilter): Promise<Sale[]> {
    let query = this.supabase.from("sales").select("*").order("created_at", { ascending: false });

    if (filter?.sessionId) {
      query = query.eq("session_id", filter.sessionId);
    }
    if (filter?.cashierId) {
      query = query.eq("cashier_id", filter.cashierId);
    }
    if (filter?.paymentMethod) {
      query = query.eq("payment_method", filter.paymentMethod);
    }
    if (filter?.status) {
      query = query.eq("status", filter.status);
    }
    if (filter?.dateFrom) {
      query = query.gte("created_at", filter.dateFrom);
    }
    if (filter?.dateTo) {
      query = query.lte("created_at", filter.dateTo);
    }
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async voidSale(id: string, reason: string): Promise<Sale> {
    const { data: saleId, error: rpcError } = await this.supabase.rpc("void_sale", {
      p_sale_id: id,
      p_reason: reason,
    });

    if (rpcError) throw new Error(rpcError.message);

    const { data: sale, error } = await this.supabase
      .from("sales")
      .select("*")
      .eq("id", saleId)
      .single();

    if (error) throw new Error(error.message);
    return sale;
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
