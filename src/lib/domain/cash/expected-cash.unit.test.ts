import { describe, expect, it } from "vitest";
import {
  cashDifferenceCents,
  classifyCashDifference,
  expectedCashCents,
  summarizeSalesByPayment,
  type CashMovementLike,
  type CashSaleLike,
} from "../cash";

function sale(
  totalCents: number,
  paymentMethod: CashSaleLike["payment_method"] = "cash",
  status: CashSaleLike["status"] = "paid",
): CashSaleLike {
  return { total_cents: totalCents, payment_method: paymentMethod, status };
}

function movement(kind: CashMovementLike["kind"], amountCents: number): CashMovementLike {
  return { kind, amount_cents: amountCents };
}

describe("efectivo esperado (E3-03)", () => {
  it("suma apertura, ventas en efectivo, ingresos y resta egresos", () => {
    const expected = expectedCashCents({
      openingCents: 10000,
      sales: [sale(2500), sale(1500)],
      movements: [movement("in", 2000), movement("out", 500)],
    });

    expect(expected).toBe(15500);
  });

  it("excluye ventas anuladas y pagos QR/tarjeta del efectivo físico", () => {
    const expected = expectedCashCents({
      openingCents: 10000,
      sales: [
        sale(2500, "cash"),
        sale(9999, "cash", "voided"),
        sale(3000, "qr"),
        sale(4000, "card"),
      ],
      movements: [],
    });

    expect(expected).toBe(12500);
  });

  it("calcula la diferencia sin autoajustar y permite faltante o sobrante", () => {
    expect(cashDifferenceCents(14500, 15500)).toBe(-1000);
    expect(cashDifferenceCents(16000, 15500)).toBe(500);
    expect(classifyCashDifference(-1000)).toBe("short");
    expect(classifyCashDifference(500)).toBe("over");
    expect(classifyCashDifference(0)).toBe("exact");
  });

  it("resume ventas pagadas por método de pago", () => {
    const summary = summarizeSalesByPayment([
      sale(2500, "cash"),
      sale(3000, "qr"),
      sale(4000, "card"),
      sale(9999, "cash", "voided"),
    ]);

    expect(summary).toEqual({
      cashCents: 2500,
      qrCents: 3000,
      cardCents: 4000,
      totalCents: 9500,
      count: 3,
    });
  });

  it("rechaza montos que no son centavos enteros", () => {
    expect(() => expectedCashCents({ openingCents: 10.5, sales: [], movements: [] })).toThrow(
      RangeError,
    );
    expect(() => cashDifferenceCents(10000.25, 10000)).toThrow(RangeError);
  });
});
