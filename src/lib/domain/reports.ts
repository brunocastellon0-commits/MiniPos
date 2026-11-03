import { escapeCsvField } from "./products-csv";

const DAY_MS = 86_400_000;

export function dayKeysBetween(fromKey: string, toKey: string): string[] {
  const start = Date.parse(`${fromKey}T00:00:00.000Z`);
  const end = Date.parse(`${toKey}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return [];
  const keys: string[] = [];
  for (let t = start; t <= end; t += DAY_MS) {
    keys.push(new Date(t).toISOString().slice(0, 10));
  }
  return keys;
}

export function previousPeriodRange(
  dateFrom: string,
  dateTo: string,
): { dateFrom: string; dateTo: string } {
  const from = Date.parse(`${dateFrom}T00:00:00.000Z`);
  const to = Date.parse(`${dateTo}T00:00:00.000Z`);
  const span = to - from;
  const prevTo = from - DAY_MS;
  const prevFrom = prevTo - span;
  return {
    dateFrom: new Date(prevFrom).toISOString().slice(0, 10),
    dateTo: new Date(prevTo).toISOString().slice(0, 10),
  };
}

export interface SaleItemLike {
  product_id: string | null;
  name_snapshot: string;
  quantity: number;
  line_total_cents: number;
}

export interface ProductSalesAggregate {
  productId: string | null;
  name: string;
  units: number;
  totalCents: number;
}

export function topSellingProducts(
  items: readonly SaleItemLike[],
  limit: number,
): ProductSalesAggregate[] {
  const aggregates = aggregateItems(items);
  return aggregates
    .sort((a, b) => {
      if (b.units !== a.units) return b.units - a.units;
      if (b.totalCents !== a.totalCents) return b.totalCents - a.totalCents;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function leastSellingProducts(
  items: readonly SaleItemLike[],
  products: readonly { id: string; name: string }[],
  limit: number,
): ProductSalesAggregate[] {
  const aggregates = new Map<string, ProductSalesAggregate>();
  for (const product of products) {
    aggregates.set(product.id, {
      productId: product.id,
      name: product.name,
      units: 0,
      totalCents: 0,
    });
  }
  for (const aggregate of aggregateItems(items)) {
    const existing = aggregates.get(aggregate.productId ?? `name:${aggregate.name}`);
    if (existing) {
      existing.units += aggregate.units;
      existing.totalCents += aggregate.totalCents;
      continue;
    }
    aggregates.set(aggregate.productId ?? `name:${aggregate.name}`, aggregate);
  }
  return Array.from(aggregates.values())
    .sort((a, b) => {
      if (a.units !== b.units) return a.units - b.units;
      if (a.totalCents !== b.totalCents) return a.totalCents - b.totalCents;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

function aggregateItems(items: readonly SaleItemLike[]): ProductSalesAggregate[] {
  const aggregates = new Map<string, ProductSalesAggregate>();
  for (const item of items) {
    const key = item.product_id ?? `name:${item.name_snapshot}`;
    const existing = aggregates.get(key);
    if (existing) {
      existing.units += item.quantity;
      existing.totalCents += item.line_total_cents;
      continue;
    }
    aggregates.set(key, {
      productId: item.product_id,
      name: item.name_snapshot,
      units: item.quantity,
      totalCents: item.line_total_cents,
    });
  }
  return Array.from(aggregates.values());
}

export interface ProductLike {
  id: string;
  name: string;
  stock_qty: number;
  price_cents: number;
  cost_cents: number | null;
}

export interface InventoryValuation {
  retailValueCents: number;
  costValueCents: number;
  costedRetailValueCents: number;
  costedProductCount: number;
  uncostedProductCount: number;
  totalProductCount: number;
}

export function inventoryValuation(products: readonly ProductLike[]): InventoryValuation {
  const valuation: InventoryValuation = {
    retailValueCents: 0,
    costValueCents: 0,
    costedRetailValueCents: 0,
    costedProductCount: 0,
    uncostedProductCount: 0,
    totalProductCount: products.length,
  };
  for (const product of products) {
    valuation.retailValueCents += product.stock_qty * product.price_cents;
    if (product.cost_cents === null) {
      valuation.uncostedProductCount += 1;
      continue;
    }
    valuation.costedProductCount += 1;
    valuation.costValueCents += product.stock_qty * product.cost_cents;
    valuation.costedRetailValueCents += product.stock_qty * product.price_cents;
  }
  return valuation;
}

export type PurchaseStatus = "draft" | "ordered" | "partial" | "received" | "cancelled";

const PURCHASE_STATUSES: readonly PurchaseStatus[] = [
  "draft",
  "ordered",
  "partial",
  "received",
  "cancelled",
];

export interface ReportPurchase {
  status: PurchaseStatus;
  total_cents: number;
}

export interface PurchasesSummary {
  totalCount: number;
  totalCents: number;
  byStatus: { status: PurchaseStatus; count: number; totalCents: number }[];
}

export function summarizePurchases(purchases: readonly ReportPurchase[]): PurchasesSummary {
  const summary: PurchasesSummary = {
    totalCount: 0,
    totalCents: 0,
    byStatus: PURCHASE_STATUSES.map((status) => ({ status, count: 0, totalCents: 0 })),
  };
  const byStatus = new Map(summary.byStatus.map((row) => [row.status, row]));
  for (const purchase of purchases) {
    summary.totalCount += 1;
    summary.totalCents += purchase.total_cents;
    const row = byStatus.get(purchase.status);
    if (row) {
      row.count += 1;
      row.totalCents += purchase.total_cents;
    }
  }
  return summary;
}

export interface ReportCashSession {
  status: "open" | "closed";
  closed_at: string | null;
  difference_cents: number | null;
}

export interface CashSessionsSummary {
  closedCount: number;
  totalDifferenceCents: number;
  withDifferenceCount: number;
}

export function summarizeClosedCashSessions(
  sessions: readonly ReportCashSession[],
): CashSessionsSummary {
  const summary: CashSessionsSummary = {
    closedCount: 0,
    totalDifferenceCents: 0,
    withDifferenceCount: 0,
  };
  for (const session of sessions) {
    if (session.status !== "closed" || session.closed_at === null) continue;
    summary.closedCount += 1;
    if (session.difference_cents === null || session.difference_cents === 0) continue;
    summary.totalDifferenceCents += session.difference_cents;
    summary.withDifferenceCount += 1;
  }
  return summary;
}

export interface DailyReportRow {
  dayKey: string;
  transactionCount: number;
  grossCents: number;
  discountCents: number;
  collectedCents: number;
  voidedCount: number;
  voidedCents: number;
}

function centsToBsCsv(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function salesDailyReportCsv(rows: readonly DailyReportRow[]): string {
  const lines = [
    ["fecha", "transacciones", "bruto_bs", "descuento_bs", "cobrado_bs", "anuladas", "monto_anulado_bs"].join(","),
  ];
  for (const row of rows) {
    lines.push(
      [
        row.dayKey,
        String(row.transactionCount),
        centsToBsCsv(row.grossCents),
        centsToBsCsv(row.discountCents),
        centsToBsCsv(row.collectedCents),
        String(row.voidedCount),
        centsToBsCsv(row.voidedCents),
      ]
        .map(escapeCsvField)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
