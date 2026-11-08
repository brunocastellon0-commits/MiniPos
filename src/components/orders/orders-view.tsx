import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/dates";
import { formatBs } from "@/lib/money";
import type { Order, OrderItem } from "@/lib/repos/types";
import { ORDER_FLOW_STATUSES, OrderPaymentBadge, OrderStatusBadge } from "./order-badges";

export interface OrdersViewProps {
  orders: Order[];
  items: OrderItem[];
  cashierNames: Record<string, string>;
  error?: string | null;
}

const COLUMN_LABELS: Record<(typeof ORDER_FLOW_STATUSES)[number], string> = {
  pendiente: "Pendiente",
  en_preparacion: "En preparación",
  listo: "Listo",
  entregado: "Entregado",
};

export function OrdersView({ orders, items, cashierNames, error = null }: OrdersViewProps) {
  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  const cancelled = orders.filter((order) => order.status === "cancelado");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <ClipboardList className="h-6 w-6 text-primary" aria-hidden="true" />
            Pedidos
          </h1>
          <p className="mt-1 text-sm text-muted">
            Seguimiento de pedidos por estado. Selecciona un pedido para ver el detalle y cobrar.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/caja?vista=pos"
            className={buttonClasses({ variant: "secondary" })}
            data-testid="venta-directa-link"
          >
            Venta directa
          </Link>
          <Link href="/caja/nuevo" className={buttonClasses()} data-testid="nuevo-pedido-link">
            <Plus className="size-4" aria-hidden="true" />
            Nuevo pedido
          </Link>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          data-testid="orders-error"
        >
          {error}
        </div>
      ) : null}

      {!error && orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-10" aria-hidden="true" />}
          title="No hay pedidos en este turno"
          description="Crea un pedido para empezar a atender la mesa o el consumo."
          action={
            <Link href="/caja/nuevo" className={buttonClasses()}>
              <Plus className="size-4" aria-hidden="true" />
              Nuevo pedido
            </Link>
          }
        />
      ) : null}

      {orders.length > 0 || error ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ORDER_FLOW_STATUSES.map((status) => {
            const columnOrders = orders.filter((order) => order.status === status);
            return (
              <section
                key={status}
                aria-label={`Pedidos ${COLUMN_LABELS[status].toLowerCase()}`}
                data-testid={`orders-column-${status}`}
                className="min-w-0 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    {COLUMN_LABELS[status]}
                  </h2>
                  <span
                    className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground tabular-nums"
                    aria-label={`${columnOrders.length} pedidos ${COLUMN_LABELS[status].toLowerCase()}`}
                  >
                    {columnOrders.length}
                  </span>
                </div>
                {columnOrders.length === 0 ? (
                  <p
                    className="rounded-card border border-dashed border-border p-3 text-center text-xs text-muted"
                    data-testid={`orders-empty-${status}`}
                  >
                    Sin pedidos
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {columnOrders.map((order) => (
                      <li key={order.id}>
                        <Link
                          href={`/caja/pedido/${order.id}`}
                          className="block rounded-card border border-border bg-surface p-3 shadow-raised transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          data-testid={`order-card-${order.order_number}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">
                              Pedido #{order.order_number}
                            </span>
                            <OrderPaymentBadge paymentStatus={order.payment_status} />
                          </div>
                          <p className="mt-0.5 text-xs text-muted">
                            {formatDateTime(new Date(order.created_at))} ·{" "}
                            {cashierNames[order.created_by] ?? "—"}
                          </p>
                          <ul className="mt-2 space-y-0.5">
                            {(itemsByOrder.get(order.id) ?? []).map((item) => (
                              <li
                                key={item.id}
                                className="flex justify-between gap-2 text-sm text-foreground"
                              >
                                <span className="min-w-0 truncate">
                                  {item.quantity} × {item.name_snapshot}
                                </span>
                                <span className="shrink-0 tabular-nums text-muted">
                                  {formatBs(item.line_total_cents)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                            <OrderStatusBadge status={order.status} />
                            <span className="font-bold tabular-nums text-foreground">
                              {formatBs(order.total_cents)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : null}

      {cancelled.length > 0 ? (
        <section aria-label="Pedidos cancelados" data-testid="orders-column-cancelado" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Cancelados</h2>
            <span
              className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground tabular-nums"
              aria-label={`${cancelled.length} pedidos cancelados`}
            >
              {cancelled.length}
            </span>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {cancelled.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/caja/pedido/${order.id}`}
                  className="block rounded-card border border-danger/30 bg-surface p-3 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  data-testid={`order-card-${order.order_number}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      Pedido #{order.order_number}
                    </span>
                    <OrderPaymentBadge paymentStatus={order.payment_status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(new Date(order.created_at))} ·{" "}
                    {cashierNames[order.created_by] ?? "—"}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                    <OrderStatusBadge status={order.status} />
                    <span className="font-bold tabular-nums text-foreground">
                      {formatBs(order.total_cents)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
