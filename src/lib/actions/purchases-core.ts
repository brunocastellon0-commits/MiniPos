import { SupabaseAuditRepo } from "@/lib/repos/supabase/audit";
import { SupabaseProductsRepo } from "@/lib/repos/supabase/products";
import { SupabasePurchasesRepo } from "@/lib/repos/supabase/purchases";
import { SupabaseSuppliersRepo } from "@/lib/repos/supabase/suppliers";
import { SupabaseUsersRepo } from "@/lib/repos/supabase/users";
import type {
  AuditRepo,
  Product,
  ProductsRepo,
  Profile,
  Purchase,
  PurchaseItem,
  PurchasesRepo,
  Supplier,
  SuppliersRepo,
  UserContext,
  UsersRepo,
} from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  type AuthenticatedUser,
  ActionException,
  secureAction,
} from "./secure-action";
import {
  type CancelPurchaseInput,
  type CreatePurchaseInput,
  type GetPurchaseInput,
  type ListPurchasesInput,
  type PurchaseTimelineInput,
  type ReceivePurchaseInput,
  type RegisterPurchaseVisitInput,
  cancelPurchaseSchema,
  createPurchaseSchema,
  getPurchaseSchema,
  listPurchasesSchema,
  purchaseTimelineSchema,
  receivePurchaseSchema,
  registerPurchaseVisitSchema,
} from "./purchases-schema";

export interface PurchaseWithItems {
  purchase: Purchase;
  items: PurchaseItem[];
}

export interface PurchaseTimelineEntry {
  id: string;
  at: string;
  action: string;
  reason: string | null;
  userName: string | null;
}

export interface PurchasesActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  purchasesRepoFactory?: (user: UserContext) => Promise<PurchasesRepo>;
  suppliersRepoFactory?: (user: UserContext) => Promise<SuppliersRepo>;
  productsRepoFactory?: (user: UserContext) => Promise<ProductsRepo>;
  auditRepoFactory?: (user: UserContext) => Promise<AuditRepo>;
  usersRepoFactory?: (user: UserContext) => Promise<UsersRepo>;
}

async function defaultPurchasesRepoFactory(user: UserContext): Promise<PurchasesRepo> {
  const supabase = await createClient();
  return new SupabasePurchasesRepo(supabase, user);
}

async function defaultSuppliersRepoFactory(user: UserContext): Promise<SuppliersRepo> {
  const supabase = await createClient();
  return new SupabaseSuppliersRepo(supabase, user);
}

async function defaultProductsRepoFactory(user: UserContext): Promise<ProductsRepo> {
  const supabase = await createClient();
  return new SupabaseProductsRepo(supabase, user);
}

async function defaultAuditRepoFactory(user: UserContext): Promise<AuditRepo> {
  const supabase = await createClient();
  return new SupabaseAuditRepo(supabase, user);
}

async function defaultUsersRepoFactory(user: UserContext): Promise<UsersRepo> {
  const supabase = await createClient();
  return new SupabaseUsersRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

function translateRepoError(error: unknown, fallback: string): never {
  if (error instanceof ActionException) throw error;
  const message = error instanceof Error ? error.message : fallback;
  throw new ActionException(message, message.includes("no encontrado") ? "NOT_FOUND" : "BAD_REQUEST");
}

export function createCreatePurchaseAction(deps: PurchasesActionDeps = {}) {
  const {
    currentUserResolver,
    purchasesRepoFactory = defaultPurchasesRepoFactory,
    suppliersRepoFactory = defaultSuppliersRepoFactory,
    productsRepoFactory = defaultProductsRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: CreatePurchaseInput): Promise<ActionResult<PurchaseWithItems>> => {
    return secureAction<CreatePurchaseInput, PurchaseWithItems>({
      roles: ["owner"],
      schema: createPurchaseSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const suppliersRepo = await suppliersRepoFactory(userContext);
        const supplier: Supplier | null = await suppliersRepo.getById(validatedInput.supplierId);
        if (!supplier) {
          throw new ActionException("Proveedor no encontrado.", "NOT_FOUND");
        }
        if (!supplier.active) {
          throw new ActionException(
            "No se puede registrar una compra con un proveedor inactivo.",
            "BAD_REQUEST",
          );
        }

        const productsRepo = await productsRepoFactory(userContext);
        const uniqueIds = [...new Set(validatedInput.items.map((item) => item.productId))];
        const fetched = await productsRepo.getByIds(uniqueIds);
        const byId = new Map(fetched.map((product) => [product.id, product]));
        let totalCents = 0;
        for (const item of validatedInput.items) {
          const product: Product | null = byId.get(item.productId) ?? null;
          if (!product) {
            throw new ActionException("Producto no encontrado.", "NOT_FOUND");
          }
          if (!product.active) {
            throw new ActionException(
              `El producto "${product.name}" está inactivo.`,
              "BAD_REQUEST",
            );
          }
          totalCents += item.quantity * item.unitCostCents;
        }

        const purchasesRepo = await purchasesRepoFactory(userContext);
        try {
          return await purchasesRepo.createPurchase(
            {
              supplier_id: validatedInput.supplierId,
              status: "ordered",
              notes: validatedInput.notes ?? null,
              total_cents: totalCents,
            },
            validatedInput.items.map((item) => ({
              product_id: item.productId,
              qty_ordered: item.quantity,
              qty_received: 0,
              unit_cost_cents: item.unitCostCents,
            })),
          );
        } catch (error) {
          translateRepoError(error, "No se pudo registrar la compra.");
        }
      },
      audit: async (_validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        const auditRepo = await auditRepoFactory(toUserContext(ctx.user));
        await auditRepo.write({
          action: "purchases.create",
          entity: "purchase",
          entityId: result.data.purchase.id,
          summary: {
            total_cents: result.data.purchase.total_cents,
            supplier_id: result.data.purchase.supplier_id,
            items: result.data.items.length,
          },
        });
      },
    })(input);
  };
}

