import { laPazDayBoundsIso, laPazDayKey, laPazHour, laPazWeekday } from "@/lib/dates";
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

// ---------------------------------------------------------------------------
// Fase F — reportes por modalidad (compartida, micromarket, restaurante)
// ---------------------------------------------------------------------------

export interface SaleFlowLike {
  status: string;
  payment_method: string;
  total_cents: number;
  created_at: string;
}

export interface HourlySaleRow {
  hour: number;
  transactionCount: number;
  totalCents: number;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Ventas cobradas agrupadas por hora local de La Paz (0-23). */
export function salesByHour(sales: readonly SaleFlowLike[]): HourlySaleRow[] {
  const rows: HourlySaleRow[] = HOURS.map((hour) => ({
    hour,
    transactionCount: 0,
    totalCents: 0,
  }));
  for (const sale of sales) {
    if (sale.status !== "paid") continue;
    const row = rows[laPazHour(new Date(sale.created_at))];
    if (!row) continue;
    row.transactionCount += 1;
    row.totalCents += sale.total_cents;
  }
  return rows;
}

export interface WeekdaySaleRow {
  weekday: number;
  label: string;
  transactionCount: number;
  totalCents: number;
}

export const WEEKDAY_LABELS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

/** Ventas cobradas agrupadas por día de la semana en La Paz (0 = lunes). */
export function salesByWeekday(sales: readonly SaleFlowLike[]): WeekdaySaleRow[] {
  const rows: WeekdaySaleRow[] = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    transactionCount: 0,
    totalCents: 0,
  }));
  for (const sale of sales) {
    if (sale.status !== "paid") continue;
    const row = rows[laPazWeekday(new Date(sale.created_at))];
    if (!row) continue;
    row.transactionCount += 1;
    row.totalCents += sale.total_cents;
  }
  return rows;
}

export interface CashMovementFlowLike {
  kind: "in" | "out";
  amount_cents: number;
  created_at: string;
}

export interface CashFlowRow {
  key: string;
  cashSalesCents: number;
  manualInCents: number;
  manualOutCents: number;
  inflowCents: number;
  outflowCents: number;
  netCents: number;
  availabilityCents: number;
}

/**
 * Flujo de caja del periodo: ventas en efectivo cobradas (por día de creación)
 * más movimientos manuales in/out. La disponibilidad es el acumulado del
 * periodo e ignora los saldos iniciales de los turnos (coherente con
 * expectedCashCents, que solo suma ventas pagadas y movimientos).
 */
export function buildCashFlowDaily(
  sales: readonly SaleFlowLike[],
  movements: readonly CashMovementFlowLike[],
  dayKeys: readonly string[],
): CashFlowRow[] {
  const cashSalesByDay = new Map<string, number>();
  for (const sale of sales) {
    if (sale.status !== "paid" || sale.payment_method !== "cash") continue;
    const dayKey = laPazDayKey(new Date(sale.created_at));
    cashSalesByDay.set(dayKey, (cashSalesByDay.get(dayKey) ?? 0) + sale.total_cents);
  }
  const manualByDay = new Map<string, { inCents: number; outCents: number }>();
  for (const movement of movements) {
    const dayKey = laPazDayKey(new Date(movement.created_at));
    const entry = manualByDay.get(dayKey) ?? { inCents: 0, outCents: 0 };
    if (movement.kind === "in") entry.inCents += movement.amount_cents;
    else entry.outCents += movement.amount_cents;
    manualByDay.set(dayKey, entry);
  }

  let availability = 0;
  return dayKeys.map((dayKey) => {
    const cashSalesCents = cashSalesByDay.get(dayKey) ?? 0;
    const manual = manualByDay.get(dayKey) ?? { inCents: 0, outCents: 0 };
    const inflowCents = cashSalesCents + manual.inCents;
    const outflowCents = manual.outCents;
    const netCents = inflowCents - outflowCents;
    availability += netCents;
    return {
      key: dayKey,
      cashSalesCents,
      manualInCents: manual.inCents,
      manualOutCents: manual.outCents,
      inflowCents,
      outflowCents,
      netCents,
      availabilityCents: availability,
    };
  });
}

