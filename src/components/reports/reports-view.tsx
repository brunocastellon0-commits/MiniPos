"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { exportSalesReportCsvAction, getReportsDataAction } from "@/lib/actions/reports";
import type { ReportsData } from "@/lib/actions/reports-core";
import type { ReportsRangeInput } from "@/lib/actions/reports-schema";
import { formatDateShort } from "@/lib/dates";
import { percentChange } from "@/lib/domain/dashboard";
import { formatBs } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Tab = "ventas" | "productos" | "inventario" | "caja";

const TABS: { id: Tab; label: string }[] = [
  { id: "ventas", label: "Ventas" },
  { id: "productos", label: "Productos" },
  { id: "inventario", label: "Inventario" },
  { id: "caja", label: "Caja y compras" },
];

const PURCHASE_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  ordered: "En pedido",
  partial: "Parcial",
  received: "Recibida",
  cancelled: "Cancelada",
};

const percentFormatter = new Intl.NumberFormat("es-BO", {
  signDisplay: "always",
  maximumFractionDigits: 1,
});

function changeLabel(current: number, previous: number): string {
  const change = percentChange(current, previous);
  if (change === null) return "Sin periodo anterior comparable";
  return `${percentFormatter.format(change)}% vs. periodo anterior`;
}

function dayLabel(dayKey: string): string {
  return formatDateShort(new Date(`${dayKey}T12:00:00`));
}

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const TH = "border-b border-border bg-surface-muted/60 px-3 py-2 text-left text-xs uppercase tracking-wide text-muted";
const TD = "border-b border-border px-3 py-2 text-foreground";

export interface ReportsViewProps {
  initialRange: ReportsRangeInput;
  initialData: ReportsData | null;
  initialError?: string | null;
}

