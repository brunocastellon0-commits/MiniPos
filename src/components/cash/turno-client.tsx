"use client";

import { useCallback, useState } from "react";
import { Clock, Minus, Plus, Wallet } from "lucide-react";
import {
  type CashOverview,
  getCashOverviewAction,
  listCashSessionsAction,
} from "@/lib/actions/cash";
import { formatTime } from "@/lib/dates";
import { formatBs } from "@/lib/money";
import type { CashSession } from "@/lib/repos/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Toast } from "@/components/ui/toast";
import { CloseSessionDialog } from "./close-session-dialog";
import { MovementDialog } from "./movement-dialog";
import { OpenSessionForm } from "./open-session-form";
import { SessionHistory } from "./session-history";

export interface TurnoClientProps {
  initialOverview: CashOverview | null;
  initialHistory: CashSession[];
  initialError?: string;
}

export function TurnoClient({
  initialOverview,
  initialHistory,
  initialError,
}: TurnoClientProps) {
  const [tab, setTab] = useState<"actual" | "historial">("actual");
  const [overview, setOverview] = useState<CashOverview | null>(initialOverview);
  const [history, setHistory] = useState<CashSession[]>(initialHistory);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewResult, historyResult] = await Promise.all([
        getCashOverviewAction(),
        listCashSessionsAction({ limit: 30 }),
      ]);

      if (overviewResult.ok) setOverview(overviewResult.data);
      if (historyResult.ok) setHistory(historyResult.data);
    } catch {
      setError("No se pudo actualizar el turno. Recarga la página.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpened = useCallback(async () => {
    await refresh();
    setNotice("Turno abierto correctamente.");
  }, [refresh]);

  const handleMovementCreated = useCallback(async () => {
    await refresh();
    setNotice("Movimiento registrado.");
  }, [refresh]);

  const handleClosed = useCallback(async () => {
    await refresh();
    setNotice("Turno cerrado correctamente.");
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Clock className="h-6 w-6 text-primary" aria-hidden="true" />
            Turno de caja
          </h1>
          <p className="mt-1 text-sm text-muted">
            Apertura, movimientos, cierre e historial del turno.
          </p>
        </div>
        {overview ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setMovementOpen(true)}>
              <Plus className="size-4 mr-1" aria-hidden="true" />
              Movimiento
            </Button>
            <Button variant="danger" onClick={() => setCloseOpen(true)}>
              Cerrar turno
            </Button>
          </div>
        ) : null}
      </div>

      {notice ? (
        <div className="flex items-center gap-2">
          <Toast tone="success" title={notice} className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>
            Cerrar aviso
          </Button>
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-border">
        {(["actual", "historial"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === value
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {value === "actual" ? "Turno actual" : "Historial"}
          </button>
        ))}
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {error}
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="ml-2">
            Reintentar
          </Button>
        </div>
      ) : null}

      {tab === "actual" ? (
        overview ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-success/10 text-success">
                    <Wallet className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <CardTitle>
                      Caja abierta · desde {formatTime(new Date(overview.session.opened_at))} ·{" "}
                      {overview.openedByName}
                    </CardTitle>
                  </div>
                </div>
                <Badge tone="success">Abierta</Badge>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div>
                    <dt className="text-xs text-muted">Saldo inicial</dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {formatBs(overview.session.opening_cents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Efectivo esperado</dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {formatBs(overview.expectedCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Ventas efectivo</dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {formatBs(overview.payments.cashCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Ventas QR</dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {formatBs(overview.payments.qrCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Ventas tarjeta</dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {formatBs(overview.payments.cardCents)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Movimientos de efectivo</CardTitle>
              </CardHeader>
              <CardContent>
                {overview.movements.length === 0 ? (
                  <EmptyState
                    title="Sin movimientos"
                    description="Registra ingresos o egresos cuando corresponda."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {overview.movements.map((movement) => (
                      <li key={movement.id} className="flex items-center justify-between py-2 text-sm">
                        <div className="flex items-center gap-2">
                          {movement.kind === "in" ? (
                            <Plus className="size-4 text-success" aria-hidden="true" />
                          ) : (
                            <Minus className="size-4 text-danger" aria-hidden="true" />
                          )}
                          <span className="text-foreground">{movement.reason}</span>
                        </div>
                        <span className="text-foreground">
                          {movement.kind === "in" ? "+" : "-"}
                          {formatBs(movement.amount_cents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <OpenSessionForm onOpened={handleOpened} />
        )
      ) : (
        <SessionHistory sessions={history} />
      )}

      {overview ? (
        <>
          <MovementDialog
            open={movementOpen}
            sessionId={overview.session.id}
            onClose={() => setMovementOpen(false)}
            onCreated={handleMovementCreated}
          />
          <CloseSessionDialog
            open={closeOpen}
            sessionId={overview.session.id}
            openingCents={overview.session.opening_cents}
            expectedCents={overview.expectedCents}
            payments={overview.payments}
            onClose={() => setCloseOpen(false)}
            onClosed={handleClosed}
          />
        </>
      ) : null}
    </div>
  );
}