/** Agrupa el flujo diario en meses ("YYYY-MM"), conservando el acumulado. */
export function buildCashFlowMonthly(daily: readonly CashFlowRow[]): CashFlowRow[] {
  const byMonth = new Map<string, CashFlowRow>();
  for (const row of daily) {
    const monthKey = row.key.slice(0, 7);
    const existing = byMonth.get(monthKey);
    if (!existing) {
      byMonth.set(monthKey, { ...row, key: monthKey });
      continue;
    }
    existing.cashSalesCents += row.cashSalesCents;
    existing.manualInCents += row.manualInCents;
    existing.manualOutCents += row.manualOutCents;
    existing.inflowCents += row.inflowCents;
    existing.outflowCents += row.outflowCents;
    existing.netCents += row.netCents;
    existing.availabilityCents = row.availabilityCents;
  }
  return Array.from(byMonth.values());
}

export interface WasteMovementLike {
  kind: string;
  delta: number;
  product_id: string;
  created_at: string;
}

export interface WasteRow {
  productId: string;
  name: string;
  units: number;
  valueCents: number | null;
}

/**
 * Mermas y desperdicios valorizados al costo actual registrado
 * (null cuando el producto no tiene costo).
 */
export function summarizeWaste(
  movements: readonly WasteMovementLike[],
  products: readonly { id: string; name: string; cost_cents: number | null }[],
): WasteRow[] {
  const costByName = new Map(products.map((product) => [product.id, product]));
  const unitsByProduct = new Map<string, number>();
  for (const movement of movements) {
    if (movement.kind !== "waste") continue;
    const units = Math.abs(movement.delta);
    if (units === 0) continue;
    unitsByProduct.set(movement.product_id, (unitsByProduct.get(movement.product_id) ?? 0) + units);
  }
  const rows: WasteRow[] = [];
  for (const [productId, units] of unitsByProduct) {
    const product = costByName.get(productId);
    const costCents = product?.cost_cents ?? null;
    rows.push({
      productId,
      name: product?.name ?? productId,
      units,
      valueCents: costCents === null ? null : costCents * units,
    });
  }
  return rows.sort((a, b) => b.units - a.units || a.name.localeCompare(b.name));
}

export interface TurnoverRow {
  productId: string;
  name: string;
  unitsSold: number;
  stockQty: number;
  stockValueCents: number | null;
}

/** Unidades vendidas en el periodo frente a las existencias actuales. */
export function inventoryTurnover(
  items: readonly SaleItemLike[],
  products: readonly { id: string; name: string; stock_qty: number; cost_cents: number | null }[],
): TurnoverRow[] {
  const unitsByProduct = new Map<string, number>();
  for (const item of items) {
    if (!item.product_id) continue;
    unitsByProduct.set(item.product_id, (unitsByProduct.get(item.product_id) ?? 0) + item.quantity);
  }
  const rows: TurnoverRow[] = [];
  for (const product of products) {
    const unitsSold = unitsByProduct.get(product.id) ?? 0;
    if (unitsSold === 0) continue;
    rows.push({
      productId: product.id,
      name: product.name,
      unitsSold,
      stockQty: product.stock_qty,
      stockValueCents: product.cost_cents === null ? null : product.cost_cents * product.stock_qty,
    });
  }
  return rows.sort(
    (a, b) => b.unitsSold - a.unitsSold || a.name.localeCompare(b.name),
  );
}

export interface StockMovementFlowLike {
  product_id: string;
  delta: number;
  created_at: string;
}

export interface StockZeroDayRow {
  productId: string;
  name: string;
  zeroDays: number;
}

/**
 * Días del periodo en que el stock de cada producto terminó en cero.
 * Reconstruye el stock de cada día desde el stock actual restando los
 * movimientos posteriores a ese día (los movimientos deben cubrir desde
 * el inicio del periodo hasta ahora).
 */
