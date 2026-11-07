import {
  lastDayKeys,
  summarizeSalesByDay,
  summarizeSalesDay,
  type DailySalesStats,
} from "@/lib/domain/dashboard";
import {
  dayKeysBetween,
  inventoryValuation,
  leastSellingProducts,
  previousPeriodRange,
  salesDailyReportCsv,
  summarizeClosedCashSessions,
  summarizePurchases,
  topSellingProducts,
  type CashSessionsSummary,
  type DailyReportRow,
  type InventoryValuation,
  type ProductSalesAggregate,
  type PurchasesSummary,
} from "@/lib/domain/reports";
import { laPazDayBoundsIso } from "@/lib/dates";
import { SupabaseCashRepo } from "@/lib/repos/supabase/cash";
import { SupabaseProductsRepo } from "@/lib/repos/supabase/products";
import { SupabasePurchasesRepo } from "@/lib/repos/supabase/purchases";
import { SupabaseSalesRepo } from "@/lib/repos/supabase/sales";
import type {
  CashRepo,
  ProductsRepo,
  PurchasesRepo,
  SalesRepo,
  UserContext,
} from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  type AuthenticatedUser,
  secureAction,
} from "./secure-action";
import { reportsRangeSchema, type ReportsRangeInput } from "./reports-schema";

export interface ReportsData {
  dateFrom: string;
  dateTo: string;
  previousDateFrom: string;
  previousDateTo: string;
  stats: DailySalesStats;
  previousStats: DailySalesStats;
  dailyRows: DailyReportRow[];
  topProducts: ProductSalesAggregate[];
  leastProducts: ProductSalesAggregate[];
  purchasesSummary: PurchasesSummary;
  cashSummary: CashSessionsSummary;
  inventoryValuation: InventoryValuation;
}

export interface SalesReportExport {
  csv: string;
  filename: string;
}

export interface ReportsActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  salesRepoFactory?: (user: UserContext) => Promise<SalesRepo>;
  purchasesRepoFactory?: (user: UserContext) => Promise<PurchasesRepo>;
  cashRepoFactory?: (user: UserContext) => Promise<CashRepo>;
  productsRepoFactory?: (user: UserContext) => Promise<ProductsRepo>;
}

async function defaultSalesRepoFactory(user: UserContext): Promise<SalesRepo> {
  const supabase = await createClient();
  return new SupabaseSalesRepo(supabase, user);
}

