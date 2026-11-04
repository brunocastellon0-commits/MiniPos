import { z } from "zod";
import { SupabaseAuditRepo } from "@/lib/repos/supabase/audit";
import { SupabaseSettingsRepo } from "@/lib/repos/supabase/settings";
import type {
  AuditRepo,
  BusinessPublicSettings,
  BusinessSettings,
  SettingsRepo,
  UserContext,
} from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  type AuthenticatedUser,
  secureAction,
} from "./secure-action";
import {
  type UpdateBusinessSettingsInput,
  updateBusinessSettingsSchema,
} from "./settings-schema";

export interface SettingsActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  settingsRepoFactory?: (user: UserContext) => Promise<SettingsRepo>;
  auditRepoFactory?: (user: UserContext) => Promise<AuditRepo>;
}

async function defaultSettingsRepoFactory(user: UserContext): Promise<SettingsRepo> {
  const supabase = await createClient();
  return new SupabaseSettingsRepo(supabase, user);
}

async function defaultAuditRepoFactory(user: UserContext): Promise<AuditRepo> {
  const supabase = await createClient();
  return new SupabaseAuditRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

const emptyInputSchema = z.object({}).strict().optional().default({});

export function createGetBusinessPublicAction(deps: SettingsActionDeps = {}) {
  const { currentUserResolver, settingsRepoFactory = defaultSettingsRepoFactory } = deps;

  return async (): Promise<ActionResult<BusinessPublicSettings>> => {
    return secureAction<Record<string, never>, BusinessPublicSettings>({
      roles: ["owner", "cashier"],
      schema: emptyInputSchema,
      currentUserResolver,
      handler: async (_input, ctx) => {
        const repo = await settingsRepoFactory(toUserContext(ctx.user));
        return await repo.getPublicSettings();
      },
    })({});
  };
}

const EDITABLE_KEYS = [
  "name",
  "legal_name",
  "currency_code",
  "currency_symbol",
  "allow_negative_stock",
  "cashier_can_discount",
  "low_stock_default",
  "cashier_max_discount_cents",
] as const;

export function createGetBusinessSettingsAction(deps: SettingsActionDeps = {}) {
  const { currentUserResolver, settingsRepoFactory = defaultSettingsRepoFactory } = deps;

  return async (): Promise<ActionResult<BusinessSettings>> => {
    return secureAction<Record<string, never>, BusinessSettings>({
      roles: ["owner"],
      schema: emptyInputSchema,
      currentUserResolver,
      handler: async (_input, ctx) => {
        const repo = await settingsRepoFactory(toUserContext(ctx.user));
        return await repo.getSettings();
      },
    })({});
  };
}

export function createUpdateBusinessSettingsAction(deps: SettingsActionDeps = {}) {
  const {
    currentUserResolver,
    settingsRepoFactory = defaultSettingsRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (
    input: UpdateBusinessSettingsInput,
  ): Promise<ActionResult<BusinessSettings>> => {
    return secureAction<UpdateBusinessSettingsInput, BusinessSettings>({
      roles: ["owner"],
      schema: updateBusinessSettingsSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const context = toUserContext(ctx.user);
        const repo = await settingsRepoFactory(context);
        const before = await repo.getSettings();
        const after = await repo.updateSettings(validatedInput);

        const changed: Record<string, { from: unknown; to: unknown }> = {};
        for (const key of EDITABLE_KEYS) {
          if (before[key] !== after[key]) {
            changed[key] = { from: before[key], to: after[key] };
          }
        }

        const auditRepo = await auditRepoFactory(context);
        await auditRepo.write({
          action: "settings.update",
          entity: "business_settings",
          entityId: "1",
          summary: { changed },
          reason: "Actualización de la configuración del negocio",
        });

        return after;
      },
    })(input);
  };
}
