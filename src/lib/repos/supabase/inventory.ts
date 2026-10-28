import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { InventoryRepo, StockMovement, StockMovementInsert, UserContext } from "../types";

export class SupabaseInventoryRepo implements InventoryRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private user: UserContext,
  ) {}

  async listMovements(filter?: { productId?: string; limit?: number }): Promise<StockMovement[]> {
    let query = this.supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter?.productId) {
      query = query.eq("product_id", filter.productId);
    }
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async addMovement(movement: StockMovementInsert): Promise<StockMovement> {
    // En tareas posteriores (E6), esto se delegará a la RPC adjust_stock
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
}
