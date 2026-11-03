import { formatDateShort, laPazDayKey, startOfLaPazDay } from "@/lib/dates";
import { formatBs } from "@/lib/money";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DashboardSale {
  status: "paid" | "voided";
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  created_at: string;
}

export interface DailySalesStats {
  grossCents: number;
  discountCents: number;
  totalCents: number;
  transactionCount: number;
  voidedCount: number;
  voidedCents: number;
  averageTicketCents: number | null;
}

export interface SalesComparison {
  current: DailySalesStats;
  previous: DailySalesStats | null;
  totalCentsChangePercent: number | null;
  transactionCountChangePercent: number | null;
}

function emptyStats(): DailySalesStats {
  return {
    grossCents: 0,
    discountCents: 0,
    totalCents: 0,
    transactionCount: 0,
    voidedCount: 0,
    voidedCents: 0,
    averageTicketCents: null,
  };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function summarizeSalesDay(sales: readonly DashboardSale[]): DailySalesStats {
  const stats = emptyStats();
  for (const sale of sales) {
    if (sale.status === "voided") {
      stats.voidedCount += 1;
      stats.voidedCents += sale.total_cents;
      continue;
    }
    stats.grossCents += sale.subtotal_cents;
    stats.discountCents += sale.discount_cents;
    stats.totalCents += sale.total_cents;
    stats.transactionCount += 1;
  }
  if (stats.transactionCount > 0) {
    stats.averageTicketCents = Math.round(stats.totalCents / stats.transactionCount);
  }
  return stats;
}

export function compareSalesDays(
  currentSales: readonly DashboardSale[],
  previousSales: readonly DashboardSale[],
): SalesComparison {
  const current = summarizeSalesDay(currentSales);
  const previousRaw = summarizeSalesDay(previousSales);
  const previous = previousRaw.transactionCount > 0 ? previousRaw : null;
  return {
    current,
    previous,
    totalCentsChangePercent:
      previous === null ? null : percentChange(current.totalCents, previous.totalCents),
    transactionCountChangePercent:
      previous === null ? null : percentChange(current.transactionCount, previous.transactionCount),
  };
}

export function summarizeSalesByDay(
  sales: readonly DashboardSale[],
  dayKeys: readonly string[],
): Record<string, DailySalesStats> {
  const result: Record<string, DailySalesStats> = {};
  for (const key of dayKeys) {
    result[key] = emptyStats();
  }
  for (const sale of sales) {
    const key = laPazDayKey(new Date(sale.created_at));
    const bucket = result[key];
    if (!bucket) continue;
    if (sale.status === "voided") {
      bucket.voidedCount += 1;
      bucket.voidedCents += sale.total_cents;
      continue;
    }
    bucket.grossCents += sale.subtotal_cents;
    bucket.discountCents += sale.discount_cents;
    bucket.totalCents += sale.total_cents;
    bucket.transactionCount += 1;
  }
  for (const key of dayKeys) {
    const stats = result[key];
    if (!stats) continue;
    if (stats.transactionCount > 0) {
      stats.averageTicketCents = Math.round(stats.totalCents / stats.transactionCount);
    }
  }
  return result;
}

export function lastDayKeys(referenceDate: Date, days: number): string[] {
  const end = startOfLaPazDay(referenceDate).getTime();
  const keys: string[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    keys.push(laPazDayKey(new Date(end - index * DAY_MS)));
  }
  return keys;
}

export type DashboardNotificationKind = "low_stock" | "cash_difference" | "stale_open_session";

export interface DashboardNotification {
  kind: DashboardNotificationKind;
  title: string;
  description: string;
  href: string;
}

export interface DashboardNotificationsInput {
  lowStockCount: number;
  openSessionOpenedAt?: string | null;
  lastClosedSession?: { closed_at?: string | null; difference_cents?: number | null } | null;
  now: Date;
}

export function buildDashboardNotifications(
  input: DashboardNotificationsInput,
): DashboardNotification[] {
  const notifications: DashboardNotification[] = [];

  if (input.lowStockCount > 0) {
    notifications.push({
      kind: "low_stock",
      title: "Stock bajo",
      description:
        input.lowStockCount === 1
          ? "1 producto requiere reposición"
          : `${input.lowStockCount} productos requieren reposición`,
      href: "/inventario",
    });
  }

  const difference = input.lastClosedSession?.difference_cents;
  if (difference != null && difference !== 0) {
    notifications.push({
      kind: "cash_difference",
      title: "Diferencia de caja",
      description: `La última caja cerrada quedó en ${formatBs(difference)}`,
      href: "/turno",
    });
  }

  const openedAt = input.openSessionOpenedAt;
  if (openedAt && laPazDayKey(new Date(openedAt)) < laPazDayKey(input.now)) {
    notifications.push({
      kind: "stale_open_session",
      title: "Caja abierta desde el día anterior",
      description: `Abierta el ${formatDateShort(new Date(openedAt))}`,
      href: "/caja",
    });
  }

  return notifications;
}