export function stockZeroDays(
  products: readonly { id: string; name: string; stock_qty: number }[],
  movements: readonly StockMovementFlowLike[],
  dayKeys: readonly string[],
): StockZeroDayRow[] {
  if (dayKeys.length === 0) return [];
  const byProduct = new Map<string, StockMovementFlowLike[]>();
  for (const movement of movements) {
    const list = byProduct.get(movement.product_id) ?? [];
    list.push(movement);
    byProduct.set(movement.product_id, list);
  }

  const endOfKey = (dayKey: string): number =>
    Date.parse(laPazDayBoundsIso(dayKey).end);

  const rows: StockZeroDayRow[] = [];
  for (const product of products) {
    const list = (byProduct.get(product.id) ?? []).slice().sort(
      (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    );
    let index = list.length - 1;
    let sumAfter = 0;
    let zeroDays = 0;
    for (let dayIndex = dayKeys.length - 1; dayIndex >= 0; dayIndex -= 1) {
      const dayKey = dayKeys[dayIndex];
      if (dayKey === undefined) continue;
      const end = endOfKey(dayKey);
      while (index >= 0) {
        const movement = list[index];
        if (!movement || Date.parse(movement.created_at) <= end) break;
        sumAfter += movement.delta;
        index -= 1;
      }
      if (product.stock_qty - sumAfter === 0) zeroDays += 1;
    }
    if (zeroDays > 0) {
      rows.push({ productId: product.id, name: product.name, zeroDays });
    }
  }
  return rows.sort((a, b) => b.zeroDays - a.zeroDays || a.name.localeCompare(b.name));
}

export type BcgQuadrant = "estrella" | "vaca" | "enigma" | "perro";

export interface BcgRow {
  productId: string;
  name: string;
  units: number;
  revenueCents: number;
  marginCents: number;
  quadrant: BcgQuadrant;
}

export interface BcgMatrix {
  rows: BcgRow[];
  uncostedCount: number;
}

const QUADRANT_ORDER: Record<BcgQuadrant, number> = {
  estrella: 0,
  vaca: 1,
  enigma: 2,
  perro: 3,
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const middleValue = sorted[middle];
  if (middleValue === undefined) return 0;
  if (sorted.length % 2 === 1) return middleValue;
  const previous = sorted[middle - 1] ?? 0;
  return (previous + middleValue) / 2;
}

/**
 * Matriz volumen × margen (mediana del periodo):
 * estrella = alto volumen y alto margen; vaca = bajo volumen y alto margen;
 * enigma = alto volumen y bajo margen; perro = bajo volumen y bajo margen.
 * Los productos sin costo registrado se excluyen (se reporta el conteo).
 */
export function buildBcgMatrix(
  items: readonly SaleItemLike[],
  products: readonly { id: string; name: string; cost_cents: number | null }[],
): BcgMatrix {
  const productById = new Map(products.map((product) => [product.id, product]));
  const aggregate = new Map<string, { units: number; revenueCents: number }>();
  for (const item of items) {
    if (!item.product_id) continue;
    const entry = aggregate.get(item.product_id) ?? { units: 0, revenueCents: 0 };
    entry.units += item.quantity;
    entry.revenueCents += item.line_total_cents;
    aggregate.set(item.product_id, entry);
  }

  let uncostedCount = 0;
  const costed: { productId: string; name: string; units: number; revenueCents: number; marginCents: number }[] = [];
  for (const [productId, entry] of aggregate) {
    const product = productById.get(productId);
    if (!product || product.cost_cents === null) {
      uncostedCount += 1;
      continue;
    }
    costed.push({
      productId,
      name: product.name,
      units: entry.units,
      revenueCents: entry.revenueCents,
      marginCents: entry.revenueCents - product.cost_cents * entry.units,
    });
  }
  if (costed.length === 0) return { rows: [], uncostedCount };

  const medianUnits = median(costed.map((row) => row.units));
  const medianMargin = median(costed.map((row) => row.marginCents));

  const rows: BcgRow[] = costed.map((row) => {
    const highVolume = row.units >= medianUnits;
    const highMargin = row.marginCents >= medianMargin;
    let quadrant: BcgQuadrant;
    if (highVolume && highMargin) quadrant = "estrella";
    else if (highVolume && !highMargin) quadrant = "enigma";
    else if (!highVolume && highMargin) quadrant = "vaca";
    else quadrant = "perro";
    return { ...row, quadrant };
  });

  rows.sort(
    (a, b) =>
      QUADRANT_ORDER[a.quadrant] - QUADRANT_ORDER[b.quadrant] ||
      b.marginCents - a.marginCents ||
      b.units - a.units,
  );
  return { rows, uncostedCount };
}