export function createListPurchasesAction(deps: PurchasesActionDeps = {}) {
  const { currentUserResolver, purchasesRepoFactory = defaultPurchasesRepoFactory } = deps;

  return async (input: ListPurchasesInput = {}): Promise<ActionResult<Purchase[]>> => {
    return secureAction<ListPurchasesInput, Purchase[]>({
      roles: ["owner"],
      schema: listPurchasesSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const repo = await purchasesRepoFactory(toUserContext(ctx.user));
        return repo.list({
          status: validatedInput.status,
          supplierId: validatedInput.supplierId,
        });
      },
    })(input);
  };
}

export function createGetPurchaseAction(deps: PurchasesActionDeps = {}) {
  const { currentUserResolver, purchasesRepoFactory = defaultPurchasesRepoFactory } = deps;

  return async (input: GetPurchaseInput): Promise<ActionResult<PurchaseWithItems>> => {
    return secureAction<GetPurchaseInput, PurchaseWithItems>({
      roles: ["owner"],
      schema: getPurchaseSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const repo = await purchasesRepoFactory(toUserContext(ctx.user));
        const result = await repo.getById(validatedInput.id);
        if (!result) {
          throw new ActionException("Compra no encontrada.", "NOT_FOUND");
        }
        return result;
      },
    })(input);
  };
}

export function createReceivePurchaseAction(deps: PurchasesActionDeps = {}) {
  const {
    currentUserResolver,
    purchasesRepoFactory = defaultPurchasesRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: ReceivePurchaseInput): Promise<ActionResult<PurchaseWithItems>> => {
    return secureAction<ReceivePurchaseInput, PurchaseWithItems>({
      roles: ["owner"],
      schema: receivePurchaseSchema,
      currentUserResolver,
      rateLimit: {
        keyPrefix: "purchases.receive",
        maxRequests: 30,
        windowMs: 60_000,
      },
      handler: async (validatedInput, ctx) => {
        const repo = await purchasesRepoFactory(toUserContext(ctx.user));
        const existing = await repo.getById(validatedInput.purchaseId);
        if (!existing) {
          throw new ActionException("Compra no encontrada.", "NOT_FOUND");
        }
        if (existing.purchase.status === "cancelled") {
          throw new ActionException(
            "La compra está cancelada: no se puede recibir.",
            "BAD_REQUEST",
          );
        }

        try {
          await repo.receivePurchase(
            validatedInput.purchaseId,
            validatedInput.items,
            validatedInput.updateCost ?? false,
          );
        } catch (error) {
          translateRepoError(error, "No se pudo registrar la recepción.");
        }

        const updated = await repo.getById(validatedInput.purchaseId);
        if (!updated) {
          throw new ActionException("Compra no encontrada.", "NOT_FOUND");
        }
        return updated;
      },
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        const auditRepo = await auditRepoFactory(toUserContext(ctx.user));
        await auditRepo.write({
          action: "purchases.receive",
          entity: "purchase",
          entityId: validatedInput.purchaseId,
          summary: {
            total_cents: result.data.purchase.total_cents,
            received_qty: validatedInput.items.reduce((sum, item) => sum + item.qtyReceived, 0),
            update_cost: validatedInput.updateCost ?? false,
          },
        });
      },
    })(input);
  };
}