async function defaultPurchasesRepoFactory(user: UserContext): Promise<PurchasesRepo> {
  const supabase = await createClient();
  return new SupabasePurchasesRepo(supabase, user);
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

function resolveRangeFactories(deps: ReportsActionDeps) {
  return {
    salesRepoFactory: deps.salesRepoFactory ?? defaultSalesRepoFactory,
    purchasesRepoFactory: deps.purchasesRepoFactory ?? defaultPurchasesRepoFactory,
    cashRepoFactory: deps.cashRepoFactory ?? defaultCashRepoFactory,
    productsRepoFactory: deps.productsRepoFactory ?? defaultProductsRepoFactory,
  };
}

async function buildDailyRows(
  salesRepo: SalesRepo,
  range: ReportsRangeInput,
): Promise<{ dailyRows: DailyReportRow[]; sales: Awaited<ReturnType<SalesRepo["list"]>> }> {
  const bounds = laPazDayBoundsIso(range.dateFrom);
  const endBounds = laPazDayBoundsIso(range.dateTo);
  const sales = await salesRepo.list({
    dateFrom: bounds.start,
    dateTo: endBounds.end,
    limit: 1000,
  });
  const dayKeys = dayKeysBetween(range.dateFrom, range.dateTo);
  const series = summarizeSalesByDay(sales, dayKeys);
  const dailyRows: DailyReportRow[] = [];
  for (const dayKey of dayKeys) {
    const stats = series[dayKey];
    if (!stats) continue;
    dailyRows.push({
      dayKey,
      transactionCount: stats.transactionCount,
      grossCents: stats.grossCents,
      discountCents: stats.discountCents,
      collectedCents: stats.totalCents,
      voidedCount: stats.voidedCount,
      voidedCents: stats.voidedCents,
    });
  }
  return { dailyRows, sales };
}

async function buildReportsData(
  deps: ReportsActionDeps,
  user: AuthenticatedUser,
  range: ReportsRangeInput,
): Promise<ReportsData> {
  const factories = resolveRangeFactories(deps);
  const context = toUserContext(user);
  const [salesRepo, purchasesRepo, cashRepo, productsRepo] = await Promise.all([
    factories.salesRepoFactory(context),
    factories.purchasesRepoFactory(context),
    factories.cashRepoFactory(context),
    factories.productsRepoFactory(context),
  ]);

  const bounds = laPazDayBoundsIso(range.dateFrom);
  const endBounds = laPazDayBoundsIso(range.dateTo);
  const previousRange = previousPeriodRange(range.dateFrom, range.dateTo);
  const previousStart = laPazDayBoundsIso(previousRange.dateFrom);
  const previousEnd = laPazDayBoundsIso(previousRange.dateTo);

  const [sales, previousSales, purchases, sessions, products] = await Promise.all([
    salesRepo.list({ dateFrom: bounds.start, dateTo: endBounds.end, limit: 1000 }),
    salesRepo.list({
      dateFrom: previousStart.start,
      dateTo: previousEnd.end,
      limit: 1000,
    }),
    purchasesRepo.list(),
    cashRepo.listSessions(200),
    productsRepo.list(),
  ]);

  const items =
    sales.length > 0 ? await salesRepo.listItemsForSales(sales.map((sale) => sale.id)) : [];

  const fromMs = Date.parse(bounds.start);
  const toMs = Date.parse(endBounds.end);
  const inRange = (iso: string): boolean => {
    const time = Date.parse(iso);
    return !Number.isNaN(time) && time >= fromMs && time <= toMs;
  };

  const purchasesInRange = purchases.filter((purchase) => inRange(purchase.created_at));
  const sessionsInRange = sessions.filter(
    (session) => session.closed_at !== null && inRange(session.closed_at),
  );

  const { dailyRows } = await buildDailyRows(salesRepo, range);

  return {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    previousDateFrom: previousRange.dateFrom,
    previousDateTo: previousRange.dateTo,
    stats: summarizeSalesDay(sales),
    previousStats: summarizeSalesDay(previousSales),
    dailyRows,
    topProducts: topSellingProducts(items, 10),
    leastProducts: leastSellingProducts(
      items,
      products.map((product) => ({ id: product.id, name: product.name })),
      10,
    ),
    purchasesSummary: summarizePurchases(
      purchasesInRange.map((purchase) => ({
        status: purchase.status,
        total_cents: purchase.total_cents,
      })),
    ),
    cashSummary: summarizeClosedCashSessions(sessionsInRange),
    inventoryValuation: inventoryValuation(products),
  };
}

async function buildSalesReportExport(
  deps: ReportsActionDeps,
  user: AuthenticatedUser,
  range: ReportsRangeInput,
): Promise<SalesReportExport> {
  const factories = resolveRangeFactories(deps);
  const salesRepo = await factories.salesRepoFactory(toUserContext(user));
  const { dailyRows } = await buildDailyRows(salesRepo, range);
  return {
    csv: salesDailyReportCsv(dailyRows),
    filename: `ventas_${range.dateFrom}_${range.dateTo}.csv`,
  };
}

export function createGetReportsDataAction(deps: ReportsActionDeps = {}) {
  const { currentUserResolver } = deps;

  return async (input: ReportsRangeInput): Promise<ActionResult<ReportsData>> => {
    return secureAction<ReportsRangeInput, ReportsData>({
      roles: ["owner"],
      schema: reportsRangeSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => buildReportsData(deps, ctx.user, validatedInput),
    })(input);
  };
}

export function createExportSalesReportCsvAction(deps: ReportsActionDeps = {}) {
  const { currentUserResolver } = deps;

  return async (input: ReportsRangeInput): Promise<ActionResult<SalesReportExport>> => {
    return secureAction<ReportsRangeInput, SalesReportExport>({
      roles: ["owner"],
      schema: reportsRangeSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => buildSalesReportExport(deps, ctx.user, validatedInput),
    })(input);
  };
}
