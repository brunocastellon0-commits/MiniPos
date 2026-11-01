import { SupabaseSalesRepo } from "@/lib/repos/supabase/sales";
import type { HeldSale, SalesRepo, UserContext } from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  type AuthenticatedUser,
  secureAction,
} from "./secure-action";
import {
  type DeleteHeldSaleInput,
  deleteHeldSaleSchema,
  type SaveHeldSaleInput,
  saveHeldSaleSchema,
} from "./held-sales-schema";

export interface HeldSalesActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  salesRepoFactory?: (user: UserContext) => Promise<SalesRepo>;
}

async function defaultSalesRepoFactory(user: UserContext): Promise<SalesRepo> {
  const supabase = await createClient();
  return new SupabaseSalesRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

export function createListHeldSalesAction(deps: HeldSalesActionDeps = {}) {
  const { currentUserResolver, salesRepoFactory = defaultSalesRepoFactory } = deps;

  return async (): Promise<ActionResult<HeldSale[]>> => {
    return secureAction<Record<string, never>, HeldSale[]>({
      roles: ["owner", "cashier"],
      currentUserResolver,
      handler: async (_input, ctx) => {
        const repo = await salesRepoFactory(toUserContext(ctx.user));
        return repo.getHeldSales();
      },
    })({});
  };
}

export function createSaveHeldSaleAction(deps: HeldSalesActionDeps = {}) {
  const { currentUserResolver, salesRepoFactory = defaultSalesRepoFactory } = deps;

  return async (input: SaveHeldSaleInput): Promise<ActionResult<HeldSale>> => {
    return secureAction<SaveHeldSaleInput, HeldSale>({
      roles: ["owner", "cashier"],
      schema: saveHeldSaleSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const repo = await salesRepoFactory(toUserContext(ctx.user));
        return repo.saveHeldSale(validatedInput.label, validatedInput.cart.lines);
      },
    })(input);
  };
}

export function createDeleteHeldSaleAction(deps: HeldSalesActionDeps = {}) {
  const { currentUserResolver, salesRepoFactory = defaultSalesRepoFactory } = deps;

  return async (input: DeleteHeldSaleInput): Promise<ActionResult<{ id: string }>> => {
    return secureAction<DeleteHeldSaleInput, { id: string }>({
      roles: ["owner", "cashier"],
      schema: deleteHeldSaleSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const repo = await salesRepoFactory(toUserContext(ctx.user));
        await repo.deleteHeldSale(validatedInput.id);
        return { id: validatedInput.id };
      },
    })(input);
  };
}
