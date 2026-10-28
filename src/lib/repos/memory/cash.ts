import type { CashRepo, CashSession, CashMovement, UserContext } from "../types";
import type { MemoryStore } from "./memory-store";

export class MemoryCashRepo implements CashRepo {
  constructor(
    private store: MemoryStore,
    private user: UserContext,
  ) {}

  async getCurrentSession(): Promise<CashSession | null> {
    const openSession = Array.from(this.store.cashSessions.values()).find(
      (s) => s.status === "open",
    );
    return openSession ?? null;
  }

  async openSession(openingCents: number, notes?: string): Promise<CashSession> {
    const existingOpen = await this.getCurrentSession();
    if (existingOpen) {
      throw new Error(
        "Ya existe una sesión de caja abierta. Debe cerrarse antes de abrir una nueva.",
      );
    }

    if (openingCents < 0) {
      throw new Error("El monto de apertura no puede ser negativo.");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const session: CashSession = {
      id,
      opened_by: this.user.id,
      opened_at: now,
      opening_cents: openingCents,
      closed_by: null,
      closed_at: null,
      expected_cash_cents: null,
      counted_cash_cents: null,
      difference_cents: null,
      status: "open",
      notes: notes ?? null,
      created_at: now,
    };

    this.store.cashSessions.set(id, session);
    return session;
  }

  async closeSession(
    sessionId: string,
    countedCents: number,
    notes?: string,
  ): Promise<CashSession> {
    const session = this.store.cashSessions.get(sessionId);
    if (!session) {
      throw new Error("Sesión de caja no encontrada.");
    }
    if (session.status !== "open") {
      throw new Error("La sesión de caja ya se encuentra cerrada.");
    }
    if (countedCents < 0) {
      throw new Error("El monto contado no puede ser negativo.");
    }

    // Calcular efectivo esperado:
    // apertura + ventas en efectivo (no anuladas) + movimientos IN - movimientos OUT
    let expectedCash = session.opening_cents;

    // Sumar ventas en efectivo
    const salesInSession = Array.from(this.store.sales.values()).filter(
      (s) => s.session_id === sessionId && s.payment_method === "cash" && s.status === "paid",
    );
    for (const sale of salesInSession) {
      expectedCash += sale.total_cents;
    }

    // Movimientos de efectivo
    const movementsInSession = Array.from(this.store.cashMovements.values()).filter(
      (m) => m.session_id === sessionId,
    );
    for (const mov of movementsInSession) {
      if (mov.kind === "in") {
        expectedCash += mov.amount_cents;
      } else {
        expectedCash -= mov.amount_cents;
      }
    }

    const differenceCents = countedCents - expectedCash;
    const now = new Date().toISOString();

    const updatedSession: CashSession = {
      ...session,
      closed_by: this.user.id,
      closed_at: now,
      expected_cash_cents: expectedCash,
      counted_cash_cents: countedCents,
      difference_cents: differenceCents,
      status: "closed",
      notes: notes ?? session.notes,
    };

    this.store.cashSessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  async listSessions(limit = 30): Promise<CashSession[]> {
    let list = Array.from(this.store.cashSessions.values());
    if (this.user.role === "cashier") {
      list = list.filter(
        (s) => s.opened_by === this.user.id || s.closed_by === this.user.id || s.status === "open",
      );
    }
    return list
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
      .slice(0, limit);
  }

  async getSessionById(id: string): Promise<CashSession | null> {
    const session = this.store.cashSessions.get(id);
    if (!session) return null;
    if (
      this.user.role === "cashier" &&
      session.opened_by !== this.user.id &&
      session.closed_by !== this.user.id &&
      session.status !== "open"
    ) {
      return null;
    }
    return session;
  }

  async addMovement(data: {
    sessionId: string;
    kind: "in" | "out";
    amountCents: number;
    reason: string;
  }): Promise<CashMovement> {
    const session = this.store.cashSessions.get(data.sessionId);
    if (!session || session.status !== "open") {
      throw new Error("No se pueden agregar movimientos a una sesión cerrada o inexistente.");
    }
    if (data.amountCents <= 0) {
      throw new Error("El monto del movimiento debe ser mayor a 0.");
    }
    if (!data.reason.trim()) {
      throw new Error("El motivo del movimiento es obligatorio.");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const movement: CashMovement = {
      id,
      session_id: data.sessionId,
      kind: data.kind,
      amount_cents: data.amountCents,
      reason: data.reason.trim(),
      user_id: this.user.id,
      created_at: now,
    };

    this.store.cashMovements.set(id, movement);
    return movement;
  }

  async listMovements(sessionId: string): Promise<CashMovement[]> {
    const session = this.store.cashSessions.get(sessionId);
    if (!session) return [];
    if (
      this.user.role === "cashier" &&
      session.opened_by !== this.user.id &&
      session.closed_by !== this.user.id &&
      session.status !== "open"
    ) {
      return [];
    }

    return Array.from(this.store.cashMovements.values())
      .filter((m) => m.session_id === sessionId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}
