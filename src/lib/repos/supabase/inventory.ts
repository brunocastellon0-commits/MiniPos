import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { InventoryRepo, StockMovement, StockMovementInsert, UserContext } from "../types";

export class SupabaseInventoryRepo implements InventoryRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private user: UserContext,
  ) {}

  async listMovements(filter?: {
    productId?: string;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<StockMovement[]> {
    let query = this.supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter?.productId) {
      query = query.eq("product_id", filter.productId);
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

  async addMovement(movement: StockMovementInsert): Promise<StockMovement> {
    const { data, error } = await this.supabase
      .from("stock_movements")
      .insert({
        ...movement,
        user_id: this.user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async adjustStock(input: {
    productId: string;
    delta: number;
    kind: "adjustment" | "waste";
    reason: string;
  }): Promise<number> {
    const { data, error } = await this.supabase.rpc("adjust_stock", {
      p_product_id: input.productId,
      p_delta: input.delta,
      p_kind: input.kind,
      p_reason: input.reason,
    });

    if (error) throw new Error(error.message);
    return data;
  }
}
