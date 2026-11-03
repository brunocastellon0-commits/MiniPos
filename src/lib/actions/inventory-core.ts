import { z } from "zod";
import { SupabaseInventoryRepo } from "@/lib/repos/supabase/inventory";
import { SupabaseProductsRepo } from "@/lib/repos/supabase/products";
import type {
  InventoryRepo,
  Product,
  ProductsRepo,
  StockMovement,
  UserContext,
} from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  type AuthenticatedUser,
  secureAction,
} from "./secure-action";
import { type ListStockMovementsInput, listStockMovementsSchema } from "./inventory-schema";

export interface InventoryActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  productsRepoFactory?: (user: UserContext) => Promise<ProductsRepo>;
  inventoryRepoFactory?: (user: UserContext) => Promise<InventoryRepo>;
}

async function defaultProductsRepoFactory(user: UserContext): Promise<ProductsRepo> {
  const supabase = await createClient();
  return new SupabaseProductsRepo(supabase, user);
}

async function defaultInventoryRepoFactory(user: UserContext): Promise<InventoryRepo> {
  const supabase = await createClient();
  return new SupabaseInventoryRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

const emptyInputSchema = z.object({}).strict().optional().default({});

export function createListInventoryProductsAction(deps: InventoryActionDeps = {}) {
  const { currentUserResolver, productsRepoFactory = defaultProductsRepoFactory } = deps;

  return async (): Promise<ActionResult<Product[]>> => {
    return secureAction<Record<string, never>, Product[]>({
      roles: ["owner"],
      schema: emptyInputSchema,
      currentUserResolver,
      handler: async (_input, ctx) => {
        const productsRepo = await productsRepoFactory(toUserContext(ctx.user));
        return productsRepo.list();
      },
    })({});
  };
}

export function createListStockMovementsAction(deps: InventoryActionDeps = {}) {
  const { currentUserResolver, inventoryRepoFactory = defaultInventoryRepoFactory } = deps;

  return async (input: ListStockMovementsInput): Promise<ActionResult<StockMovement[]>> => {
    return secureAction<ListStockMovementsInput, StockMovement[]>({
      roles: ["owner"],
      schema: listStockMovementsSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const inventoryRepo = await inventoryRepoFactory(toUserContext(ctx.user));
        return inventoryRepo.listMovements({
          productId: validatedInput.productId,
          limit: validatedInput.limit,
        });
      },
    })(input);
  };
}
