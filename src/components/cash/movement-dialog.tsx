"use client";

import { useRef, useState } from "react";
import { addCashMovementAction } from "@/lib/actions/cash";
import { toCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface MovementDialogProps {
  open: boolean;
  sessionId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function MovementDialog({ open, sessionId, onClose, onCreated }: MovementDialogProps) {
  const [kind, setKind] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  function reset() {
    setKind("in");
    setAmount("");
    setReason("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    setError(null);

    let amountCents: number;
    try {
      amountCents = toCents(amount);
    } catch {
      setError("Ingresa un monto válido, por ejemplo 50,00.");
      return;
    }

    if (amountCents <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }

    if (!reason.trim()) {
      setError("El motivo es obligatorio.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const result = await addCashMovementAction({
        sessionId,
        kind,
        amountCents,
        reason: reason.trim(),
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      reset();
      onCreated();
      onClose();
    } catch {
      setError("No se pudo registrar el movimiento. Intenta de nuevo.");
    } finally {
      savingRef.current = false;
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
      title="Movimiento de efectivo"
      description="Registra un ingreso o egreso de dinero de la caja."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="cash-movement-form" loading={saving} disabled={saving}>
            Registrar
          </Button>
        </>
      }
    >
      <form id="cash-movement-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="movement-kind" className="text-sm font-medium text-foreground">
            Tipo de movimiento
          </label>
          <select
            id="movement-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value === "out" ? "out" : "in")}
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <option value="in">Ingreso de efectivo</option>
            <option value="out">Egreso de efectivo</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="movement-amount" className="text-sm font-medium text-foreground">
            Monto
          </label>
          <Input
            id="movement-amount"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            invalid={Boolean(error)}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="movement-reason" className="text-sm font-medium text-foreground">
            Motivo
          </label>
          <Input
            id="movement-reason"
            maxLength={200}
            placeholder="Ej. Cambio, pago a proveedor, retiro"
            value={reason}
            invalid={Boolean(error)}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
