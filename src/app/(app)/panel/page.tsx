import type { Metadata } from "next";
import { PanelView } from "@/components/dashboard/panel-view";
import { listCashSessionsAction } from "@/lib/actions/cash";
import { listInventoryProductsAction } from "@/lib/actions/inventory";
import { getPanelInsightsAction } from "@/lib/actions/panel";
import { listSalesAction } from "@/lib/actions/sales";
import { requireRole } from "@/lib/auth";
import { formatDateLong, laPazDayKey } from "@/lib/dates";
import { buildPanelComparison, lastDayKeys, summarizeSalesByDay } from "@/lib/domain/dashboard";
import { isLowStock } from "@/lib/domain/inventory";
import type { CashSessionWithOpener, Product, Sale } from "@/lib/repos/types";

export const metadata: Metadata = {
  title: "Panel del Dueño",
  description: "Resumen operativo y comercial del minimarket.",
};

const SERIES_DAYS = 30;
const PREVIOUS_WEEK_OFFSET = 7;

export default async function PanelPage() {
  const user = await requireRole("owner", "/caja");

  const now = new Date();
  const todayKey = laPazDayKey(now);
  const dayKeys = lastDayKeys(now, SERIES_DAYS);
  const yesterdayKey = dayKeys[dayKeys.length - 2] ?? todayKey;
  const previousWeekKey = dayKeys[dayKeys.length - 1 - PREVIOUS_WEEK_OFFSET];

  let sales: Sale[] = [];
  let sessions: CashSessionWithOpener[] = [];
  let products: Product[] = [];
  let initialError: string | null = null;
  let topProducts: Array<{ productId: string | null; name: string; units: number; totalCents: number }> = [];
  let margin: { marginCents: number; revenueCents: number; costCents: number } | null = null;
  let dayCash: { incomeCents: number; expenseCents: number } | null = null;

  try {
    const [salesResult, sessionsResult, productsResult, insightsResult] = await Promise.all([
      listSalesAction({ dateFrom: dayKeys[0], dateTo: todayKey, limit: 1000 }),
      listCashSessionsAction({ limit: 20 }),
      listInventoryProductsAction(),
      getPanelInsightsAction({ dayKey: todayKey }),
    ]);

    if (salesResult.ok) {
      sales = salesResult.data.sales;
    } else {
      initialError = salesResult.message;
    }
    if (sessionsResult.ok) {
      sessions = sessionsResult.data;
    } else {
      initialError = initialError ?? sessionsResult.message;
    }
    if (productsResult.ok) {
      products = productsResult.data;
    } else {
      initialError = initialError ?? productsResult.message;
    }
    if (insightsResult.ok) {
      topProducts = insightsResult.data.topProducts;
      margin = insightsResult.data.margin;
      dayCash = insightsResult.data.cashDay;
    } else {
      initialError = initialError ?? insightsResult.message;
    }
  } catch {
    initialError = "No se pudo cargar el panel.";
  }

  const saleDayKey = (sale: Sale): string => laPazDayKey(new Date(sale.created_at));
  const todaySales = sales.filter((sale) => saleDayKey(sale) === todayKey);
  const yesterdaySales = sales.filter((sale) => saleDayKey(sale) === yesterdayKey);
  const previousSales = sales.filter((sale) => saleDayKey(sale) === previousWeekKey);
  const comparison = buildPanelComparison(todaySales, yesterdaySales, previousSales);
  const series = summarizeSalesByDay(sales, dayKeys);

  const openSession = sessions.find((session) => session.status === "open");
  const lastClosed = sessions.find((session) => session.status === "closed");
  const openSessionName = openSession?.opened_by_name ?? null;
  const cash = openSession
    ? {
        status: "open" as const,
        openedAt: openSession.opened_at,
        openedByName: openSessionName,
      }
    : lastClosed
      ? {
          status: "closed" as const,
          closedAt: lastClosed.closed_at,
          differenceCents: lastClosed.difference_cents,
        }
      : { status: "none" as const };

  const lowStock = products
    .filter((product) => product.active && isLowStock(product))
    .sort((a, b) => a.stock_qty - b.stock_qty)
    .slice(0, 5)
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock_qty: product.stock_qty,
      min_stock: product.min_stock,
    }));

  const recentSales = todaySales.slice(0, 6).map((sale) => ({
    id: sale.id,
    created_at: sale.created_at,
    total_cents: sale.total_cents,
    payment_method: sale.payment_method,
  }));

  return (
    <PanelView
      userName={user.name}
      greetingDate={formatDateLong(now)}
      comparison={comparison}
      dayKeys={dayKeys}
      series={series}
      cash={cash}
      lowStock={lowStock}
      recentSales={recentSales}
      topProducts={topProducts}
      margin={margin}
      dayCash={dayCash}
      initialError={initialError}
    />
  );
}
