"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, TrendingUp, XCircle } from "lucide-react";
import { closeCashSessionAction } from "@/lib/actions/cash";
import {
  cashDifferenceCents,
  classifyCashDifference,
  type SalesByPayment,
} from "@/lib/domain/cash";
import { formatBs, toCents } from "@/lib/money";
import type { CashSession } from "@/lib/repos/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface CloseSessionDialogProps {
  open: boolean;
  sessionId: string;
  openingCents: number;
  expectedCents: number;
  payments: SalesByPayment;
  onClose: () => void;
  onClosed: (session: CashSession) => void;
}

export function CloseSessionDialog({
  open,
  sessionId,
  openingCents,
  expectedCents,
  payments,
  onClose,
  onClosed,
}: CloseSessionDialogProps) {
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function parsedCounted(): number | null {
    try {
      return toCents(counted);
    } catch {
      return null;
    }
  }

  const countedCents = parsedCounted();
  const difference =
    countedCents !== null ? cashDifferenceCents(countedCents, expectedCents) : null;
  const differenceStatus = difference !== null ? classifyCashDifference(difference) : null;

  function reset() {
    setCounted("");
    setNotes("");
    setConfirmed(false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (countedCents === null || countedCents < 0) {
      setError("Ingresa el efectivo contado, por ejemplo 150,00.");
      return;
    }

    if (!confirmed) {
      setError("Confirma que revisaste el efectivo antes de cerrar.");
      return;
    }

    setSaving(true);
    try {
      const result = await closeCashSessionAction({
        sessionId,
        countedCents,
        notes: notes.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      reset();
      onClosed(result.data);
      onClose();
    } catch {
      setError("No se pudo cerrar el turno. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Cerrar turno de caja"
      description="Revisa el resumen y registra el efectivo contado."
      className="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="close-session-form"
            variant="danger"
            loading={saving}
            disabled={saving || !confirmed}
          >
            Cerrar turno
          </Button>
        </>
      }
    >
      <form id="close-session-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-surface-muted p-3">
            <p className="text-xs text-muted">Saldo inicial</p>
            <p className="text-sm font-semibold text-foreground">{formatBs(openingCents)}</p>
          </div>
          <div className="rounded-md border border-border bg-surface-muted p-3">
            <p className="text-xs text-muted">Efectivo esperado</p>
            <p className="text-sm font-semibold text-foreground">{formatBs(expectedCents)}</p>
          </div>
          <div className="rounded-md border border-border bg-surface-muted p-3">
            <p className="text-xs text-muted">Ventas en efectivo</p>
            <p className="text-sm font-semibold text-foreground">{formatBs(payments.cashCents)}</p>
          </div>
          <div className="rounded-md border border-border bg-surface-muted p-3">
            <p className="text-xs text-muted">QR / Tarjeta</p>
            <p className="text-sm font-semibold text-foreground">
              {formatBs(payments.qrCents)} / {formatBs(payments.cardCents)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="counted-cents" className="text-sm font-medium text-foreground">
            Efectivo contado
          </label>
          <Input
            id="counted-cents"
            inputMode="decimal"
            placeholder="0,00"
            value={counted}
            invalid={Boolean(error)}
            onChange={(event) => setCounted(event.target.value)}
          />
        </div>

        {difference !== null && differenceStatus ? (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3"
          >
            <span className="text-sm text-muted">Diferencia</span>
            <span className="flex items-center gap-2 text-sm font-semibold">
              {differenceStatus === "short" ? (
                <AlertTriangle className="size-4 text-danger" aria-hidden="true" />
              ) : differenceStatus === "over" ? (
                <TrendingUp className="size-4 text-warning" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
              )}
              {formatBs(difference)}
              <Badge
                tone={
                  differenceStatus === "short"
                    ? "danger"
                    : differenceStatus === "over"
                      ? "warning"
                      : "success"
                }
              >
                {differenceStatus === "short"
                  ? "Faltante"
                  : differenceStatus === "over"
                    ? "Sobrante"
                    : "Cuadra"}
              </Badge>
            </span>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="close-notes" className="text-sm font-medium text-foreground">
            Notas <span className="font-normal text-muted">(opcional)</span>
          </label>
          <Input
            id="close-notes"
            maxLength={500}
            placeholder="Observaciones del cierre"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 size-4 rounded border-border"
          />
          <span>Confirmo que revisé el efectivo y que el cierre no se puede deshacer.</span>
        </label>

        {error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <XCircle className="size-4" aria-hidden="true" />
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
