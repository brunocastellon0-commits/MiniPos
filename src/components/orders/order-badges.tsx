import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { Order } from "@/lib/repos/types";

export const ORDER_STATUS_LABELS: Record<Order["status"], string> = {
  pendiente: "Pendiente",
  en_preparacion: "En preparación",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const ORDER_STATUS_TONES: Record<Order["status"], BadgeTone> = {
  pendiente: "warning",
  en_preparacion: "info",
  listo: "accent",
  entregado: "success",
  cancelado: "danger",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  qr: "QR",
  card: "Tarjeta",
};

export const ORDER_FLOW_STATUSES = [
  "pendiente",
  "en_preparacion",
  "listo",
  "entregado",
] as const satisfies readonly Order["status"][];

export function OrderStatusBadge({ status }: { status: Order["status"] }) {
  return <Badge tone={ORDER_STATUS_TONES[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function OrderPaymentBadge({ paymentStatus }: { paymentStatus: Order["payment_status"] }) {
  if (paymentStatus === "pagado") {
    return <Badge tone="success">Cobrado</Badge>;
  }
  return <Badge tone="warning">Sin cobrar</Badge>;
}
