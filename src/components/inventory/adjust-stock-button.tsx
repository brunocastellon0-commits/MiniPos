"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { adjustStockAction } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";

export interface AdjustStockButtonProps {
  productId: string;
  productName: string;
  currentStock: number;
}

export function AdjustStockButton({ productId, productName, currentStock }: AdjustStockButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"adjustment" | "waste">("adjustment");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function handleClose() {
    if (submitting) return;
    setOpen(false);
    setKind("adjustment");
    setDelta("");
    setReason("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;

    const parsed = Number(delta);
    if (!Number.isInteger(parsed) || parsed === 0) {
      setError("Ingresa una cantidad entera distinta de cero (ej. 5 o -3).");
      return;
    }
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("El motivo es obligatorio.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await adjustStockAction({
        productId,
        delta: parsed,
        kind,
        reason: trimmed,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setSuccess(true);
      router.refresh();
    } catch {
      setError("No se pudo ajustar el stock.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      {success ? (
        <Toast
          tone="success"
          title="Stock actualizado"
          description={`Las existencias de ${productName} quedaron en ${currentStock}.`}
        />
      ) : null}
      <Button
        type="button"
        variant="ghost"
        aria-label={`Ajustar stock de ${productName}`}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Ajustar
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        title={`Ajustar stock — ${productName}`}
        description={`Existencias actuales: ${currentStock}. El movimiento queda en el historial con tu usuario y el motivo indicado.`}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="adjust-stock-form"
              variant="primary"
              disabled={submitting}
              loading={submitting}
            >
              {submitting ? "Guardando…" : "Guardar ajuste"}
            </Button>
          </>
        }
      >
        <form id="adjust-stock-form" onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="adjust-kind" className="block text-sm font-medium text-foreground">
              Tipo de movimiento
            </label>
            <select
              id="adjust-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as "adjustment" | "waste")}
              className="h-10 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="adjustment">Ajuste (suma o resta)</option>
              <option value="waste">Merma (producto dañado/vencido)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="adjust-delta" className="block text-sm font-medium text-foreground">
              Cantidad (positiva suma, negativa resta)
            </label>
            <input
              id="adjust-delta"
              type="number"
              step={1}
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              placeholder="Ej. 5 o -3"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "adjust-stock-error" : undefined}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="adjust-reason" className="block text-sm font-medium text-foreground">
              Motivo (obligatorio)
            </label>
            <textarea
              id="adjust-reason"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej. Conteo de almacén"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "adjust-stock-error" : undefined}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error ? (
            <p id="adjust-stock-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>
      </Dialog>
    </>
  );
}
