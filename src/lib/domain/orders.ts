export const ORDER_STATUSES = [
  "pendiente",
  "en_preparacion",
  "listo",
  "entregado",
  "cancelado",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderPaymentStatus = "pendiente" | "pagado";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pendiente: "en_preparacion",
  en_preparacion: "listo",
  listo: "entregado",
};

export function canTransitionOrder(
  from: OrderStatus,
  to: OrderStatus,
  paymentStatus: OrderPaymentStatus,
): boolean {
  if (paymentStatus === "pagado") return false;
  if (to === "cancelado") return from !== "cancelado";
  if (from === "cancelado") return false;
  return NEXT_STATUS[from] === to;
}

export function isOrderChargeable(
  status: OrderStatus,
  paymentStatus: OrderPaymentStatus,
): boolean {
  return paymentStatus === "pendiente" && status !== "cancelado";
}
