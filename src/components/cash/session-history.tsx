"use client";

import { Table, Td, Th } from "@/components/ui/table";
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
      <Table className="min-w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <Th scope="col">
              Apertura
            </Th>
            <Th scope="col">
              Cierre
            </Th>
            <Th scope="col" className="text-right">
              Inicial
            </Th>
            <Th scope="col" className="text-right">
              Esperado
            </Th>
            <Th scope="col" className="text-right">
              Contado
            </Th>
            <Th scope="col">
              Diferencia
            </Th>
            <Th scope="col">
              Estado
            </Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sessions.map((session) => (
            <tr key={session.id}>
              <Td className="whitespace-nowrap text-foreground">
                {formatDateTime(new Date(session.opened_at))}
              </Td>
              <Td className="whitespace-nowrap text-foreground-muted">
                {session.closed_at ? formatDateTime(new Date(session.closed_at)) : "—"}
              </Td>
              <Td className="whitespace-nowrap text-right text-foreground">
                {formatBs(session.opening_cents)}
              </Td>
              <Td className="whitespace-nowrap text-right text-foreground">
                {session.expected_cash_cents === null
                  ? "—"
                  : formatBs(session.expected_cash_cents)}
              </Td>
              <Td className="whitespace-nowrap text-right text-foreground">
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
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
