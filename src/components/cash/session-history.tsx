"use client";

import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { classifyCashDifference } from "@/lib/domain/cash";
import { formatDateTime } from "@/lib/dates";
import { formatBs } from "@/lib/money";
import type { CashSession } from "@/lib/repos/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export interface SessionHistoryProps {
  sessions: CashSession[];
}

function differenceLabel(session: CashSession) {
  if (session.difference_cents === null) return <span className="text-muted">—</span>;

  const status = classifyCashDifference(session.difference_cents);
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
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
  if (sessions.length === 0) {
    return (
      <EmptyState
        title="Sin turnos registrados"
        description="Cuando abras y cierres tu primer turno aparecerá aquí."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="min-w-full text-sm">
        <thead className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Apertura
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Cierre
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Inicial
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Esperado
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Contado
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Diferencia
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Estado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sessions.map((session) => (
            <tr key={session.id}>
              <td className="whitespace-nowrap px-4 py-3 text-foreground">
                {formatDateTime(new Date(session.opened_at))}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-foreground-muted">
                {session.closed_at ? formatDateTime(new Date(session.closed_at)) : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-foreground">
                {formatBs(session.opening_cents)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-foreground">
                {session.expected_cash_cents === null
                  ? "—"
                  : formatBs(session.expected_cash_cents)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-foreground">
                {session.counted_cash_cents === null
                  ? "—"
                  : formatBs(session.counted_cash_cents)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">{differenceLabel(session)}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <Badge tone={session.status === "open" ? "success" : "neutral"}>
                  {session.status === "open" ? "Abierta" : "Cerrada"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
