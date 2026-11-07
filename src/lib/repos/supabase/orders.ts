import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  OrdersRepo,
  OrdersListFilter,
  Order,
  OrderItem,
  UserContext,
} from "../types";

export class SupabaseOrdersRepo implements OrdersRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private _user: UserContext,
  ) {}

  async createOrder(input: {
    sessionId: string;
    items: { productId: string; quantity: number }[];
    discountCents?: number;
    notes?: string | null;
  }): Promise<{ order: Order; items: OrderItem[] }> {
    const { data: orderId, error: rpcError } = await this.supabase.rpc("create_order", {
      p_session_id: input.sessionId,
      p_items: input.items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
      })),
      p_discount_cents: input.discountCents ?? 0,
      p_notes: input.notes?.trim() || null,
    });

    if (rpcError) throw new Error(rpcError.message);

    const { data: order, error: orderError } = await this.supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError) throw new Error(orderError.message);

    const { data: items, error: itemsError } = await this.supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (itemsError) throw new Error(itemsError.message);

    return { order, items: items ?? [] };
  }

  async getById(id: string): Promise<{ order: Order; items: OrderItem[] } | null> {
    const { data: order, error: orderError } = await this.supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (orderError) throw new Error(orderError.message);
    if (!order) return null;

    const { data: items, error: itemsError } = await this.supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id);

    if (itemsError) throw new Error(itemsError.message);

    return { order, items: items ?? [] };
  }

  async list(filter?: OrdersListFilter): Promise<Order[]> {
    let query = this.supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter?.sessionId) {
      query = query.eq("session_id", filter.sessionId);
    }
    if (filter?.status) {
      query = query.eq("status", filter.status);
    }
    if (filter?.paymentStatus) {
      query = query.eq("payment_status", filter.paymentStatus);
    }
    if (filter?.limit && filter.limit > 0) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async listItemsForOrders(orderIds: readonly string[]): Promise<OrderItem[]> {
    if (orderIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from("order_items")
      .select("*")
      .in("order_id", [...orderIds]);

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async updateStatus(id: string, status: Order["status"]): Promise<Order> {
    const { data, error } = await this.supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async chargeOrder(input: {
    orderId: string;
    paymentMethod: "cash" | "qr" | "card";
    clientRequestId: string;
    cashReceivedCents?: number | null;
  }): Promise<{ saleId: string; order: Order }> {
    const { data: saleId, error: rpcError } = await this.supabase.rpc("charge_order", {
      p_order_id: input.orderId,
      p_payment_method: input.paymentMethod,
      p_client_request_id: input.clientRequestId,
      p_cash_received_cents: input.cashReceivedCents ?? null,
    });

    if (rpcError) throw new Error(rpcError.message);

    const { data: order, error: orderError } = await this.supabase
      .from("orders")
      .select("*")
      .eq("id", input.orderId)
      .single();

    if (orderError) throw new Error(orderError.message);

    return { saleId, order };
  }
}
