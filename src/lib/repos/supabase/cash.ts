import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  CashRepo,
  CashSession,
  CashSessionWithOpener,
  CashMovement,
  OpenCashSessionPublic,
  UserContext,
} from "../types";

export class SupabaseCashRepo implements CashRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private user: UserContext,
  ) {}

  async getCurrentSession(): Promise<CashSession | null> {
    const { data, error } = await this.supabase
      .from("cash_sessions")
      .select("*")
      .eq("status", "open")
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  async getOpenSessionPublic(): Promise<OpenCashSessionPublic | null> {
    const { data, error } = await this.supabase.rpc("get_open_cash_session_public");

    if (error) throw new Error(error.message);
    return data?.[0] ?? null;
  }

  async openSession(openingCents: number, notes?: string): Promise<CashSession> {
    const { data: sessionId, error } = await this.supabase.rpc("open_cash_session", {
      p_opening_cents: openingCents,
      p_notes: notes ?? null,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya existe una sesión de caja abierta.");
      }
      throw new Error(error.message);
    }

    const session = await this.getSessionById(sessionId);
    if (!session) throw new Error("No se pudo recuperar la sesión de caja abierta.");
    return session;
  }

  async closeSession(
    sessionId: string,
    countedCents: number,
    notes?: string,
  ): Promise<CashSession> {
    const { data: closedId, error } = await this.supabase.rpc("close_cash_session", {
      p_session_id: sessionId,
      p_counted_cents: countedCents,
      p_notes: notes ?? null,
    });

    if (error) throw new Error(error.message);

    const session = await this.getSessionById(closedId);
    if (!session) throw new Error("No se pudo recuperar la sesión de caja cerrada.");
    return session;
  }

  async listSessions(limit = 30): Promise<CashSessionWithOpener[]> {
    const { data, error } = await this.supabase
      .from("cash_sessions")
      .select("*, opener:profiles!opened_by(full_name)")
      .order("opened_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data ?? []).map(({ opener, ...session }) => ({
      ...session,
      opened_by_name: opener?.full_name ?? null,
    }));
  }

  async getSessionById(id: string): Promise<CashSession | null> {
    const { data, error } = await this.supabase
      .from("cash_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  async addMovement(data: {
    sessionId: string;
    kind: "in" | "out";
    amountCents: number;
    reason: string;
  }): Promise<CashMovement> {
    const { data: movementId, error } = await this.supabase.rpc("add_cash_movement", {
      p_session_id: data.sessionId,
      p_kind: data.kind,
      p_amount_cents: data.amountCents,
      p_reason: data.reason,
    });

    if (error) throw new Error(error.message);

    const { data: created, error: fetchError } = await this.supabase
      .from("cash_movements")
      .select("*")
      .eq("id", movementId)
      .single();

    if (fetchError) throw new Error(fetchError.message);
    return created;
  }

  async listMovements(sessionId: string): Promise<CashMovement[]> {
    const { data, error } = await this.supabase
      .from("cash_movements")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async listMovementsRange(dateFrom: string, dateTo: string): Promise<CashMovement[]> {
    const { data, error } = await this.supabase
      .from("cash_movements")
      .select("*")
      .gte("created_at", dateFrom)
      .lte("created_at", dateTo)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  }
}
