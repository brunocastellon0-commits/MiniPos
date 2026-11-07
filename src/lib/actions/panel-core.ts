import { laPazDayBoundsIso } from "@/lib/dates";
import {
  estimateGrossMargin,
  summarizeDayMovements,
  type DayCashFlow,
  type GrossMarginEstimate,
} from "@/lib/domain/dashboard";
import { topSellingProducts, type ProductSalesAggregate } from "@/lib/domain/reports";
import { SupabaseCashRepo } from "@/lib/repos/supabase/cash";
import { SupabaseProductsRepo } from "@/lib/repos/supabase/products";
import { SupabaseSalesRepo } from "@/lib/repos/supabase/sales";
import type { CashRepo, ProductsRepo, SalesRepo, UserContext } from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  type ActionResult,
  type AuthenticatedUser,
  secureAction,
} from "./secure-action";

export interface PanelInsights {
  topProducts: ProductSalesAggregate[];
  margin: GrossMarginEstimate | null;
  cashDay: DayCashFlow;
}

export interface PanelInsightsInput {
  dayKey: string;
}

export const panelInsightsSchema = z
  .object({
    dayKey: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato AAAA-MM-DD.")
      .refine((value) => !Number.isNaN(Date.parse(value)), "Fecha inválida."),
  })
  .strict();

export interface PanelInsightsActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  salesRepoFactory?: (user: UserContext) => Promise<SalesRepo>;
  cashRepoFactory?: (user: UserContext) => Promise<CashRepo>;
  productsRepoFactory?: (user: UserContext) => Promise<ProductsRepo>;
}

async function defaultSalesRepoFactory(user: UserContext): Promise<SalesRepo> {
  const supabase = await createClient();
  return new SupabaseSalesRepo(supabase, user);
}

async function defaultCashRepoFactory(user: UserContext): Promise<CashRepo> {
  const supabase = await createClient();
  return new SupabaseCashRepo(supabase, user);
}

async function defaultProductsRepoFactory(user: UserContext): Promise<ProductsRepo> {
  const supabase = await createClient();
  return new SupabaseProductsRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

export function createGetPanelInsightsAction(deps: PanelInsightsActionDeps = {}) {
  const {
    currentUserResolver,
    salesRepoFactory = defaultSalesRepoFactory,
    cashRepoFactory = defaultCashRepoFactory,
    productsRepoFactory = defaultProductsRepoFactory,
  } = deps;

  return async (input: PanelInsightsInput): Promise<ActionResult<PanelInsights>> => {
    return secureAction<PanelInsightsInput, PanelInsights>({
      roles: ["owner"],
      schema: panelInsightsSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const [salesRepo, cashRepo, productsRepo] = await Promise.all([
          salesRepoFactory(userContext),
          cashRepoFactory(userContext),
          productsRepoFactory(userContext),
        ]);

        const bounds = laPazDayBoundsIso(validatedInput.dayKey);
        const startMs = Date.parse(bounds.start);
        const endMs = Date.parse(bounds.end);

        const sales = await salesRepo.list({
          dateFrom: bounds.start,
          dateTo: bounds.end,
          limit: 1000,
        });
        const paidSaleIds = sales
          .filter((sale) => sale.status === "paid")
          .map((sale) => sale.id);
        const items =
          paidSaleIds.length > 0 ? await salesRepo.listItemsForSales(paidSaleIds) : [];

        const topProducts = topSellingProducts(items, 5);

        const products = await productsRepo.list();
        const costByProductId = new Map<string, number>();
        for (const product of products) {
          if (typeof product.cost_cents === "number") {
            costByProductId.set(product.id, product.cost_cents);
          }
        }
        const margin = estimateGrossMargin(items, costByProductId);

        const sessions = await cashRepo.listSessions(100);
        const overlapping = sessions.filter((session) => {
          const openedMs = Date.parse(session.opened_at);
          const closedMs = session.closed_at ? Date.parse(session.closed_at) : Number.POSITIVE_INFINITY;
          return openedMs <= endMs && closedMs >= startMs;
        });
        const movementsPerSession = await Promise.all(
          overlapping.map((session) => cashRepo.listMovements(session.id)),
        );
        const cashDay = summarizeDayMovements(
          movementsPerSession.flat(),
          validatedInput.dayKey,
        );

        return { topProducts, margin, cashDay };
      },
    })(input);
  };
}
