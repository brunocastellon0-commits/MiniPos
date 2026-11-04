"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { confirmSaleAction } from "@/lib/actions/sales";
import { formatBs, toCents } from "@/lib/money";
import type { CashOverview } from "@/lib/actions/cash-core";
import type { Sale, SaleItem } from "@/lib/repos/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface PaymentDialogProps {
  open: boolean;
  overview: CashOverview;
  totalCents: number;
  discountCents: number;
  items: Array<{ productId: string; quantity: number }>;
  onClose: () => void;
  onConfirmed: (result: { sale: Sale; items: SaleItem[]; changeCents: number }) => void;
}

type PaymentMethod = "cash" | "qr" | "card";

type PaymentStatus = "idle" | "loading" | "success" | "error";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  qr: "QR",
  card: "Tarjeta",
};

export function PaymentDialog({
  open,
  overview,
  totalCents,
  discountCents,
  items,
  onClose,
  onConfirmed,
}: PaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const requestIdRef = useRef<string | null>(null);
  // Candado síncrono: el estado React tarda en reflejarse, el ref evita el doble clic/Enter.
  const sendingRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setError("El efectivo recibido debe cubrir el total de la venta.");
      setStatus("error");
      return;
    }

    requestIdRef.current ??= crypto.randomUUID();
    const clientRequestId = requestIdRef.current;

    sendingRef.current = true;
    setStatus("loading");
    try {
      const result = await confirmSaleAction({
        sessionId: overview.session.id,
        paymentMethod: method,
        clientRequestId,
        discountCents,
        items: items.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
        cashReceivedCents: receivedCents ?? undefined,
      });

      if (!result.ok) {
        setError(result.message);
        setStatus("error");
        return;
      }

      setStatus("success");
      successTimerRef.current = setTimeout(() => {
        successTimerRef.current = null;
        onConfirmed({
          sale: result.data.sale,
          items: result.data.items,
          changeCents: method === "cash" ? changeCents : 0,
        });
      }, 400);
    } catch {
      setError("No se pudo confirmar la venta. El carrito se conserva.");
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
      title="Cobrar venta"
      description={`Total a pagar: ${formatBs(totalCents)}`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={locked}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="payment-form"
            disabled={locked || !canSubmit}
            loading={sending}
          >
            {status === "success"
              ? "Pago completado"
              : sending
                ? "Procesando pago…"
                : "Confirmar cobro"}
          </Button>
        </>
      }
    >
      <form id="payment-form" className="space-y-4" onSubmit={handleSubmit}>
        {status === "success" ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm font-semibold text-foreground"
          >
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            Pago completado
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
            <label htmlFor="cash-received" className="text-sm font-medium text-foreground">
              Efectivo recibido
            </label>
            <Input
              id="cash-received"
              inputMode="decimal"
              placeholder="0,00"
              value={received}
              invalid={Boolean(error)}
              onChange={(event) => setReceived(event.target.value)}
              disabled={locked}
            />
            <p className="text-sm text-muted">
              Vuelto: <span className="font-semibold text-foreground">{formatBs(changeCents)}</span>
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

export function SaleConfirmation({
  sale,
  changeCents,
  onNewSale,
  onPrint,
}: {
  sale: Sale;
  changeCents: number;
  onNewSale: () => void;
  onPrint?: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-card border border-success/30 bg-success/10 p-6 text-center">
      <Badge tone="success" className="mb-3">
        Venta cobrada
      </Badge>
      <h2 className="text-lg font-semibold text-foreground">
        Venta #{sale.number} confirmada
      </h2>
      <p className="mt-2 text-sm text-foreground-muted">Total</p>
      <p className="text-2xl font-bold text-foreground">{formatBs(sale.total_cents)}</p>
      {sale.payment_method === "cash" ? (
        <>
          <p className="mt-2 text-sm text-foreground-muted">Vuelto</p>
          <p className="text-lg font-semibold text-foreground">{formatBs(changeCents)}</p>
        </>
      ) : null}
      <div className="mt-4 flex gap-2">
        {onPrint ? (
          <Button variant="secondary" className="flex-1" onClick={onPrint}>
            Imprimir
          </Button>
        ) : null}
        <Button className="flex-1" onClick={onNewSale}>
          Nueva venta
        </Button>
      </div>
    </div>
  );
}
