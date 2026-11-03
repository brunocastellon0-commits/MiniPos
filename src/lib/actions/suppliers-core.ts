import { z } from "zod";
import { SupabasePurchasesRepo } from "@/lib/repos/supabase/purchases";
import { SupabaseSuppliersRepo } from "@/lib/repos/supabase/suppliers";
import type {
  PurchasesRepo,
  Supplier,
  SuppliersRepo,
  UserContext,
} from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  type AuthenticatedUser,
  ActionException,
  secureAction,
} from "./secure-action";
import {
  type CreateSupplierInput,
  type DeleteSupplierInput,
  type ListSuppliersInput,
  type UpdateSupplierInput,
  createSupplierSchema,
  deleteSupplierSchema,
  listSuppliersSchema,
  updateSupplierSchema,
} from "./suppliers-schema";

export interface SuppliersActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  suppliersRepoFactory?: (user: UserContext) => Promise<SuppliersRepo>;
  purchasesRepoFactory?: (user: UserContext) => Promise<PurchasesRepo>;
}

async function defaultSuppliersRepoFactory(user: UserContext): Promise<SuppliersRepo> {
  const supabase = await createClient();
  return new SupabaseSuppliersRepo(supabase, user);
}

async function defaultPurchasesRepoFactory(user: UserContext): Promise<PurchasesRepo> {
  const supabase = await createClient();
  return new SupabasePurchasesRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

function translateRepoError(error: unknown, fallback: string): never {
  if (error instanceof ActionException) throw error;
  const message = error instanceof Error ? error.message : fallback;
  throw new ActionException(message, message.includes("no encontrado") ? "NOT_FOUND" : "BAD_REQUEST");
}

export function createListSuppliersAction(deps: SuppliersActionDeps = {}) {
  const { currentUserResolver, suppliersRepoFactory = defaultSuppliersRepoFactory } = deps;

  return async (input: ListSuppliersInput = {}): Promise<ActionResult<Supplier[]>> => {
    return secureAction<ListSuppliersInput, Supplier[]>({
      roles: ["owner"],
      schema: listSuppliersSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const repo = await suppliersRepoFactory(toUserContext(ctx.user));
        return repo.list({ activeOnly: validatedInput.activeOnly });
      },
    })(input);
  };
}

export function createCreateSupplierAction(deps: SuppliersActionDeps = {}) {
  const { currentUserResolver, suppliersRepoFactory = defaultSuppliersRepoFactory } = deps;

  return async (input: CreateSupplierInput): Promise<ActionResult<Supplier>> => {
    return secureAction<CreateSupplierInput, Supplier>({
      roles: ["owner"],
      schema: createSupplierSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const repo = await suppliersRepoFactory(toUserContext(ctx.user));
        try {
          return await repo.create({
            name: validatedInput.name,
            phone: validatedInput.phone ?? null,
            notes: validatedInput.notes ?? null,
            active: validatedInput.active ?? true,
          });
        } catch (error) {
          translateRepoError(error, "No se pudo crear el proveedor.");
        }
      },
    })(input);
  };
}

export function createUpdateSupplierAction(deps: SuppliersActionDeps = {}) {
  const { currentUserResolver, suppliersRepoFactory = defaultSuppliersRepoFactory } = deps;

  return async (input: UpdateSupplierInput): Promise<ActionResult<Supplier>> => {
    return secureAction<UpdateSupplierInput, Supplier>({
      roles: ["owner"],
      schema: updateSupplierSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const repo = await suppliersRepoFactory(toUserContext(ctx.user));
        const existing = await repo.getById(validatedInput.id);
        if (!existing) {
          throw new ActionException("Proveedor no encontrado.", "NOT_FOUND");
        }

        const changes: Record<string, unknown> = {};
        if (validatedInput.name !== undefined) changes.name = validatedInput.name;
        if (validatedInput.phone !== undefined) changes.phone = validatedInput.phone ?? null;
        if (validatedInput.notes !== undefined) changes.notes = validatedInput.notes ?? null;
        if (validatedInput.active !== undefined) changes.active = validatedInput.active;

        try {
          return await repo.update(validatedInput.id, changes);
        } catch (error) {
          translateRepoError(error, "No se pudo actualizar el proveedor.");
        }
      },
    })(input);
  };
}

export function createDeleteSupplierAction(deps: SuppliersActionDeps = {}) {
  const {
    currentUserResolver,
    suppliersRepoFactory = defaultSuppliersRepoFactory,
    purchasesRepoFactory = defaultPurchasesRepoFactory,
  } = deps;

  return async (input: DeleteSupplierInput): Promise<ActionResult<{ id: string }>> => {
    return secureAction<DeleteSupplierInput, { id: string }>({
      roles: ["owner"],
      schema: deleteSupplierSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const repo = await suppliersRepoFactory(userContext);
        const existing = await repo.getById(validatedInput.id);
        if (!existing) {
          throw new ActionException("Proveedor no encontrado.", "NOT_FOUND");
        }

        const purchasesRepo = await purchasesRepoFactory(userContext);
        const purchases = await purchasesRepo.list({ supplierId: validatedInput.id });
        if (purchases.length > 0) {
          throw new ActionException(
            "No se puede eliminar: el proveedor tiene compras registradas.",
            "CONFLICT",
          );
        }

        try {
          await repo.delete(validatedInput.id);
        } catch (error) {
          translateRepoError(error, "No se pudo eliminar el proveedor.");
        }
        return { id: validatedInput.id };
      },
    })(input);
  };
}
