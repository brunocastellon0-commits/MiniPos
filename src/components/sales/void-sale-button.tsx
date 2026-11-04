"use client";

import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { voidSaleAction } from "@/lib/actions/sales";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";

export interface VoidSaleButtonProps {
  saleId: string;
}

export function VoidSaleButton({ saleId }: VoidSaleButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function handleClose() {
    if (submitting) return;
    setOpen(false);
    setReason("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("El motivo de anulación es obligatorio.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await voidSaleAction({ saleId, reason: trimmed });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setSuccess(true);
      router.refresh();
    } catch {
      setError("No se pudo anular la venta.");
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
          title="Venta anulada"
          description="El stock se revirtió y la venta queda en el historial como anulada."
        />
      ) : null}
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        <Ban className="size-4" aria-hidden="true" />
        Anular venta
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        title="Anular venta"
        description="La venta se conserva en el historial como anulada, se revierte el stock y deja de contar en el efectivo esperado. No se puede deshacer."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="void-sale-form"
              variant="danger"
              disabled={submitting}
              loading={submitting}
            >
              {submitting ? "Anulando…" : "Anular venta"}
            </Button>
          </>
        }
      >
        <form id="void-sale-form" onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="void-reason" className="block text-sm font-medium text-foreground">
            Motivo de anulación (obligatorio)
          </label>
          <textarea
            id="void-reason"
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej.: Error de cobro"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "void-reason-error" : undefined}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {error ? (
            <p id="void-reason-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>
      </Dialog>
    </>
  );
}