export function createCancelPurchaseAction(deps: PurchasesActionDeps = {}) {
  const {
    currentUserResolver,
    purchasesRepoFactory = defaultPurchasesRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: CancelPurchaseInput): Promise<ActionResult<Purchase>> => {
    return secureAction<CancelPurchaseInput, Purchase>({
      roles: ["owner"],
      schema: cancelPurchaseSchema,
      currentUserResolver,
      rateLimit: {
        keyPrefix: "purchases.cancel",
        maxRequests: 20,
        windowMs: 60_000,
      },
      handler: async (validatedInput, ctx) => {
        const repo = await purchasesRepoFactory(toUserContext(ctx.user));
        const existing = await repo.getById(validatedInput.purchaseId);
        if (!existing) {
          throw new ActionException("Compra no encontrada.", "NOT_FOUND");
        }
        if (existing.purchase.status === "received") {
          throw new ActionException(
            "La compra ya fue recibida: no se puede cancelar. Registra una anulación de stock con motivo.",
            "BAD_REQUEST",
          );
        }
        if (existing.purchase.status === "cancelled") {
          throw new ActionException("La compra ya está cancelada.", "BAD_REQUEST");
        }

        try {
          await repo.updateStatus(validatedInput.purchaseId, "cancelled");
        } catch (error) {
          translateRepoError(error, "No se pudo cancelar la compra.");
        }

        const updated = await repo.getById(validatedInput.purchaseId);
        if (!updated) {
          throw new ActionException("Compra no encontrada.", "NOT_FOUND");
        }
        return updated.purchase;
      },
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        const auditRepo = await auditRepoFactory(toUserContext(ctx.user));
        await auditRepo.write({
          action: "purchases.cancel",
          entity: "purchase",
          entityId: validatedInput.purchaseId,
          reason: validatedInput.reason,
          summary: { total_cents: result.data.total_cents },
        });
      },
    })(input);
  };
}

export function createRegisterPurchaseVisitAction(deps: PurchasesActionDeps = {}) {
  const {
    currentUserResolver,
    purchasesRepoFactory = defaultPurchasesRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: RegisterPurchaseVisitInput): Promise<ActionResult<{ purchaseId: string }>> => {
    return secureAction<RegisterPurchaseVisitInput, { purchaseId: string }>({
      roles: ["owner"],
      schema: registerPurchaseVisitSchema,
      currentUserResolver,
      rateLimit: {
        keyPrefix: "purchases.visit",
        maxRequests: 30,
        windowMs: 60_000,
      },
      handler: async (validatedInput, ctx) => {
        const repo = await purchasesRepoFactory(toUserContext(ctx.user));
        const existing = await repo.getById(validatedInput.purchaseId);
        if (!existing) {
          throw new ActionException("Compra no encontrada.", "NOT_FOUND");
        }
        return { purchaseId: validatedInput.purchaseId };
      },
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        const auditRepo = await auditRepoFactory(toUserContext(ctx.user));
        await auditRepo.write({
          action: "purchases.visit",
          entity: "purchase",
          entityId: validatedInput.purchaseId,
          reason: validatedInput.notes?.trim() ? validatedInput.notes.trim() : "Visita de preventista",
        });
      },
    })(input);
  };
}

export function createGetPurchaseTimelineAction(deps: PurchasesActionDeps = {}) {
  const {
    currentUserResolver,
    auditRepoFactory = defaultAuditRepoFactory,
    usersRepoFactory = defaultUsersRepoFactory,
  } = deps;

  return async (input: PurchaseTimelineInput): Promise<ActionResult<PurchaseTimelineEntry[]>> => {
    return secureAction<PurchaseTimelineInput, PurchaseTimelineEntry[]>({
      roles: ["owner"],
      schema: purchaseTimelineSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const [auditRepo, usersRepo] = await Promise.all([
          auditRepoFactory(userContext),
          usersRepoFactory(userContext),
        ]);
        const [entries, profiles] = await Promise.all([
          auditRepo.list({ entity: "purchase", limit: 200 }),
          usersRepo.listProfiles().catch(() => [] as Profile[]),
        ]);
        const namesById = new Map(profiles.map((profile) => [profile.id, profile.full_name]));
        return entries
          .filter((entry) => entry.entity_id === validatedInput.purchaseId)
          .slice(0, 50)
          .map((entry) => ({
            id: entry.id,
            at: entry.at,
            action: entry.action,
            reason: entry.reason,
            userName: namesById.get(entry.user_id) ?? null,
          }));
      },
    })(input);
  };
}
