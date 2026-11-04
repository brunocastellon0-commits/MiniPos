import { SupabaseProductsRepo } from "@/lib/repos/supabase/products";
import { SupabasePurchasesRepo } from "@/lib/repos/supabase/purchases";
import { SupabaseSuppliersRepo } from "@/lib/repos/supabase/suppliers";
import type {
  Product,
  ProductsRepo,
  Purchase,
  PurchaseItem,
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
  type CreatePurchaseInput,
  type GetPurchaseInput,
  type ListPurchasesInput,
  type ReceivePurchaseInput,
  createPurchaseSchema,
  getPurchaseSchema,
  listPurchasesSchema,
  receivePurchaseSchema,
} from "./purchases-schema";

export interface PurchaseWithItems {
  purchase: Purchase;
  items: PurchaseItem[];
}

export interface PurchasesActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  purchasesRepoFactory?: (user: UserContext) => Promise<PurchasesRepo>;
  suppliersRepoFactory?: (user: UserContext) => Promise<SuppliersRepo>;
  productsRepoFactory?: (user: UserContext) => Promise<ProductsRepo>;
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
  const { currentUserResolver, purchasesRepoFactory = defaultPurchasesRepoFactory } = deps;

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
    })(input);
  };
}