export function ReportsView({ initialRange, initialData, initialError = null }: ReportsViewProps) {
  const [tab, setTab] = useState<Tab>("ventas");
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);
  const [data, setData] = useState<ReportsData | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleLoad(event: React.FormEvent) {
    event.preventDefault();
    if (!dateFrom || !dateTo) {
      setError("Selecciona ambas fechas.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const range: ReportsRangeInput = { dateFrom, dateTo };
      const result = await getReportsDataAction(range);
      if (result.ok) {
        setData(result.data);
      } else {
        setError(result.message);
      }
    } catch {
      setError("No se pudieron cargar los reportes.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!dateFrom || !dateTo) {
      setError("Selecciona ambas fechas.");
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const result = await exportSalesReportCsvAction({ dateFrom, dateTo });
      if (result.ok) {
        downloadCsv(result.data.csv, result.data.filename);
      } else {
        setError(result.message);
      }
    } catch {
      setError("No se pudo exportar el reporte.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleLoad}
        className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center"
      >
        <Input
          type="date"
          value={dateFrom}
          aria-label="Fecha desde"
          onChange={(event) => setDateFrom(event.target.value)}
          className="h-10 w-auto"
        />
        <Input
          type="date"
          value={dateTo}
          aria-label="Fecha hasta"
          onChange={(event) => setDateTo(event.target.value)}
          className="h-10 w-auto"
        />
        <Button type="submit" variant="primary" loading={loading}>
          Actualizar
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={exporting}
          onClick={() => void handleExport()}
        >
          <Download aria-hidden className="size-4" />
          Exportar CSV
        </Button>
      </form>

      <div role="group" aria-label="Secciones del reporte" className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={tab === item.id ? "primary" : "secondary"}
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {error ? (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div aria-busy="true" className="space-y-4">
          <span role="status" className="sr-only">
            Cargando reportes…
          </span>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="space-y-2 rounded-card border border-border bg-surface p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
          <div className="space-y-3 rounded-card border border-border bg-surface p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        </div>
      ) : !data ? (
        <EmptyState title="Sin datos" description="Selecciona un periodo y pulsa «Actualizar»." />
      ) : (
        <>
          {tab === "ventas" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Cobrado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-foreground" data-testid="stat-collected">
                      {formatBs(data.stats.totalCents)}
                    </p>
                    <p className="text-xs text-muted" data-testid="stat-collected-change">
                      {changeLabel(data.stats.totalCents, data.previousStats.totalCents)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Ventas brutas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-foreground" data-testid="stat-gross">
                      {formatBs(data.stats.grossCents)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Descuentos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-foreground" data-testid="stat-discounts">
                      {formatBs(data.stats.discountCents)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Transacciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-foreground" data-testid="stat-transactions">
                      {data.stats.transactionCount}
                    </p>
                    <p className="text-xs text-muted">Ticket promedio:{" "}
                      {data.stats.averageTicketCents === null
                        ? "—"
                        : formatBs(data.stats.averageTicketCents)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Ventas anuladas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-foreground" data-testid="stat-voided">
                      {data.stats.voidedCount}
                    </p>
                    <p className="text-xs text-muted" data-testid="stat-voided-amount">
                      {formatBs(data.stats.voidedCents)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Ventas por día</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.stats.transactionCount === 0 && data.stats.voidedCount === 0 ? (
                    <EmptyState
                      title="Sin ventas en el periodo"
                      description="No hay ventas pagadas ni anuladas entre las fechas seleccionadas."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm" data-testid="daily-table">
                        <thead>
                          <tr>
                            <th scope="col" className={TH}>Fecha</th>
                            <th scope="col" className={TH}>Transacciones</th>
                            <th scope="col" className={TH}>Bruto</th>
                            <th scope="col" className={TH}>Descuento</th>
                            <th scope="col" className={TH}>Cobrado</th>
                            <th scope="col" className={TH}>Anuladas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.dailyRows.map((row) => (
                            <tr key={row.dayKey} data-testid="daily-row">
                              <td className={TD}>{dayLabel(row.dayKey)}</td>
                              <td className={TD}>{row.transactionCount}</td>
                              <td className={TD}>{formatBs(row.grossCents)}</td>
                              <td className={TD}>{formatBs(row.discountCents)}</td>
                              <td className={TD}>{formatBs(row.collectedCents)}</td>
                              <td className={TD}>
                                {row.voidedCount > 0
                                  ? `${row.voidedCount} (${formatBs(row.voidedCents)})`
                                  : "0"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-surface-muted/60 font-semibold">
                            <td className={TD}>Total</td>
                            <td className={TD}>{data.stats.transactionCount}</td>
                            <td className={TD}>{formatBs(data.stats.grossCents)}</td>
                            <td className={TD}>{formatBs(data.stats.discountCents)}</td>
                            <td className={TD}>{formatBs(data.stats.totalCents)}</td>
                            <td className={TD}>{data.stats.voidedCount}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {tab === "productos" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Productos más vendidos</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topProducts.length === 0 ? (
                    <EmptyState
                      title="Sin ventas de productos"
                      description="No hay productos vendidos en el periodo."
                    />
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr>
                          <th scope="col" className={TH}>Producto</th>
                          <th scope="col" className={TH}>Unidades</th>
                          <th scope="col" className={TH}>Cobrado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topProducts.map((row) => (
                          <tr key={`top-${row.productId ?? row.name}`} data-testid="top-product-row">
                            <td className={TD}>{row.name}</td>
                            <td className={TD}>{row.units}</td>
                            <td className={TD}>{formatBs(row.totalCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Productos menos vendidos</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.leastProducts.length === 0 ? (
                    <EmptyState
                      title="Sin productos"
                      description="No hay productos registrados."
                    />
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr>
                          <th scope="col" className={TH}>Producto</th>
                          <th scope="col" className={TH}>Unidades</th>
                          <th scope="col" className={TH}>Cobrado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.leastProducts.map((row) => (
                          <tr key={`least-${row.productId ?? row.name}`} data-testid="least-product-row">
                            <td className={TD}>{row.name}</td>
                            <td className={TD}>{row.units}</td>
                            <td className={TD}>{formatBs(row.totalCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {tab === "inventario" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Valor a costo</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-foreground" data-testid="value-cost">
                    {formatBs(data.inventoryValuation.costValueCents)}
                  </p>
                  <p className="text-xs text-muted">
                    Solo productos con costo registrado ({data.inventoryValuation.costedProductCount}{" "}
                    de {data.inventoryValuation.totalProductCount}).
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Valor a precio de venta</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-foreground" data-testid="value-retail">
                    {formatBs(data.inventoryValuation.retailValueCents)}
                  </p>
                  <p className="text-xs text-muted">
                    Existencias actuales al precio de venta.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Margen bruto estimado</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-foreground" data-testid="value-margin">
                    {formatBs(
                      data.inventoryValuation.costedRetailValueCents -
                        data.inventoryValuation.costValueCents,
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    Método: valor al precio de venta menos valor al costo, solo de los{" "}
                    {data.inventoryValuation.costedProductCount} productos con costo registrado. No
                    es ganancia neta.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {tab === "caja" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Compras por estado</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.purchasesSummary.totalCount === 0 ? (
                    <EmptyState
                      title="Sin compras en el periodo"
                      description="No se registraron compras entre las fechas seleccionadas."
                    />
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr>
                          <th scope="col" className={TH}>Estado</th>
                          <th scope="col" className={TH}>Cantidad</th>
                          <th scope="col" className={TH}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.purchasesSummary.byStatus.map((row) => (
                          <tr key={row.status} data-testid="purchase-status-row">
                            <td className={TD}>{PURCHASE_STATUS_LABELS[row.status]}</td>
                            <td className={TD}>{row.count}</td>
                            <td className={TD}>{formatBs(row.totalCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-surface-muted/60 font-semibold">
                          <td className={TD}>Total</td>
                          <td className={TD}>{data.purchasesSummary.totalCount}</td>
                          <td className={TD}>{formatBs(data.purchasesSummary.totalCents)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Cajas cerradas en el periodo</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.cashSummary.closedCount === 0 ? (
                    <EmptyState
                      title="Sin cierres de caja"
                      description="No se cerraron turnos entre las fechas seleccionadas."
                    />
                  ) : (
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted">Turnos cerrados</dt>
                        <dd className="font-medium text-foreground" data-testid="cash-closed-count">
                          {data.cashSummary.closedCount}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Con diferencia</dt>
                        <dd className="font-medium text-foreground" data-testid="cash-with-difference">
                          {data.cashSummary.withDifferenceCount}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Suma de diferencias</dt>
                        <dd className="font-medium text-foreground" data-testid="cash-difference-total">
                          {formatBs(data.cashSummary.totalDifferenceCents)}
                        </dd>
                      </div>
                    </dl>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
