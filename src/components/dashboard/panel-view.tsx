"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { formatTime } from "@/lib/dates";
import type { DailySalesStats, SalesComparison } from "@/lib/domain/dashboard";
import { formatBs } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

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

export interface PanelViewProps {
  userName: string;
  greetingDate: string;
  todayStats: DailySalesStats;
  comparison: SalesComparison;
  dayKeys: string[];
  series: Record<string, DailySalesStats>;
  cash: PanelCashState;
  lowStock: PanelLowStockProduct[];
  recentSales: PanelSaleSummary[];
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
  todayStats,
  comparison,
  dayKeys,
  series,
  cash,
  lowStock,
  recentSales,
  initialError = null,
}: PanelViewProps) {
  const router = useRouter();
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
          <p className="mt-1 text-sm text-foreground-muted">
            {greetingDate} · Resumen operativo y comercial.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Ventas de hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground" data-testid="today-sales">
              {formatBs(todayStats.totalCents)}
            </p>
            <p className="mt-2 text-sm text-foreground-muted">
              vs. mismo día de la semana pasada:{" "}
              <span className="font-semibold" data-testid="today-change">
                {formatChangePercent(comparison.totalCentsChangePercent)}
              </span>
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              {comparison.previous
                ? `Ese día: ${formatBs(comparison.previous.totalCents)}`
                : "Sin datos suficientes del día anterior"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground" data-testid="today-transactions">
              {todayStats.transactionCount}
            </p>
            <p className="mt-2 text-sm text-foreground-muted">
              Ticket promedio:{" "}
              <span className="font-semibold" data-testid="average-ticket">
                {todayStats.averageTicketCents === null
                  ? "—"
                  : formatBs(todayStats.averageTicketCents)}
              </span>
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              {todayStats.voidedCount > 0
                ? `${todayStats.voidedCount} venta(s) anulada(s) hoy`
                : "Sin ventas anuladas hoy"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de caja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cash.status === "open" ? (
              <>
                <Badge tone="success">Caja abierta</Badge>
                <p className="text-sm text-foreground-muted">
                  {cash.openedAt
                    ? `Desde las ${formatTime(new Date(cash.openedAt))}`
                    : "Turno en curso"}
                  {cash.openedByName ? ` · ${cash.openedByName}` : ""}
                </p>
              </>
            ) : cash.status === "closed" ? (
              <>
                <Badge tone="neutral">Caja cerrada</Badge>
                <p className="text-sm text-foreground-muted">
                  Última diferencia:{" "}
                  <span className="font-semibold" data-testid="cash-difference">
                    {cash.differenceCents === null || cash.differenceCents === undefined
                      ? "—"
                      : formatBs(cash.differenceCents)}
                  </span>
                </p>
                {cash.closedAt ? (
                  <p className="text-xs text-foreground-muted">
                    Cerrada el {formatTime(new Date(cash.closedAt))}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <Badge tone="neutral">Sin caja</Badge>
                <p className="text-sm text-foreground-muted">Aún no hay turnos registrados.</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock bajo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold text-foreground" data-testid="low-stock-count">
              {lowStock.length}
            </p>
            {lowStock.length > 0 ? (
              <ul className="space-y-1 text-sm text-foreground-muted">
                {lowStock.slice(0, 4).map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{product.name}</span>
                    <Badge tone="warning">
                      {product.stock_qty} / mín {product.min_stock}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">Sin productos en stock bajo.</p>
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
          <p className="mb-3 text-sm text-foreground-muted">
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
                    className="flex items-center justify-between gap-3 py-2 text-sm"
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
            <CardTitle>Accesos directos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" onClick={() => router.push("/caja")}>
              Abrir punto de venta
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/compras/nueva")}>
              Registrar compra
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push("/turno")}>
              Ver turno de caja
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
