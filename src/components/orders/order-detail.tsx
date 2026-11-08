"use client";

import { useState } from "react";
import { ArrowRight, Ban, CheckCircle2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { chargeOrderAction, updateOrderStatusAction } from "@/lib/actions/orders";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/dates";
import { formatBs } from "@/lib/money";
import type { Order, OrderItem } from "@/lib/repos/types";
import {
  ORDER_FLOW_STATUSES,
  ORDER_STATUS_LABELS,
  OrderPaymentBadge,
  OrderStatusBadge,
} from "./order-badges";
import { PaymentMethodDialog, type PaymentMethodConfirmInput } from "./payment-method-dialog";

export interface OrderDetailProps {
  order: Order;
  items: OrderItem[];
  createdByName: string | null;
}

const NEXT_STATUS: Partial<
  Record<Order["status"], { status: Order["status"]; label: string }>
> = {
  pendiente: { status: "en_preparacion", label: "Iniciar preparación" },
  en_preparacion: { status: "listo", label: "Marcar listo" },
  listo: { status: "entregado", label: "Marcar entregado" },
};

export function OrderDetail({ order, items, createdByName }: OrderDetailProps) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = NEXT_STATUS[order.status];
  const isPaid = order.payment_status === "pagado";
  const isCancelled = order.status === "cancelado";
  const canAdvance = Boolean(next) && !isPaid && !isCancelled;
  const canCancel = !isPaid && !isCancelled;
  const canCharge = !isPaid && !isCancelled;

  async function handleAdvance() {
    if (!next) return;
    setBusy(true);
    setError(null);
    try {
      const result = await updateOrderStatusAction({
        orderId: order.id,
        status: next.status,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo actualizar el estado del pedido.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    setError(null);
    try {
      const result = await updateOrderStatusAction({
        orderId: order.id,
        status: "cancelado",
        reason: cancelReason.trim() ? cancelReason.trim() : undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCancelOpen(false);
      setCancelReason("");
      router.refresh();
    } catch {
      setError("No se pudo cancelar el pedido.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCharge(
    input: PaymentMethodConfirmInput,
  ): Promise<{ ok: boolean; message?: string }> {
    setBusy(true);
    setError(null);
    try {
      const result = await chargeOrderAction({
        orderId: order.id,
        paymentMethod: input.paymentMethod,
        cashReceivedCents: input.cashReceivedCents,
        clientRequestId: input.clientRequestId,
      });
      if (!result.ok) {
        return { ok: false, message: result.message };
      }
      router.refresh();
      return { ok: true };
    } catch {
      return { ok: false, message: "No se pudo cobrar el pedido. Intenta de nuevo." };
    } finally {
      setBusy(false);
    }
  }

  const flowIndex = ORDER_FLOW_STATUSES.indexOf(
    order.status as (typeof ORDER_FLOW_STATUSES)[number],
  );

  return (
    <div className="space-y-4">
      <Link href="/caja" className={buttonClasses({ variant: "secondary" })}>
        Volver a pedidos
      </Link>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Pedido #{order.order_number}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <OrderPaymentBadge paymentStatus={order.payment_status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-muted">Fecha</dt>
              <dd className="font-medium text-foreground">
                {formatDateTime(new Date(order.created_at))}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Responsable</dt>
              <dd className="font-medium text-foreground">{createdByName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Notas</dt>
              <dd className="font-medium text-foreground">{order.notes ?? "—"}</dd>
            </div>
          </dl>

          {isPaid ? (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm"
              data-testid="order-paid"
            >
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                Pedido cobrado
              </p>
              {order.sale_id ? (
                <Link
                  href={`/ventas/${order.sale_id}`}
                  className="text-primary underline underline-offset-2"
                >
                  Ver venta registrada
                </Link>
              ) : null}
            </div>
          ) : null}

          {isCancelled ? (
            <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm">
              <p className="font-semibold text-danger">Pedido cancelado</p>
              <p className="text-foreground-muted">
                {order.notes ? `Notas: ${order.notes}` : "Se canceló antes del cobro."}
              </p>
            </div>
          ) : null}

          <ol aria-label="Avance del pedido" className="flex flex-wrap gap-2">
            {ORDER_FLOW_STATUSES.map((status, index) => (
              <li
                key={status}
                data-testid={`flow-step-${status}`}
                aria-current={index === flowIndex ? "step" : undefined}
                className={
                  index === flowIndex
                    ? "rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                    : index < flowIndex
                      ? "rounded-md bg-success/15 px-2.5 py-1 text-xs font-semibold text-foreground"
                      : "rounded-md bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted"
                }
              >
                {ORDER_STATUS_LABELS[status]}
              </li>
            ))}
          </ol>

          <div className="overflow-x-auto rounded-card border border-border">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Producto
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Precio unit.
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Cantidad
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-foreground">{item.name_snapshot}</td>
                    <td className="px-3 py-2 text-right text-foreground-muted tabular-nums">
                      {formatBs(item.unit_price_cents)}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums">
                      {formatBs(item.line_total_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-medium text-foreground tabular-nums">
                {formatBs(order.subtotal_cents)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Descuento</dt>
              <dd className="font-medium text-foreground tabular-nums">
                -{formatBs(order.discount_cents)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt className="text-foreground">Total</dt>
              <dd className="text-foreground tabular-nums">{formatBs(order.total_cents)}</dd>
            </div>
          </dl>

          {error ? (
            <p role="alert" className="text-sm text-danger" data-testid="order-action-error">
              {error}
            </p>
          ) : null}

          {canAdvance || canCancel || canCharge ? (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {canCharge ? (
                <Button
                  onClick={() => setChargeOpen(true)}
                  loading={busy}
                  data-testid="charge-order-button"
                >
                  <Wallet className="size-4" aria-hidden="true" />
                  Cobrar
                </Button>
              ) : null}
              {canAdvance ? (
                <Button
                  variant="secondary"
                  onClick={() => void handleAdvance()}
                  loading={busy}
                  data-testid="advance-order-button"
                >
                  {next?.label}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  variant="danger"
                  onClick={() => setCancelOpen(true)}
                  disabled={busy}
                  data-testid="cancel-order-button"
                >
                  <Ban className="size-4" aria-hidden="true" />
                  Cancelar pedido
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={cancelOpen}
        onClose={() => {
          if (!busy) setCancelOpen(false);
        }}
        title="Cancelar pedido"
        description="El pedido quedará cancelado y no se podrá cobrar."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCancelOpen(false)}
              disabled={busy}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void handleCancel()}
              loading={busy}
              data-testid="confirm-cancel-order"
            >
              Cancelar pedido
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <label htmlFor="cancel-reason" className="text-sm font-medium text-foreground">
            Motivo (opcional)
          </label>
          <Textarea
            id="cancel-reason"
            rows={2}
            maxLength={300}
            value={cancelReason}
            placeholder="Ej. el cliente se retiró"
            onChange={(event) => setCancelReason(event.target.value)}
          />
        </div>
      </Dialog>

      {chargeOpen ? (
        <PaymentMethodDialog
          open
          title="Cobrar pedido"
          totalCents={order.total_cents}
          onClose={() => setChargeOpen(false)}
          onConfirm={handleCharge}
          successLabel="Pedido cobrado"
        />
      ) : null}
    </div>
  );
}
