"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { getSaleTicketAction } from "@/lib/actions/sales";
import type { SaleTicket } from "@/lib/actions/sales-core";
import { formatBs } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export interface TicketDialogProps {
  saleId: string;
  onClose: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  qr: "QR",
  card: "Tarjeta",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/La_Paz",
  }).format(new Date(iso));
}

export function TicketDialog({ saleId, onClose }: TicketDialogProps) {
  const [ticket, setTicket] = useState<SaleTicket | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSaleTicketAction({ saleId })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setTicket(result.data);
        else setError(result.message);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el comprobante.");
      });
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  const changeCents =
    ticket && ticket.sale.payment_method === "cash" && ticket.sale.cash_received_cents !== null
      ? ticket.sale.cash_received_cents - ticket.sale.total_cents
      : 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Comprobante"
      description="Vista previa para imprimir."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={() => window.print()}
            disabled={!ticket}
            className="print:hidden"
          >
            <Printer className="size-4" aria-hidden="true" />
            Imprimir
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : !ticket ? (
        <p className="text-sm text-muted" role="status">
          Cargando comprobante…
        </p>
      ) : (
        <div
          data-testid="ticket"
          className="rounded-card border border-border bg-surface p-4 text-sm text-foreground print:border-0 print:bg-white print:p-0"
        >
          <div className="text-center">
            <p className="text-base font-bold">{ticket.business.name}</p>
            {ticket.business.legal_name ? (
              <p className="text-xs text-muted">{ticket.business.legal_name}</p>
            ) : null}
            <p className="text-xs text-muted">Comprobante de venta</p>
          </div>

          <div className="mt-3 space-y-0.5 border-y border-dashed border-border py-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Venta N.º</span>
              <span className="font-semibold">{ticket.sale.number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Fecha</span>
              <span>{formatDateTime(ticket.sale.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Método de pago</span>
              <span>{PAYMENT_LABELS[ticket.sale.payment_method] ?? ticket.sale.payment_method}</span>
            </div>
          </div>

          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-muted">
                <th className="py-1 text-left font-medium">Producto</th>
                <th className="py-1 text-center font-medium">Cant.</th>
                <th className="py-1 text-right font-medium">Importe</th>
              </tr>
            </thead>
            <tbody>
              {ticket.items.map((item) => (
                <tr key={item.id} className="border-t border-border/50">
                  <td className="py-1">{item.name_snapshot}</td>
                  <td className="py-1 text-center">{item.quantity}</td>
                  <td className="py-1 text-right">{formatBs(item.line_total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-2 space-y-0.5 border-t border-dashed border-border pt-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>{formatBs(ticket.sale.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Descuento</span>
              <span>-{formatBs(ticket.sale.discount_cents)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span>Total</span>
              <span>{formatBs(ticket.sale.total_cents)}</span>
            </div>
            {ticket.sale.payment_method === "cash" && ticket.sale.cash_received_cents !== null ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted">Efectivo recibido</span>
                  <span>{formatBs(ticket.sale.cash_received_cents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Vuelto</span>
                  <span>{formatBs(changeCents)}</span>
                </div>
              </>
            ) : null}
          </div>

          <p className="mt-3 text-center text-xs text-muted">Gracias por su compra</p>
        </div>
      )}
    </Dialog>
  );
}
