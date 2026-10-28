import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { CashRepo, CashSession, CashMovement, UserContext } from "../types";

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

  async openSession(openingCents: number, notes?: string): Promise<CashSession> {
    const { data, error } = await this.supabase
      .from("cash_sessions")
      .insert({
        opened_by: this.user.id,
        opening_cents: openingCents,
        status: "open",
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya existe una sesión de caja abierta.");
      }
      throw new Error(`Error al abrir sesión de caja: ${error.message}`);
    }

    return data;
  }

  async closeSession(
    sessionId: string,
    countedCents: number,
    notes?: string,
  ): Promise<CashSession> {
    // En tareas posteriores (E3), esto se delegará a la RPC close_cash_session
    const session = await this.getSessionById(sessionId);
    if (!session) throw new Error("Sesión no encontrada.");

    const now = new Date().toISOString();
    const expected = session.expected_cash_cents ?? session.opening_cents;
    const diff = countedCents - expected;

    const { data, error } = await this.supabase
      .from("cash_sessions")
      .update({
        status: "closed",
        closed_by: this.user.id,
        closed_at: now,
        counted_cash_cents: countedCents,
        expected_cash_cents: expected,
        difference_cents: diff,
        notes: notes ?? session.notes,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async listSessions(limit = 30): Promise<CashSession[]> {
    const { data, error } = await this.supabase
      .from("cash_sessions")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
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
    const { data: created, error } = await this.supabase
      .from("cash_movements")
      .insert({
        session_id: data.sessionId,
        kind: data.kind,
        amount_cents: data.amountCents,
        reason: data.reason,
        user_id: this.user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
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
}
