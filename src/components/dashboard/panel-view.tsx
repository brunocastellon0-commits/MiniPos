"use client";

import Link from "next/link";
import { useState } from "react";
import { formatTime } from "@/lib/dates";
import type { DailySalesStats, PanelComparison } from "@/lib/domain/dashboard";
import { formatBs } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";

const METHOD_LABELS: Record<string, string> = { cash: "Efectivo", qr: "QR", card: "Tarjeta" };

const RANGES = [7, 14, 30] as const;

export interface PanelSaleSummary {
  id: string;
  created_at: string;
  total_cents: number;
  payment_method: "cash" | "qr" | "card";
}

export interface PanelLowStockProduct {
  id: string;
  name: string;
  stock_qty: number;
  min_stock: number;
}

export interface PanelCashState {
  status: "open" | "closed" | "none";
  openedAt?: string | null;
  openedByName?: string | null;
  closedAt?: string | null;
  differenceCents?: number | null;
}

export interface PanelTopProduct {
  productId: string | null;
  name: string;
  units: number;
  totalCents: number;
}

export interface PanelMargin {
  marginCents: number;
  revenueCents: number;
  costCents: number;
}

export interface PanelDayCash {
  incomeCents: number;
  expenseCents: number;
}

export interface PanelViewProps {
  userName: string;
  greetingDate: string;
  comparison: PanelComparison;
  dayKeys: string[];
  series: Record<string, DailySalesStats>;
  cash: PanelCashState;
  lowStock: PanelLowStockProduct[];
  recentSales: PanelSaleSummary[];
  topProducts: PanelTopProduct[];
  margin: PanelMargin | null;
  dayCash: PanelDayCash | null;
  initialError?: string | null;
}

function formatChangePercent(value: number | null): string {
  if (value === null) return "—";
  const magnitude = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 1 }).format(
    Math.abs(value),
  );
  if (value > 0) return `+${magnitude}%`;
  if (value < 0) return `-${magnitude}%`;
  return `${magnitude}%`;
}

