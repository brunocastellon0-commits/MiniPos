"use client";

import { useState } from "react";
import { Table, Td, Th } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { classifyCashDifference } from "@/lib/domain/cash";
import { formatDateTime } from "@/lib/dates";
import { formatBs } from "@/lib/money";
import type { CashSession } from "@/lib/repos/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableRow } from "@/components/ui/expandable-row";
import { Skeleton } from "@/components/ui/skeleton";
import { getCashSessionDetailAction } from "@/lib/actions/cash";
import type { CashOverview } from "@/lib/actions/cash-core";

export interface SessionHistoryProps {
  sessions: CashSession[];
}

function differenceLabel(session: CashSession) {
  if (session.difference_cents === null) return <span className="text-muted">—</span>;

  const status = classifyCashDifference(session.difference_cents);
  return (
    <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
      {status === "short" ? (
        <AlertTriangle className="size-4 text-danger" aria-hidden="true" />
      ) : status === "over" ? (
        <TrendingUp className="size-4 text-warning" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
      )}
      {formatBs(session.difference_cents)}
      <span className="text-xs text-muted">
        {status === "short" ? "Faltante" : status === "over" ? "Sobrante" : "Cuadra"}
      </span>
    </span>
  );
}

export function SessionHistory({ sessions }: SessionHistoryProps) {
  const [detailsById, setDetailsById] = useState<
    Record<string, { overview: CashOverview | null; loading: boolean; error?: string }>
  >({});

  if (sessions.length === 0) {
    return (
      <EmptyState
        title="Sin turnos registrados"
        description="Cuando abras y cierres tu primer turno aparecerá aquí."
      />
    );
  }

  const handleRowToggle = async (sessionId: string, expanded: boolean) => {
    if (!expanded) return;
    if (detailsById[sessionId]?.overview) return;

    setDetailsById((prev) => ({
      ...prev,
      [sessionId]: { overview: null, loading: true },
    }));

    try {
      const res = await getCashSessionDetailAction({ sessionId });
      if (res.ok) {
        setDetailsById((prev) => ({
          ...prev,
          [sessionId]: { overview: res.data, loading: false },
        }));
      } else {
        setDetailsById((prev) => ({
          ...prev,
          [sessionId]: { overview: null, loading: false, error: res.message },
        }));
      }
    } catch {
      setDetailsById((prev) => ({
        ...prev,
        [sessionId]: { overview: null, loading: false, error: "No se pudo cargar el detalle" },
      }));
    }
  };

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <Table className="min-w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="w-8 px-2 py-3" />
            <Th scope="col">Apertura</Th>
            <Th scope="col">Cierre</Th>
            <Th scope="col" className="text-right">Inicial</Th>
            <Th scope="col" className="text-right">Esperado</Th>
            <Th scope="col" className="text-right">Contado</Th>
            <Th scope="col">Diferencia</Th>
            <Th scope="col">Estado</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sessions.map((session) => {
            const detail = detailsById[session.id];
            return (
              <ExpandableRow
                key={session.id}
                colSpan={7}
                onToggle={(expanded) => handleRowToggle(session.id, expanded)}
                summary={
                  <>
                    <Td className="whitespace-nowrap text-foreground">
                      {formatDateTime(new Date(session.opened_at))}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {session.closed_at ? formatDateTime(new Date(session.closed_at)) : "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-right text-foreground tabular-nums">
                      {formatBs(session.opening_cents)}
                    </Td>
                    <Td className="whitespace-nowrap text-right text-foreground tabular-nums">
                      {session.expected_cash_cents === null
                        ? "—"
                        : formatBs(session.expected_cash_cents)}
                    </Td>
                    <Td className="whitespace-nowrap text-right text-foreground tabular-nums">
                      {session.counted_cash_cents === null
                        ? "—"
                        : formatBs(session.counted_cash_cents)}
                    </Td>
                    <Td className="whitespace-nowrap">{differenceLabel(session)}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge tone={session.status === "open" ? "success" : "neutral"}>
                        {session.status === "open" ? "Abierta" : "Cerrada"}
                      </Badge>
                    </Td>
                  </>
                }
              >
                <div className="space-y-4 rounded-lg border border-border bg-surface p-4 text-xs">
                  <h4 className="font-semibold uppercase tracking-wider text-muted">
                    Detalle completo de la sesión
                  </h4>

                  {detail?.loading ? (
                    <div className="space-y-2 py-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ) : detail?.error ? (
                    <p className="text-danger">{detail.error}</p>
                  ) : detail?.overview ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-1.5 rounded-md border border-border bg-surface-muted/40 p-3">
                        <span className="font-semibold text-foreground">Desglose de efectivo</span>
                        <div className="space-y-1 text-muted">
                          <div className="flex justify-between">
                            <span>Monto inicial:</span>
                            <span className="font-medium tabular-nums text-foreground">
                              {formatBs(session.opening_cents)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Ventas efectivo:</span>
                            <span className="font-medium tabular-nums text-foreground">
                              {formatBs(detail.overview.payments.cashCents)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Ingresos manuales:</span>
                            <span className="font-medium tabular-nums text-success">
                              +{formatBs(
                                detail.overview.movements
                                  .filter((m) => m.kind === "in")
                                  .reduce((acc, m) => acc + m.amount_cents, 0),
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Egresos manuales:</span>
                            <span className="font-medium tabular-nums text-danger">
                              -{formatBs(
                                detail.overview.movements
                                  .filter((m) => m.kind === "out")
                                  .reduce((acc, m) => acc + m.amount_cents, 0),
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 rounded-md border border-border bg-surface-muted/40 p-3">
                        <span className="font-semibold text-foreground">Otros métodos de pago</span>
                        <div className="space-y-1 text-muted">
                          <div className="flex justify-between">
                            <span>Cobros por QR:</span>
                            <span className="font-medium tabular-nums text-foreground">
                              {formatBs(detail.overview.payments.qrCents)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Cobros con tarjeta:</span>
                            <span className="font-medium tabular-nums text-foreground">
                              {formatBs(detail.overview.payments.cardCents)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-border/60 pt-1">
                            <span>Total ventas:</span>
                            <span className="font-bold tabular-nums text-foreground">
                              {formatBs(detail.overview.payments.totalCents)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 rounded-md border border-border bg-surface-muted/40 p-3 sm:col-span-2 lg:col-span-1">
                        <span className="font-semibold text-foreground">Movimientos ({detail.overview.movements.length})</span>
                        {detail.overview.movements.length === 0 ? (
                          <p className="text-muted">Sin movimientos registrados en este turno.</p>
                        ) : (
                          <div className="max-h-28 overflow-y-auto space-y-1 text-muted">
                            {detail.overview.movements.map((mov) => (
                              <div key={mov.id} className="flex justify-between text-[11px]">
                                <span>{mov.reason}</span>
                                <span
                                  className={
                                    mov.kind === "in"
                                      ? "font-medium text-success"
                                      : "font-medium text-danger"
                                  }
                                >
                                  {mov.kind === "in" ? "+" : "-"}
                                  {formatBs(mov.amount_cents)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {session.notes && (
                    <div className="rounded border border-border bg-surface-muted/30 p-2 text-muted">
                      <strong className="text-foreground">Observaciones de cierre:</strong> {session.notes}
                    </div>
                  )}
                </div>
              </ExpandableRow>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
