"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatBs, toCents } from "@/lib/money";

export type PaymentMethod = "cash" | "qr" | "card";

export interface PaymentMethodConfirmInput {
  paymentMethod: PaymentMethod;
  cashReceivedCents?: number;
  clientRequestId: string;
}

export interface PaymentMethodDialogProps {
  open: boolean;
  title: string;
  totalCents: number;
  onClose: () => void;
  onConfirm: (
    input: PaymentMethodConfirmInput,
  ) => Promise<{ ok: boolean; message?: string }>;
  successLabel?: string;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  qr: "QR",
  card: "Tarjeta",
};

type DialogStatus = "idle" | "loading" | "success" | "error";

export function PaymentMethodDialog({
  open,
  title,
  totalCents,
  onClose,
  onConfirm,
  successLabel = "Pago completado",
}: PaymentMethodDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DialogStatus>("idle");
  const requestIdRef = useRef<string | null>(null);
  // Candado síncrono: el estado React tarda en reflejarse, el ref evita el doble clic/Enter.
  const sendingRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // El diálogo se monta solo cuando está abierto (render condicional del padre),
  // así el estado arranca limpio en cada cobro sin efectos de reset.
  useEffect(
    () => () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    },
    [],
  );

  const sending = status === "loading";
  const locked = status === "loading" || status === "success";

  function parsedReceived(): number | null {
    try {
      return toCents(received);
    } catch {
      return null;
    }
  }

  const receivedCents = method === "cash" ? parsedReceived() : null;
  const changeCents = receivedCents !== null ? receivedCents - totalCents : 0;
  const canSubmit =
    method !== "cash" || (receivedCents !== null && receivedCents >= totalCents);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (sendingRef.current || status === "success") return;
    setError(null);

    if (!canSubmit) {
      setError("El efectivo recibido debe cubrir el total.");
      setStatus("error");
      return;
    }

    requestIdRef.current ??= crypto.randomUUID();
    const clientRequestId = requestIdRef.current;

    sendingRef.current = true;
    setStatus("loading");
    try {
      const result = await onConfirm({
        paymentMethod: method,
        cashReceivedCents: receivedCents ?? undefined,
        clientRequestId,
      });
      if (!result.ok) {
        setError(result.message ?? "No se pudo procesar el pago.");
        setStatus("error");
        return;
      }
      setStatus("success");
      successTimerRef.current = setTimeout(() => {
        successTimerRef.current = null;
        onClose();
      }, 400);
    } catch {
      setError("No se pudo procesar el pago. Intenta de nuevo.");
      setStatus("error");
    } finally {
      sendingRef.current = false;
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!locked) onClose();
      }}
      title={title}
      description={`Total a pagar: ${formatBs(totalCents)}`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={locked}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="payment-method-form"
            disabled={locked || !canSubmit}
            loading={sending}
          >
            {status === "success"
              ? successLabel
              : sending
                ? "Procesando pago…"
                : "Confirmar cobro"}
          </Button>
        </>
      }
    >
      <form id="payment-method-form" className="space-y-4" onSubmit={handleSubmit}>
        {status === "success" ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm font-semibold text-foreground"
            data-testid="payment-success"
          >
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            {successLabel}
          </p>
        ) : null}
        <div className="flex gap-2" role="group" aria-label="Método de pago">
          {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((value) => (
            <Button
              key={value}
              type="button"
              variant={method === value ? "primary" : "secondary"}
              onClick={() => setMethod(value)}
              disabled={locked}
            >
              {METHOD_LABELS[value]}
            </Button>
          ))}
        </div>

        {method === "cash" ? (
          <div className="space-y-1.5">
            <label htmlFor="order-cash-received" className="text-sm font-medium text-foreground">
              Efectivo recibido
            </label>
            <Input
              id="order-cash-received"
              inputMode="decimal"
              placeholder="0,00"
              value={received}
              invalid={Boolean(error)}
              onChange={(event) => setReceived(event.target.value)}
              disabled={locked}
            />
            <p className="text-sm text-muted">
              Vuelto:{" "}
              <span className="font-semibold text-foreground">{formatBs(changeCents)}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Registra el pago recibido por {METHOD_LABELS[method]} y confirma el cobro.
          </p>
        )}

        {error && status !== "success" ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
