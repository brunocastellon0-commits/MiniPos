import { z } from "zod";
import {
  computeAuditAlerts,
  parseAuditSummary,
  type AuditAlert,
  type AuditEntryInput,
} from "@/lib/domain/audit-alerts";
import { SupabaseAuditRepo } from "@/lib/repos/supabase/audit";
import { SupabaseCashRepo } from "@/lib/repos/supabase/cash";
import { SupabaseUsersRepo } from "@/lib/repos/supabase/users";
import type {
  AuditRepo,
  CashRepo,
  Profile,
  UserContext,
  UsersRepo,
} from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  secureAction,
  type AuthenticatedUser,
  type ActionResult,
} from "./secure-action";

export interface AuditEntryView {
  id: string;
  at: string;
  action: string;
  entity: string;
  entityId: string | null;
  summary: Record<string, unknown>;
  reason: string | null;
  userId: string;
  userName: string | null;
}

export interface AuditActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  auditRepoFactory?: (user: UserContext) => Promise<AuditRepo>;
  usersRepoFactory?: (user: UserContext) => Promise<UsersRepo>;
  cashRepoFactory?: (user: UserContext) => Promise<CashRepo>;
}

async function defaultAuditRepoFactory(user: UserContext): Promise<AuditRepo> {
  const supabase = await createClient();
  return new SupabaseAuditRepo(supabase, user);
}

async function defaultUsersRepoFactory(user: UserContext): Promise<UsersRepo> {
  const supabase = await createClient();
  return new SupabaseUsersRepo(supabase, user);
}

async function defaultCashRepoFactory(user: UserContext): Promise<CashRepo> {
  const supabase = await createClient();
  return new SupabaseCashRepo(supabase, user);
}

const emptyInputSchema = z.object({}).strict().optional().default({});

export function createListAuditLogAction(deps: AuditActionDeps = {}) {
  const {
    currentUserResolver,
    auditRepoFactory = defaultAuditRepoFactory,
    usersRepoFactory = defaultUsersRepoFactory,
  } = deps;

  return async (): Promise<ActionResult<AuditEntryView[]>> => {
    return secureAction<Record<string, never>, AuditEntryView[]>({
      roles: ["owner"],
      schema: emptyInputSchema,
      currentUserResolver,
      handler: async (_input, ctx) => {
        const userContext: UserContext = {
          id: ctx.user.id,
          role: ctx.user.role,
          active: ctx.user.isActive,
        };
        const [auditRepo, usersRepo] = await Promise.all([
          auditRepoFactory(userContext),
          usersRepoFactory(userContext),
        ]);

        const [logs, profiles] = await Promise.all([
          auditRepo.list({ limit: 100 }),
          usersRepo.listProfiles().catch(() => [] as Profile[]),
        ]);

        const namesById = new Map(profiles.map((profile) => [profile.id, profile.full_name]));

        return logs.map((log) => ({
          id: log.id,
          at: log.at,
          action: log.action,
          entity: log.entity,
          entityId: log.entity_id,
          summary: parseAuditSummary(log.summary),
          reason: log.reason,
          userId: log.user_id,
          userName: namesById.get(log.user_id) ?? null,
        }));
      },
    })({});
  };
}

export function createGetAuditAlertsAction(deps: AuditActionDeps = {}) {
  const {
    currentUserResolver,
    auditRepoFactory = defaultAuditRepoFactory,
    cashRepoFactory = defaultCashRepoFactory,
  } = deps;

  return async (): Promise<ActionResult<AuditAlert[]>> => {
    return secureAction<Record<string, never>, AuditAlert[]>({
      roles: ["owner"],
      schema: emptyInputSchema,
      currentUserResolver,
      handler: async (_input, ctx) => {
        const userContext: UserContext = {
          id: ctx.user.id,
          role: ctx.user.role,
          active: ctx.user.isActive,
        };
        const [auditRepo, cashRepo] = await Promise.all([
          auditRepoFactory(userContext),
          cashRepoFactory(userContext),
        ]);

        const [logs, sessions] = await Promise.all([
          auditRepo.list({ limit: 100 }),
          cashRepo.listSessions(50),
        ]);

        const entries: AuditEntryInput[] = logs.map((log) => ({
          action: log.action,
          entityId: log.entity_id,
          at: log.at,
          summary: log.summary,
        }));
        const closedSessions = sessions
          .filter((session) => session.status === "closed")
          .map((session) => ({
            closedAt: session.closed_at,
            differenceCents: session.difference_cents,
          }));

        return computeAuditAlerts({ entries, closedSessions, now: new Date() });
      },
    })({});
  };
}
