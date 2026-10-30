export type PaymentMethod = "cash" | "qr" | "card";

export interface CashSaleLike {
  payment_method: PaymentMethod;
  status: "paid" | "voided";
  total_cents: number;
}

export interface CashMovementLike {
  kind: "in" | "out";
  amount_cents: number;
}

export interface ExpectedCashInput {
  openingCents: number;
  sales: CashSaleLike[];
  movements: CashMovementLike[];
}

export interface SalesByPayment {
  cashCents: number;
  qrCents: number;
  cardCents: number;
  totalCents: number;
  count: number;
}

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} debe ser un monto entero en centavos.`);
  }
}

export function expectedCashCents(input: ExpectedCashInput): number {
  assertInteger(input.openingCents, "El saldo inicial");

  let expected = input.openingCents;

  for (const sale of input.sales) {
    assertInteger(sale.total_cents, "El total de la venta");
    if (sale.status === "paid" && sale.payment_method === "cash") {
      expected += sale.total_cents;
    }
  }

  for (const movement of input.movements) {
    assertInteger(movement.amount_cents, "El monto del movimiento");
    expected += movement.kind === "in" ? movement.amount_cents : -movement.amount_cents;
  }

  return expected;
}

export function cashDifferenceCents(countedCents: number, expectedCents: number): number {
  assertInteger(countedCents, "El efectivo contado");
  assertInteger(expectedCents, "El efectivo esperado");
  return countedCents - expectedCents;
}

export type CashDifferenceStatus = "short" | "over" | "exact";

export function classifyCashDifference(differenceCents: number): CashDifferenceStatus {
  assertInteger(differenceCents, "La diferencia de caja");
  if (differenceCents < 0) return "short";
  if (differenceCents > 0) return "over";
  return "exact";
}

export function summarizeSalesByPayment(sales: CashSaleLike[]): SalesByPayment {
  const summary: SalesByPayment = {
    cashCents: 0,
    qrCents: 0,
    cardCents: 0,
    totalCents: 0,
    count: 0,
  };

  for (const sale of sales) {
    assertInteger(sale.total_cents, "El total de la venta");
    if (sale.status !== "paid") continue;

    summary.count += 1;
    summary.totalCents += sale.total_cents;

    if (sale.payment_method === "cash") summary.cashCents += sale.total_cents;
    else if (sale.payment_method === "qr") summary.qrCents += sale.total_cents;
    else summary.cardCents += sale.total_cents;
  }

  return summary;
}
