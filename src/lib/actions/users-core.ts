import { z } from "zod";
import { canDemoteOrDeactivateOwner } from "@/lib/domain/users";
import { SupabaseAuditRepo } from "@/lib/repos/supabase/audit";
import { SupabaseUsersRepo } from "@/lib/repos/supabase/users";
import type { AuditRepo, Profile, UserContext, UsersRepo } from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  type AuthenticatedUser,
  type ActionResult,
  ActionException,
  secureAction,
} from "./secure-action";
import {
  toggleUserActiveSchema,
  type ToggleUserActiveInput,
  updateUserNameSchema,
  type UpdateUserNameInput,
  updateUserRoleSchema,
  type UpdateUserRoleInput,
} from "./users-schema";

export type { AuthenticatedUser };

export interface UsersActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  usersRepoFactory?: (user: UserContext) => Promise<UsersRepo>;
  auditRepoFactory?: (user: UserContext) => Promise<AuditRepo>;
}

async function defaultUsersRepoFactory(user: UserContext): Promise<UsersRepo> {
  const supabase = await createClient();
  return new SupabaseUsersRepo(supabase, user);
}

async function defaultAuditRepoFactory(user: UserContext): Promise<AuditRepo> {
  const supabase = await createClient();
  return new SupabaseAuditRepo(supabase, user);
}

const emptyInputSchema = z.object({}).strict().optional().default({});

export function createListUsersAction(deps: UsersActionDeps = {}) {
  const {
    currentUserResolver,
    usersRepoFactory = defaultUsersRepoFactory,
  } = deps;

  return async (): Promise<ActionResult<Profile[]>> => {
    return secureAction<Record<string, never>, Profile[]>({
      roles: ["owner"],
      schema: emptyInputSchema,
      currentUserResolver,
      handler: async (_input, ctx) => {
        const userContext: UserContext = {
          id: ctx.user.id,
          role: ctx.user.role,
          active: ctx.user.isActive,
        };
        const usersRepo = await usersRepoFactory(userContext);
        return await usersRepo.listProfiles();
      },
    })({});
  };
}

export function createUpdateUserNameAction(deps: UsersActionDeps = {}) {
  const {
    currentUserResolver,
    usersRepoFactory = defaultUsersRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: UpdateUserNameInput): Promise<ActionResult<Profile>> => {
    return secureAction<UpdateUserNameInput, Profile>({
      roles: ["owner"],
      schema: updateUserNameSchema,
      currentUserResolver,
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        try {
          const userContext: UserContext = {
            id: ctx.user.id,
            role: ctx.user.role,
            active: ctx.user.isActive,
          };
          const auditRepo = await auditRepoFactory(userContext);
          await auditRepo.write({
            action: "users.update_name",
            entity: "profiles",
            entityId: validatedInput.id,
            summary: { fullName: validatedInput.fullName },
            reason: "Actualización de nombre por propietario",
          });
        } catch {
          // No romper la respuesta si falla el log
        }
      },
      handler: async (validatedInput, ctx) => {
        const userContext: UserContext = {
          id: ctx.user.id,
          role: ctx.user.role,
          active: ctx.user.isActive,
        };
        const usersRepo = await usersRepoFactory(userContext);
        const existing = await usersRepo.getProfile(validatedInput.id);
        if (!existing) {
          throw new Error("Usuario no encontrado.");
        }

        return await usersRepo.updateProfile(validatedInput.id, {
          full_name: validatedInput.fullName,
        });
      },
    })(input);
  };
}

export function createUpdateUserRoleAction(deps: UsersActionDeps = {}) {
  const {
    currentUserResolver,
    usersRepoFactory = defaultUsersRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: UpdateUserRoleInput): Promise<ActionResult<Profile>> => {
    return secureAction<UpdateUserRoleInput, Profile>({
      roles: ["owner"],
      schema: updateUserRoleSchema,
      currentUserResolver,
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        try {
          const userContext: UserContext = {
            id: ctx.user.id,
            role: ctx.user.role,
            active: ctx.user.isActive,
          };
          const auditRepo = await auditRepoFactory(userContext);
          await auditRepo.write({
            action: "users.update_role",
            entity: "profiles",
            entityId: validatedInput.id,
            summary: { newRole: validatedInput.role },
            reason: "Cambio de rol por propietario",
          });
        } catch {
          // No romper la respuesta si falla el log
        }
      },
      handler: async (validatedInput, ctx) => {
        const userContext: UserContext = {
          id: ctx.user.id,
          role: ctx.user.role,
          active: ctx.user.isActive,
        };
        const usersRepo = await usersRepoFactory(userContext);
        const existing = await usersRepo.getProfile(validatedInput.id);
        if (!existing) {
          throw new Error("Usuario no encontrado.");
        }

        // Si se va a degradar a cashier, verificar que queden otros propietarios activos
        const allProfiles = await usersRepo.listProfiles();
        const check = canDemoteOrDeactivateOwner(allProfiles, validatedInput.id, {
          newRole: validatedInput.role,
        });
        if (!check.allowed) {
          throw new ActionException(
            check.reason ?? "No se puede revocar el rol a este usuario.",
            "BAD_REQUEST",
          );
        }

        return await usersRepo.updateProfile(validatedInput.id, {
          role: validatedInput.role,
        });
      },
    })(input);
  };
}

export function createToggleUserActiveAction(deps: UsersActionDeps = {}) {
  const {
    currentUserResolver,
    usersRepoFactory = defaultUsersRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: ToggleUserActiveInput): Promise<ActionResult<Profile>> => {
    return secureAction<ToggleUserActiveInput, Profile>({
      roles: ["owner"],
      schema: toggleUserActiveSchema,
      currentUserResolver,
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        try {
          const userContext: UserContext = {
            id: ctx.user.id,
            role: ctx.user.role,
            active: ctx.user.isActive,
          };
          const auditRepo = await auditRepoFactory(userContext);
          await auditRepo.write({
            action: "users.toggle_active",
            entity: "profiles",
            entityId: validatedInput.id,
            summary: { active: validatedInput.active },
            reason: validatedInput.active
              ? "Activación de usuario por propietario"
              : "Desactivación de usuario por propietario",
          });
        } catch {
          // No romper la respuesta si falla el log
        }
      },
      handler: async (validatedInput, ctx) => {
        const userContext: UserContext = {
          id: ctx.user.id,
          role: ctx.user.role,
          active: ctx.user.isActive,
        };
        const usersRepo = await usersRepoFactory(userContext);
        const existing = await usersRepo.getProfile(validatedInput.id);
        if (!existing) {
          throw new Error("Usuario no encontrado.");
        }

        // Si se va a desactivar, verificar que no sea el único dueño activo
        const allProfiles = await usersRepo.listProfiles();
        const check = canDemoteOrDeactivateOwner(allProfiles, validatedInput.id, {
          newActive: validatedInput.active,
        });
        if (!check.allowed) {
          throw new ActionException(
            check.reason ?? "No se puede desactivar este usuario.",
            "BAD_REQUEST",
          );
        }

        return await usersRepo.updateProfile(validatedInput.id, {
          active: validatedInput.active,
        });
      },
    })(input);
  };
}
