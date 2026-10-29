import { z } from "zod";
import {
  canDeleteCategory,
  hasDuplicateCategoryName,
  nextCategorySortOrder,
  normalizeCategoryName,
} from "@/lib/domain/categories";
import { SupabaseAuditRepo } from "@/lib/repos/supabase/audit";
import { SupabaseCategoriesRepo } from "@/lib/repos/supabase/categories";
import { SupabaseProductsRepo } from "@/lib/repos/supabase/products";
import type {
  AuditRepo,
  CategoriesRepo,
  Category,
  ProductsRepo,
  UserContext,
} from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  ActionException,
  type ActionResult,
  type AuthenticatedUser,
  secureAction,
} from "./secure-action";
import {
  type CreateCategoryInput,
  createCategorySchema,
  type DeleteCategoryInput,
  deleteCategorySchema,
  type ReorderCategoriesInput,
  reorderCategoriesSchema,
  type UpdateCategoryInput,
  updateCategorySchema,
} from "./categories-schema";

export interface CategoriesActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  categoriesRepoFactory?: (user: UserContext) => Promise<CategoriesRepo>;
  productsRepoFactory?: (user: UserContext) => Promise<ProductsRepo>;
  auditRepoFactory?: (user: UserContext) => Promise<AuditRepo>;
}

async function defaultCategoriesRepoFactory(user: UserContext): Promise<CategoriesRepo> {
  const supabase = await createClient();
  return new SupabaseCategoriesRepo(supabase, user);
}

async function defaultProductsRepoFactory(user: UserContext): Promise<ProductsRepo> {
  const supabase = await createClient();
  return new SupabaseProductsRepo(supabase, user);
}

async function defaultAuditRepoFactory(user: UserContext): Promise<AuditRepo> {
  const supabase = await createClient();
  return new SupabaseAuditRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

const emptyInputSchema = z.object({}).strict().optional().default({});

export function createListCategoriesAction(deps: CategoriesActionDeps = {}) {
  const { currentUserResolver, categoriesRepoFactory = defaultCategoriesRepoFactory } = deps;

  return async (): Promise<ActionResult<Category[]>> => {
    return secureAction<Record<string, never>, Category[]>({
      roles: ["owner", "cashier"],
      schema: emptyInputSchema,
      currentUserResolver,
      handler: async (_input, ctx) => {
        const repo = await categoriesRepoFactory(toUserContext(ctx.user));
        return await repo.list();
      },
    })({});
  };
}

export function createCreateCategoryAction(deps: CategoriesActionDeps = {}) {
  const {
    currentUserResolver,
    categoriesRepoFactory = defaultCategoriesRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: CreateCategoryInput): Promise<ActionResult<Category>> => {
    return secureAction<CreateCategoryInput, Category>({
      roles: ["owner"],
      schema: createCategorySchema,
      currentUserResolver,
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        try {
          const auditRepo = await auditRepoFactory(toUserContext(ctx.user));
          await auditRepo.write({
            action: "categories.create",
            entity: "categories",
            entityId: result.data.id,
            summary: { name: result.data.name, sortOrder: result.data.sort_order },
            reason: "Alta de categoría por propietario",
          });
        } catch {
          // La auditoría no debe romper la operación
        }
      },
      handler: async (validatedInput, ctx) => {
        const repo = await categoriesRepoFactory(toUserContext(ctx.user));
        const existing = await repo.list();
        const name = normalizeCategoryName(validatedInput.name);

        if (hasDuplicateCategoryName(existing, name)) {
          throw new ActionException("Ya existe una categoría con ese nombre.", "BAD_REQUEST");
        }

        return await repo.create({
          name,
          sort_order: validatedInput.sortOrder ?? nextCategorySortOrder(existing),
          active: validatedInput.active ?? true,
        });
      },
    })(input);
  };
}

