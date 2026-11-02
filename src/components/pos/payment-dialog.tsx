"use client";

import { useRef, useState } from "react";
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
  items: Array<{ productId: string; quantity: number }>;
  onClose: () => void;
  onConfirmed: (result: { sale: Sale; items: SaleItem[]; changeCents: number }) => void;
}

type PaymentMethod = "cash" | "qr" | "card";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  qr: "QR",
  card: "Tarjeta",
};

export function PaymentDialog({
  open,
  overview,
  totalCents,
  items,
  onClose,
  onConfirmed,
}: PaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const requestIdRef = useRef<string | null>(null);

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
    setError(null);

    if (!canSubmit) {
      setError("El efectivo recibido debe cubrir el total de la venta.");
      return;
    }

    requestIdRef.current ??= crypto.randomUUID();
    const clientRequestId = requestIdRef.current;

    setSending(true);
    try {
      const result = await confirmSaleAction({
        sessionId: overview.session.id,
        paymentMethod: method,
        clientRequestId,
        items: items.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
        cashReceivedCents: receivedCents ?? undefined,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      onConfirmed({
        sale: result.data.sale,
        items: result.data.items,
        changeCents: method === "cash" ? changeCents : 0,
      });
    } catch {
      setError("No se pudo confirmar la venta. El carrito se conserva.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!sending) onClose();
      }}
      title="Cobrar venta"
      description={`Total a pagar: ${formatBs(totalCents)}`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="payment-form"
            disabled={sending || !canSubmit}
            loading={sending}
          >
            Confirmar cobro
          </Button>
        </>
      }
    >
      <form id="payment-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex gap-2" role="group" aria-label="Método de pago">
          {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((value) => (
            <Button
              key={value}
              type="button"
              variant={method === value ? "primary" : "secondary"}
              onClick={() => setMethod(value)}
              disabled={sending}
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
              disabled={sending}
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

        {error ? (
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
