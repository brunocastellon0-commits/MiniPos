import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  PurchasesRepo,
  Purchase,
  PurchaseItem,
  PurchaseInsert,
  PurchaseItemInsert,
  UserContext,
} from "../types";

export class SupabasePurchasesRepo implements PurchasesRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private user: UserContext,
  ) {}

  async createPurchase(
    purchaseData: Omit<PurchaseInsert, "id" | "created_at" | "updated_at">,
    itemsData: Omit<PurchaseItemInsert, "id" | "purchase_id">[],
  ): Promise<{ purchase: Purchase; items: PurchaseItem[] }> {
    const { data: purchase, error: purchaseError } = await this.supabase
      .from("purchases")
      .insert({
        ...purchaseData,
        created_by: this.user.id,
      })
      .select()
      .single();

    if (purchaseError) throw new Error(purchaseError.message);

    const itemsToInsert = itemsData.map((item) => ({
      ...item,
      purchase_id: purchase.id,
    }));

    const { data: items, error: itemsError } = await this.supabase
      .from("purchase_items")
      .insert(itemsToInsert)
      .select();

    if (itemsError) throw new Error(itemsError.message);

    return { purchase, items };
  }

  async getById(id: string): Promise<{ purchase: Purchase; items: PurchaseItem[] } | null> {
    const { data: purchase, error: purchaseError } = await this.supabase
      .from("purchases")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (purchaseError) throw new Error(purchaseError.message);
    if (!purchase) return null;

    const { data: items, error: itemsError } = await this.supabase
      .from("purchase_items")
      .select("*")
      .eq("purchase_id", id);

    if (itemsError) throw new Error(itemsError.message);

    return { purchase, items: items || [] };
  }

  async list(filter?: { status?: Purchase["status"]; supplierId?: string }): Promise<Purchase[]> {
    let query = this.supabase
      .from("purchases")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }
    if (filter?.supplierId) {
      query = query.eq("supplier_id", filter.supplierId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async updateStatus(id: string, status: Purchase["status"]): Promise<Purchase> {
    const { data, error } = await this.supabase
      .from("purchases")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
