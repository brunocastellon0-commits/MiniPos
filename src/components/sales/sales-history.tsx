"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, Td, Th } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableRow } from "@/components/ui/expandable-row";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getSaleDetailAction, listSalesAction } from "@/lib/actions/sales";
import type { ListSalesInput } from "@/lib/actions/sales-schema";
import { formatDateTime } from "@/lib/dates";
import { formatBs } from "@/lib/money";
import type { Sale, SaleItem } from "@/lib/repos/types";

const PAGE_SIZE = 100;
const SKELETON_ROWS = 5;

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  qr: "QR",
  card: "Tarjeta",
};

type MethodFilter = "" | "cash" | "qr" | "card";
type StatusFilter = "" | "paid" | "voided";

export interface SalesHistoryProps {
  initialSales: Sale[];
  initialCashierNames: Record<string, string>;
  initialHasMore: boolean;
  isOwner: boolean;
  initialError?: string | null;
}

export function SalesHistory({
  initialSales,
  initialCashierNames,
  initialHasMore,
  isOwner,
  initialError = null,
}: SalesHistoryProps) {
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [cashierNames, setCashierNames] = useState<Record<string, string>>(initialCashierNames);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [method, setMethod] = useState<MethodFilter>("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [cashierId, setCashierId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  // Cache en memoria para detalles desplegables por venta
  const [detailsById, setDetailsById] = useState<
    Record<string, { items: SaleItem[]; loading: boolean; error?: string }>
  >({});

  const hasFilters = Boolean(dateFrom || dateTo || method || status || cashierId);

  function currentPayload(limit?: number): ListSalesInput {
    const payload: ListSalesInput = {};
    if (limit) payload.limit = limit;
    if (dateFrom) payload.dateFrom = dateFrom;
    if (dateTo) payload.dateTo = dateTo;
    if (method) payload.paymentMethod = method;
    if (status) payload.status = status;
    if (isOwner && cashierId) payload.cashierId = cashierId;
    return payload;
  }

  async function runSearch(payload: ListSalesInput) {
    setLoading(true);
    setError(null);
    try {
      const result = await listSalesAction(payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSales(result.data.sales);
      setCashierNames(result.data.cashierNames);
      setHasMore(result.data.hasMore);
    } catch {
      setError("No se pudieron cargar las ventas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const result = await listSalesAction(currentPayload(Math.min(sales.length + PAGE_SIZE, 1000)));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSales(result.data.sales);
      setCashierNames(result.data.cashierNames);
      setHasMore(result.data.hasMore);
    } catch {
      setError("No se pudieron cargar más ventas.");
    } finally {
      setLoadingMore(false);
    }
  }

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    void runSearch(currentPayload());
  }

  function handleClear() {
    setDateFrom("");
    setDateTo("");
    setMethod("");
    setStatus("");
    setCashierId("");
    void runSearch({});
  }

  const handleRowToggle = async (saleId: string, expanded: boolean) => {
    if (!expanded) return;
    if (detailsById[saleId]?.items) return;

    setDetailsById((prev) => ({
      ...prev,
      [saleId]: { items: [], loading: true },
    }));

    try {
      const res = await getSaleDetailAction({ saleId });
      if (res.ok) {
        setDetailsById((prev) => ({
          ...prev,
          [saleId]: { items: res.data.items, loading: false },
        }));
      } else {
        setDetailsById((prev) => ({
          ...prev,
          [saleId]: { items: [], loading: false, error: res.message },
        }));
      }
    } catch {
      setDetailsById((prev) => ({
        ...prev,
        [saleId]: { items: [], loading: false, error: "Error al cargar ítems" },
      }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros compactos */}
      <form
        onSubmit={handleSearch}
        className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-surface p-3"
      >
        <DateRangeFilter
          startDate={dateFrom}
          endDate={dateTo}
          onStartDateChange={setDateFrom}
          onEndDateChange={setDateTo}
        />

        <div className="w-36">
          <Select
            value={method}
            onChange={(event) => setMethod(event.target.value as MethodFilter)}
            aria-label="Filtrar por método de pago"
            className="h-9 text-xs"
          >
            <option value="">Todos los métodos</option>
            <option value="cash">Efectivo</option>
            <option value="qr">QR</option>
            <option value="card">Tarjeta</option>
          </Select>
        </div>

        <div className="w-32">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            aria-label="Filtrar por estado"
            className="h-9 text-xs"
          >
            <option value="">Todos los estados</option>
            <option value="paid">Pagadas</option>
            <option value="voided">Anuladas</option>
          </Select>
        </div>

        {isOwner ? (
          <div className="w-36">
            <Select
              value={cashierId}
              onChange={(event) => setCashierId(event.target.value)}
              aria-label="Filtrar por cajero"
              className="h-9 text-xs"
            >
              <option value="">Todos los cajeros</option>
              {Object.entries(cashierNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 ml-auto">
          <Button type="submit" size="sm" className="h-9 text-xs" disabled={loading}>
            Buscar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={handleClear}
            disabled={loading}
          >
            Limpiar
          </Button>
        </div>
      </form>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      {!loading && sales.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Sin resultados" : "Sin ventas registradas"}
          description={
            hasFilters
              ? "Prueba con otros filtros o limpia la búsqueda."
              : "Cuando cobres tu primera venta aparecerá aquí."
          }
        />
      ) : (
        <>
          {loading ? (
            <span role="status" className="sr-only">
              Cargando ventas…
            </span>
          ) : null}
          <div
            className="overflow-x-auto rounded-card border border-border bg-surface"
            aria-busy={loading || undefined}
          >
            <Table className="min-w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="w-8 px-2 py-3" />
                  <Th scope="col">N.º</Th>
                  <Th scope="col">Fecha</Th>
                  <Th scope="col">Cajero</Th>
                  <Th scope="col">Método</Th>
                  <Th scope="col">Estado</Th>
                  <Th scope="col" className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading
                  ? Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
                      <tr key={`skeleton-${rowIndex}`}>
                        {Array.from({ length: 7 }, (_, cellIndex) => (
                          <Td key={cellIndex}>
                            <Skeleton className="h-4 w-full" />
                          </Td>
                        ))}
                      </tr>
                    ))
                  : sales.map((sale) => {
                      const detail = detailsById[sale.id];
                      return (
                        <ExpandableRow
                          key={sale.id}
                          colSpan={6}
                          onToggle={(expanded) => handleRowToggle(sale.id, expanded)}
                          summary={
                            <>
                              <Td className="whitespace-nowrap font-medium text-foreground">
                                #{sale.number}
                              </Td>
                              <Td className="whitespace-nowrap text-muted">
                                {formatDateTime(new Date(sale.created_at))}
                              </Td>
                              <Td className="whitespace-nowrap text-foreground">
                                {cashierNames[sale.cashier_id] ?? "—"}
                              </Td>
                              <Td className="whitespace-nowrap text-foreground">
                                {METHOD_LABELS[sale.payment_method] ?? sale.payment_method}
                              </Td>
                              <Td className="whitespace-nowrap">
                                <Badge tone={sale.status === "voided" ? "danger" : "success"}>
                                  {sale.status === "voided" ? "Anulada" : "Pagada"}
                                </Badge>
                              </Td>
                              <Td className="whitespace-nowrap text-right font-medium text-foreground tabular-nums">
                                {formatBs(sale.total_cents)}
                              </Td>
                            </>
                          }
                        >
                          <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                                Productos de la venta #{sale.number}
                              </h4>
                              <Link
                                href={`/ventas/${sale.id}`}
                                className="text-xs font-semibold text-primary hover:underline"
                              >
                                Ver página completa →
                              </Link>
                            </div>

                            {detail?.loading ? (
                              <div className="space-y-2 py-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                              </div>
                            ) : detail?.error ? (
                              <p className="text-xs text-danger">{detail.error}</p>
                            ) : detail?.items && detail.items.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                  <thead className="border-b border-border text-muted">
                                    <tr>
                                      <th className="py-1">Producto</th>
                                      <th className="py-1 text-center">Cantidad</th>
                                      <th className="py-1 text-right">Precio unitario</th>
                                      <th className="py-1 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/60">
                                    {detail.items.map((item) => (
                                      <tr key={item.id}>
                                        <td className="py-1.5 font-medium text-foreground">
                                          {item.name_snapshot}
                                        </td>
                                        <td className="py-1.5 text-center tabular-nums">
                                          {item.quantity}
                                        </td>
                                        <td className="py-1.5 text-right tabular-nums text-muted">
                                          {formatBs(item.unit_price_cents)}
                                        </td>
                                        <td className="py-1.5 text-right font-medium tabular-nums text-foreground">
                                          {formatBs(item.line_total_cents)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-muted">Sin líneas de producto.</p>
                            )}

                            {sale.discount_cents > 0 && (
                              <div className="flex justify-between border-t border-border pt-2 text-xs text-muted">
                                <span>Descuento aplicado:</span>
                                <span className="font-medium text-danger tabular-nums">
                                  -{formatBs(sale.discount_cents)}
                                </span>
                              </div>
                            )}
                          </div>
                        </ExpandableRow>
                      );
                    })}
              </tbody>
            </Table>
          </div>
          {hasMore && !loading ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                loading={loadingMore}
                onClick={() => void handleLoadMore()}
              >
                Cargar más
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
