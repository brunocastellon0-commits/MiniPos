"use client";

import { Table, Td, Th } from "@/components/ui/table";
import Link from "next/link";
import { useState } from "react";
import { listSalesAction } from "@/lib/actions/sales";
import type { ListSalesInput } from "@/lib/actions/sales-schema";
import { formatDateTime } from "@/lib/dates";
import { formatBs } from "@/lib/money";
import type { Sale } from "@/lib/repos/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type MethodFilter = "" | "cash" | "qr" | "card";
type StatusFilter = "" | "paid" | "voided";

const METHOD_LABELS: Record<string, string> = { cash: "Efectivo", qr: "QR", card: "Tarjeta" };

const PAGE_SIZE = 100;
const SKELETON_ROWS = 5;

const selectClasses =
  "h-10 rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface SalesHistoryProps {
  initialSales: Sale[];
  initialCashierNames: Record<string, string>;
  isOwner: boolean;
  initialError?: string | null;
  initialHasMore?: boolean;
}

export function SalesHistory({
  initialSales,
  initialCashierNames,
  isOwner,
  initialError = null,
  initialHasMore = false,
}: SalesHistoryProps) {
  const [sales, setSales] = useState(initialSales);
  const [cashierNames, setCashierNames] = useState(initialCashierNames);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [method, setMethod] = useState<MethodFilter>("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [cashierId, setCashierId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

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

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSearch}
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
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value as MethodFilter)}
          aria-label="Filtrar por método de pago"
          className={selectClasses}
        >
          <option value="">Todos los métodos</option>
          <option value="cash">Efectivo</option>
          <option value="qr">QR</option>
          <option value="card">Tarjeta</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          aria-label="Filtrar por estado"
          className={selectClasses}
        >
          <option value="">Todos los estados</option>
          <option value="paid">Pagadas</option>
          <option value="voided">Anuladas</option>
        </select>
        {isOwner ? (
          <select
            value={cashierId}
            onChange={(event) => setCashierId(event.target.value)}
            aria-label="Filtrar por cajero"
            className={selectClasses}
          >
            <option value="">Todos los cajeros</option>
            {Object.entries(cashierNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            Buscar
          </Button>
          <Button type="button" variant="ghost" onClick={handleClear} disabled={loading}>
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
                  <Th scope="col">
                    N.º
                  </Th>
                  <Th scope="col">
                    Fecha
                  </Th>
                  <Th scope="col">
                    Cajero
                  </Th>
                  <Th scope="col">
                    Método
                  </Th>
                  <Th scope="col">
                    Estado
                  </Th>
                  <Th scope="col" className="text-right">
                    Total
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading
                  ? Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
                      <tr key={`skeleton-${rowIndex}`}>
                        {Array.from({ length: 6 }, (_, cellIndex) => (
                          <Td key={cellIndex}>
                            <Skeleton className="h-4 w-full" />
                          </Td>
                        ))}
                      </tr>
                    ))
                  : sales.map((sale) => (
                      <tr key={sale.id}>
                        <Td className="whitespace-nowrap">
                          <Link
                            href={`/ventas/${sale.id}`}
                            className="rounded font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            #{sale.number}
                          </Link>
                        </Td>
                        <Td className="whitespace-nowrap text-foreground-muted">
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
                        <Td className="whitespace-nowrap text-right font-medium text-foreground">
                          {formatBs(sale.total_cents)}
                        </Td>
                      </tr>
                    ))}
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
