import { z } from "zod";
import { SupabaseSettingsRepo } from "@/lib/repos/supabase/settings";
import type { BusinessPublicSettings, SettingsRepo, UserContext } from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  type AuthenticatedUser,
  secureAction,
} from "./secure-action";

export interface SettingsActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  settingsRepoFactory?: (user: UserContext) => Promise<SettingsRepo>;
}

async function defaultSettingsRepoFactory(user: UserContext): Promise<SettingsRepo> {
  const supabase = await createClient();
  return new SupabaseSettingsRepo(supabase, user);
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