export function PanelView({
  userName,
  greetingDate,
  comparison,
  dayKeys,
  series,
  cash,
  lowStock,
  recentSales,
  topProducts,
  margin,
  dayCash,
  initialError = null,
}: PanelViewProps) {
  const [range, setRange] = useState<number>(7);

  const visibleKeys = dayKeys.slice(-range);
  const windowTotals = visibleKeys.map((key) => series[key]?.totalCents ?? 0);
  const maxTotal = Math.max(...windowTotals, 1);
  const windowTotalCents = windowTotals.reduce((sum, value) => sum + value, 0);
  const windowTransactions = visibleKeys.reduce(
    (sum, key) => sum + (series[key]?.transactionCount ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      {initialError ? (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {initialError}
        </div>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Hola, {userName}</h1>
          <p className="mt-1 text-base text-foreground-muted">
            {greetingDate} · Resumen operativo y comercial.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="metric" className="border-l-2 border-primary">
          <CardHeader>
            <CardTitle>Comparativa de ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-foreground" data-testid="today-sales">
              {formatBs(comparison.today.totalCents)}
            </p>
            <p className="mt-2 text-base text-foreground-muted">
              vs. ayer:{" "}
              <span className="font-semibold" data-testid="today-change-yesterday">
                {formatChangePercent(comparison.vsYesterdayPercent)}
              </span>
              {" · "}
              Ayer:{" "}
              <span className="font-semibold" data-testid="yesterday-sales">
                {comparison.yesterday ? formatBs(comparison.yesterday.totalCents) : "—"}
              </span>
            </p>
            <p className="mt-1 text-base text-foreground-muted">
              vs. mismo día de la semana pasada:{" "}
              <span className="font-semibold" data-testid="today-change">
                {formatChangePercent(comparison.vsWeekAgoPercent)}
              </span>
            </p>
            <p className="mt-1 text-sm text-foreground-muted">
              {comparison.weekAgo
                ? `Ese día: ${formatBs(comparison.weekAgo.totalCents)}`
                : "Sin datos suficientes del día anterior"}
            </p>
          </CardContent>
        </Card>

        <Card variant="metric">
          <CardHeader>
            <CardTitle>Transacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-foreground" data-testid="today-transactions">
              {comparison.today.transactionCount}
            </p>
            <p className="mt-2 text-base text-foreground-muted">
              Ticket promedio:{" "}
              <span className="font-semibold" data-testid="average-ticket">
                {comparison.today.averageTicketCents === null
                  ? "—"
                  : formatBs(comparison.today.averageTicketCents)}
              </span>
            </p>
            <p className="mt-1 text-sm text-foreground-muted">
              {comparison.today.voidedCount > 0
                ? `${comparison.today.voidedCount} venta(s) anulada(s) hoy`
                : "Sin ventas anuladas hoy"}
            </p>
          </CardContent>
        </Card>

        <Card variant="metric">
          <CardHeader>
            <CardTitle>Estado de caja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cash.status === "open" ? (
              <>
                <Badge tone="success">Caja abierta</Badge>
                <p className="text-base text-foreground-muted">
                  {cash.openedAt
                    ? `Desde las ${formatTime(new Date(cash.openedAt))}`
                    : "Turno en curso"}
                  {cash.openedByName ? ` · ${cash.openedByName}` : ""}
                </p>
              </>
            ) : cash.status === "closed" ? (
              <>
                <Badge tone="neutral">Caja cerrada</Badge>
                <p className="text-base text-foreground-muted">
                  Última diferencia:{" "}
                  <span className="font-semibold" data-testid="cash-difference">
                    {cash.differenceCents === null || cash.differenceCents === undefined
                      ? "—"
                      : formatBs(cash.differenceCents)}
                  </span>
                </p>
                {cash.closedAt ? (
                  <p className="text-sm text-foreground-muted">
                    Cerrada el {formatTime(new Date(cash.closedAt))}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <Badge tone="neutral">Sin caja</Badge>
                <p className="text-base text-foreground-muted">Aún no hay turnos registrados.</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card variant="metric">
          <CardHeader>
            <CardTitle>Stock bajo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold text-foreground" data-testid="low-stock-count">
              {lowStock.length}
            </p>
            {lowStock.length > 0 ? (
              <ul className="space-y-2 text-base text-foreground-muted">
                {lowStock.slice(0, 4).map((product) => (
                  <li key={product.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{product.name}</span>
                      <Badge tone="warning">
                        {product.stock_qty} / mín {product.min_stock}
                      </Badge>
                    </div>
                    <ProgressBar
                      value={product.stock_qty}
                      max={product.min_stock}
                      label={`Existencias de ${product.name}: ${product.stock_qty} de mínimo ${product.min_stock}`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-foreground-muted">Sin productos en stock bajo.</p>
            )}
            <Link
              href="/inventario"
              className="inline-block text-sm text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver inventario
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Evolución de ventas</CardTitle>
          <div role="group" aria-label="Rango del gráfico" className="flex gap-1">
            {RANGES.map((days) => (
              <Button
                key={days}
                type="button"
                variant={range === days ? "primary" : "ghost"}
                aria-pressed={range === days}
                onClick={() => setRange(days)}
              >
                {days} días
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-base text-foreground-muted">
            Total últimos {range} días:{" "}
            <span className="font-semibold" data-testid="window-total">
              {formatBs(windowTotalCents)}
            </span>{" "}
            · <span data-testid="window-transactions">{windowTransactions}</span> transacciones
          </p>
          <div
            role="img"
            aria-label={`Evolución de ventas de los últimos ${range} días: ${formatBs(windowTotalCents)} en ${windowTransactions} transacciones`}
            className="flex h-44 items-end gap-1.5"
          >
            {visibleKeys.map((key, index) => {
              const totalCents = windowTotals[index] ?? 0;
              const heightPercent = totalCents > 0 ? Math.max((totalCents / maxTotal) * 100, 4) : 0;
              return (
                <div
                  key={key}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                >
                  <div
                    aria-hidden="true"
                    title={`${key}: ${formatBs(totalCents)}`}
                    className="w-full rounded-t-sm bg-primary/75"
                    style={{ height: `${heightPercent}%` }}
                  />
                  <span className="text-[10px] leading-none text-foreground-muted">
                    {key.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentSales.map((sale) => (
                  <li
                    key={sale.id}
                    className="flex items-center justify-between gap-3 py-2 text-base"
                  >
                    <span className="text-foreground-muted">
                      {formatTime(new Date(sale.created_at))}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatBs(sale.total_cents)}
                    </span>
                    <Badge tone="neutral">{METHOD_LABELS[sale.payment_method]}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Aún no hay ventas hoy"
                description="Las ventas confirmadas de hoy aparecerán aquí."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top productos vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <ul className="space-y-3">
                {topProducts.map((product, index) => (
                  <li
                    key={`${product.productId ?? "sin-id"}-${index}`}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between gap-3 text-base">
                      <span className="truncate font-medium text-foreground">
                        {product.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-foreground-muted">
                        {product.units} u. · {formatBs(product.totalCents)}
                      </span>
                    </div>
                    <ProgressBar
                      value={product.totalCents}
                      max={topProducts[0]?.totalCents || 1}
                      label={`Ventas de ${product.name}: ${product.units} unidades, ${formatBs(product.totalCents)}`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Sin ventas hoy"
                description="Los productos más vendidos aparecerán aquí."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={margin ? undefined : "lg:col-span-2"}>
          <CardHeader>
            <CardTitle>Ingresos y egresos de hoy</CardTitle>
          </CardHeader>
          <CardContent>
            {dayCash ? (
              <>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-base text-foreground-muted">Ingresos</dt>
                    <dd
                      className="mt-1 text-2xl font-bold tabular-nums text-foreground"
                      data-testid="day-income"
                    >
                      {formatBs(dayCash.incomeCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-base text-foreground-muted">Egresos</dt>
                    <dd
                      className="mt-1 text-2xl font-bold tabular-nums text-foreground"
                      data-testid="day-expense"
                    >
                      {formatBs(dayCash.expenseCents)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm text-foreground-muted">
                  Movimientos manuales en efectivo de los turnos de hoy; las ventas no
                  aparecen aquí.
                </p>
              </>
            ) : (
              <EmptyState
                title="Sin movimientos hoy"
                description="Los ingresos y egresos de efectivo aparecerán aquí."
              />
            )}
          </CardContent>
        </Card>

        {margin ? (
          <Card>
            <CardHeader>
              <CardTitle>Margen bruto estimado</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className="text-3xl font-bold tabular-nums text-foreground"
                data-testid="gross-margin"
              >
                {formatBs(margin.marginCents)}
              </p>
              <p className="mt-2 text-base text-foreground-muted">
                Ventas: {formatBs(margin.revenueCents)} · Costo: {formatBs(margin.costCents)}
              </p>
              <p className="mt-2 text-sm text-foreground-muted">
                Estimado con el costo registrado actualmente para los productos vendidos
                hoy, sobre el precio de línea antes de descuentos de venta. No incluye
                mermas ni gastos operativos.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
