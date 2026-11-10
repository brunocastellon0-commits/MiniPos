import { expectedCashCents } from "@/lib/domain/cash";
import type {
  CashRepo,
  CashSession,
  CashSessionWithOpener,
  CashMovement,
  OpenCashSessionPublic,
  UserContext,
} from "../types";
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

  async getOpenSessionPublic(): Promise<OpenCashSessionPublic | null> {
    const session = await this.getCurrentSession();
    if (!session) return null;

    const opener = this.store.profiles.get(session.opened_by);
    return {
      id: session.id,
      opened_at: session.opened_at,
      opened_by: session.opened_by,
      opened_by_name: opener?.full_name ?? "Usuario",
    };
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

    const expectedCash = expectedCashCents({
      openingCents: session.opening_cents,
      sales: Array.from(this.store.sales.values()).filter((s) => s.session_id === sessionId),
      movements: Array.from(this.store.cashMovements.values()).filter(
        (m) => m.session_id === sessionId,
      ),
    });

    if (expectedCash < 0) {
      throw new Error(
        "El efectivo esperado no puede ser negativo. Revisa los movimientos del turno.",
      );
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

  async listSessions(limit = 30): Promise<CashSessionWithOpener[]> {
    let list = Array.from(this.store.cashSessions.values());
    if (this.user.role === "cashier") {
      list = list.filter(
        (s) => s.opened_by === this.user.id || s.closed_by === this.user.id || s.status === "open",
      );
    }
    return list
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
      .slice(0, limit)
      .map((session) => ({
        ...session,
        opened_by_name: this.store.profiles.get(session.opened_by)?.full_name ?? null,
      }));
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

    if (data.kind === "out") {
      const available = expectedCashCents({
        openingCents: session.opening_cents,
        sales: Array.from(this.store.sales.values()).filter((s) => s.session_id === data.sessionId),
        movements: Array.from(this.store.cashMovements.values()).filter(
          (m) => m.session_id === data.sessionId,
        ),
      });

      if (data.amountCents > available) {
        throw new Error("El egreso supera el efectivo disponible en caja.");
      }
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

  async listMovementsRange(dateFrom: string, dateTo: string): Promise<CashMovement[]> {
    const start = Date.parse(dateFrom);
    const end = Date.parse(dateTo);

    return Array.from(this.store.cashMovements.values())
      .filter((movement) => {
        const time = Date.parse(movement.created_at);
        if (Number.isNaN(time) || time < start || time > end) return false;
        if (this.user.role !== "cashier") return true;
        const session = this.store.cashSessions.get(movement.session_id);
        if (!session) return false;
        return (
          session.opened_by === this.user.id ||
          session.closed_by === this.user.id ||
          session.status === "open"
        );
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
}
