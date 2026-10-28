import type { AuditRepo, AuditLog, UserContext } from "../types";
import type { MemoryStore } from "./memory-store";

export class MemoryAuditRepo implements AuditRepo {
  constructor(
    private store: MemoryStore,
    private user: UserContext,
  ) {}

  async write(entry: {
    action: string;
    entity: string;
    entityId?: string | null;
    summary?: Record<string, unknown>;
    reason?: string | null;
  }): Promise<string> {
    if (!this.user.active) {
      throw new Error("Usuario inactivo o no autorizado.");
    }
    if (!entry.action.trim()) {
      throw new Error("La acción de auditoría es obligatoria.");
    }
    if (!entry.entity.trim()) {
      throw new Error("La entidad de auditoría es obligatoria.");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const log: AuditLog = {
      id,
      at: now,
      user_id: this.user.id,
      action: entry.action.trim(),
      entity: entry.entity.trim(),
      entity_id: entry.entityId ?? null,
      summary: JSON.stringify(entry.summary ?? {}),
      reason: entry.reason ?? null,
    };

    this.store.auditLog.set(id, log);
    return id;
  }

  async list(filter?: { entity?: string; limit?: number }): Promise<AuditLog[]> {
    if (this.user.role !== "owner") {
      throw new Error(
        "Acceso denegado: solo el propietario puede consultar la bitácora de auditoría.",
      );
    }

    let list = Array.from(this.store.auditLog.values());

    if (filter?.entity) {
      list = list.filter((a) => a.entity === filter.entity);
    }

    return list
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, filter?.limit ?? 100);
  }
}
