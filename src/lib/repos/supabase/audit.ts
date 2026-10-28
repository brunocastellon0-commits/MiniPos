import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { AuditRepo, AuditLog, UserContext } from "../types";

export class SupabaseAuditRepo implements AuditRepo {
  constructor(
    private supabase: SupabaseClient<Database>,
    private _user: UserContext,
  ) {}

  async write(entry: {
    action: string;
    entity: string;
    entityId?: string | null;
    summary?: Record<string, unknown>;
    reason?: string | null;
  }): Promise<string> {
    const { data, error } = await this.supabase.rpc("write_audit_log", {
      p_action: entry.action,
      p_entity: entry.entity,
      p_entity_id: entry.entityId ?? null,
      p_summary: (entry.summary as Json) ?? {},
      p_reason: entry.reason ?? null,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  async list(filter?: { entity?: string; limit?: number }): Promise<AuditLog[]> {
    let query = this.supabase.from("audit_log").select("*").order("at", { ascending: false });

    if (filter?.entity) {
      query = query.eq("entity", filter.entity);
    }
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }
}