export function createUpdateCategoryAction(deps: CategoriesActionDeps = {}) {
  const {
    currentUserResolver,
    categoriesRepoFactory = defaultCategoriesRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: UpdateCategoryInput): Promise<ActionResult<Category>> => {
    return secureAction<UpdateCategoryInput, Category>({
      roles: ["owner"],
      schema: updateCategorySchema,
      currentUserResolver,
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        try {
          const auditRepo = await auditRepoFactory(toUserContext(ctx.user));
          await auditRepo.write({
            action: "categories.update",
            entity: "categories",
            entityId: result.data.id,
            summary: {
              name: result.data.name,
              sortOrder: result.data.sort_order,
              active: result.data.active,
              changed: Object.keys(validatedInput).filter((key) => key !== "id"),
            },
            reason: "Edición de categoría por propietario",
          });
        } catch {
          // La auditoría no debe romper la operación
        }
      },
      handler: async (validatedInput, ctx) => {
        const repo = await categoriesRepoFactory(toUserContext(ctx.user));
        const existing = await repo.getById(validatedInput.id);
        if (!existing) {
          throw new ActionException("Categoría no encontrada.", "NOT_FOUND");
        }

        const changes: {
          name?: string;
          sort_order?: number;
          active?: boolean;
        } = {};

        if (validatedInput.name !== undefined) {
          const name = normalizeCategoryName(validatedInput.name);
          const all = await repo.list();
          if (hasDuplicateCategoryName(all, name, existing.id)) {
            throw new ActionException("Ya existe una categoría con ese nombre.", "BAD_REQUEST");
          }
          changes.name = name;
        }

        if (validatedInput.sortOrder !== undefined) changes.sort_order = validatedInput.sortOrder;
        if (validatedInput.active !== undefined) changes.active = validatedInput.active;

        return await repo.update(existing.id, changes);
      },
    })(input);
  };
}

export function createReorderCategoriesAction(deps: CategoriesActionDeps = {}) {
  const {
    currentUserResolver,
    categoriesRepoFactory = defaultCategoriesRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: ReorderCategoriesInput): Promise<ActionResult<Category[]>> => {
    return secureAction<ReorderCategoriesInput, Category[]>({
      roles: ["owner"],
      schema: reorderCategoriesSchema,
      currentUserResolver,
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        try {
          const auditRepo = await auditRepoFactory(toUserContext(ctx.user));
          await auditRepo.write({
            action: "categories.reorder",
            entity: "categories",
            summary: { ids: validatedInput.ids },
            reason: "Cambio de orden de categorías",
          });
        } catch {
          // La auditoría no debe romper la operación
        }
      },
      handler: async (validatedInput, ctx) => {
        const repo = await categoriesRepoFactory(toUserContext(ctx.user));
        const current = await repo.list();

        const uniqueIds = new Set(validatedInput.ids);
        if (uniqueIds.size !== validatedInput.ids.length) {
          throw new ActionException(
            "La lista de categorías contiene identificadores repetidos.",
            "BAD_REQUEST",
          );
        }

        const currentIds = new Set(current.map((category) => category.id));
        const sameSet =
          currentIds.size === uniqueIds.size &&
          validatedInput.ids.every((id) => currentIds.has(id));
        if (!sameSet) {
          throw new ActionException(
            "La lista de categorías cambió. Recarga la página e intenta de nuevo.",
            "CONFLICT",
          );
        }

        return await repo.reorder(validatedInput.ids);
      },
    })(input);
  };
}

export function createDeleteCategoryAction(deps: CategoriesActionDeps = {}) {
  const {
    currentUserResolver,
    categoriesRepoFactory = defaultCategoriesRepoFactory,
    productsRepoFactory = defaultProductsRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: DeleteCategoryInput): Promise<ActionResult<{ id: string }>> => {
    return secureAction<DeleteCategoryInput, { id: string }>({
      roles: ["owner"],
      schema: deleteCategorySchema,
      currentUserResolver,
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        try {
          const auditRepo = await auditRepoFactory(toUserContext(ctx.user));
          await auditRepo.write({
            action: "categories.delete",
            entity: "categories",
            entityId: validatedInput.id,
            reason: "Eliminación de categoría sin productos",
          });
        } catch {
          // La auditoría no debe romper la operación
        }
      },
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const categoriesRepo = await categoriesRepoFactory(userContext);
        const productsRepo = await productsRepoFactory(userContext);

        const existing = await categoriesRepo.getById(validatedInput.id);
        if (!existing) {
          throw new ActionException("Categoría no encontrada.", "NOT_FOUND");
        }

        const assignedProducts = await productsRepo.list({ categoryId: validatedInput.id });
        const check = canDeleteCategory(assignedProducts.length);
        if (!check.allowed) {
          throw new ActionException(check.reason ?? "No se puede eliminar la categoría.", "CONFLICT");
        }

        await categoriesRepo.delete(validatedInput.id);
        return { id: validatedInput.id };
      },
    })(input);
  };
}
