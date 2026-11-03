import { describe, expect, it } from "vitest";
import {
  dayKeysBetween,
  inventoryValuation,
  leastSellingProducts,
  previousPeriodRange,
  salesDailyReportCsv,
  summarizeClosedCashSessions,
  summarizePurchases,
  topSellingProducts,
} from "./reports";

describe("dayKeysBetween", () => {
  it("genera las claves del rango inclusive", () => {
    expect(dayKeysBetween("2026-11-01", "2026-11-03")).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("devuelve vacío si el inicio es posterior al fin o la clave es inválida", () => {
    expect(dayKeysBetween("2026-11-03", "2026-11-01")).toEqual([]);
    expect(dayKeysBetween("no-fecha", "2026-11-01")).toEqual([]);
  });
});

describe("previousPeriodRange", () => {
  it("devuelve el periodo contiguo de la misma longitud", () => {
    expect(previousPeriodRange("2026-11-04", "2026-11-10")).toEqual({
      dateFrom: "2026-10-28",
      dateTo: "2026-11-03",
    });
  });

  it("soporta periodos de un día", () => {
    expect(previousPeriodRange("2026-11-03", "2026-11-03")).toEqual({
      dateFrom: "2026-11-02",
      dateTo: "2026-11-02",
    });
  });
});

describe("topSellingProducts", () => {
  const items = [
    { product_id: "p1", name_snapshot: "Arroz 1kg", quantity: 3, line_total_cents: 2100 },
    { product_id: "p2", name_snapshot: "Aceite 1L", quantity: 5, line_total_cents: 4500 },
    { product_id: "p1", name_snapshot: "Arroz 1kg", quantity: 1, line_total_cents: 700 },
    { product_id: null, name_snapshot: "Sin código", quantity: 2, line_total_cents: 400 },
  ];

  it("ordena por unidades y luego por cobro, con límite", () => {
    const top = topSellingProducts(items, 2);

    expect(top).toHaveLength(2);
    expect(top[0]).toMatchObject({ productId: "p2", name: "Aceite 1L", units: 5, totalCents: 4500 });
    expect(top[1]).toMatchObject({ productId: "p1", name: "Arroz 1kg", units: 4, totalCents: 2800 });
  });

  it("agrupa ítems sin producto por nombre", () => {
    const top = topSellingProducts(items, 10);

    expect(top.find((row) => row.productId === null)).toMatchObject({
      name: "Sin código",
      units: 2,
      totalCents: 400,
    });
  });
});

describe("leastSellingProducts", () => {
  const products = [
    { id: "p1", name: "Arroz" },
    { id: "p2", name: "Aceite" },
    { id: "p3", name: "Harina" },
  ];
  const items = [
    { product_id: "p1", name_snapshot: "Arroz", quantity: 4, line_total_cents: 2800 },
    { product_id: "p2", name_snapshot: "Aceite", quantity: 1, line_total_cents: 900 },
  ];

  it("incluye los productos nunca vendidos con 0 unidades primero", () => {
    const least = leastSellingProducts(items, products, 3);

    expect(least[0]).toMatchObject({ productId: "p3", name: "Harina", units: 0 });
    expect(least[1]).toMatchObject({ productId: "p2", units: 1 });
    expect(least[2]).toMatchObject({ productId: "p1", units: 4 });
  });

  it("respeta el límite", () => {
    expect(leastSellingProducts(items, products, 1)).toHaveLength(1);
  });
});

describe("inventoryValuation", () => {
  it("valora al costo solo lo registrado y el resto a precio de venta", () => {
    const valuation = inventoryValuation([
      { id: "p1", name: "A", stock_qty: 10, price_cents: 500, cost_cents: 300 },
      { id: "p2", name: "B", stock_qty: 4, price_cents: 1000, cost_cents: null },
      { id: "p3", name: "C", stock_qty: 0, price_cents: 200, cost_cents: 150 },
    ]);

    expect(valuation).toEqual({
      retailValueCents: 10 * 500 + 4 * 1000,
      costValueCents: 10 * 300,
      costedRetailValueCents: 10 * 500,
      costedProductCount: 2,
      uncostedProductCount: 1,
      totalProductCount: 3,
    });
  });

  it("con lista vacía devuelve todo en cero", () => {
    const valuation = inventoryValuation([]);

    expect(valuation.costValueCents).toBe(0);
    expect(valuation.retailValueCents).toBe(0);
    expect(valuation.totalProductCount).toBe(0);
  });
});

describe("summarizePurchases", () => {
  it("suma totales por estado incluyendo los vacíos", () => {
    const summary = summarizePurchases([
      { status: "received", total_cents: 10_000 },
      { status: "received", total_cents: 5_000 },
      { status: "ordered", total_cents: 2_000 },
    ]);

    expect(summary.totalCount).toBe(3);
    expect(summary.totalCents).toBe(17_000);
    expect(summary.byStatus).toHaveLength(5);
    expect(summary.byStatus.find((row) => row.status === "received")).toEqual({
      status: "received",
      count: 2,
      totalCents: 15_000,
    });
    expect(summary.byStatus.find((row) => row.status === "cancelled")).toEqual({
      status: "cancelled",
      count: 0,
      totalCents: 0,
    });
  });
});

describe("summarizeClosedCashSessions", () => {
  it("cuenta solo cierres con diferencia distinta de cero", () => {
    const summary = summarizeClosedCashSessions([
      { status: "closed", closed_at: "2026-11-01T10:00:00.000Z", difference_cents: 150 },
      { status: "closed", closed_at: "2026-11-02T10:00:00.000Z", difference_cents: 0 },
      { status: "closed", closed_at: "2026-11-03T10:00:00.000Z", difference_cents: -200 },
      { status: "open", closed_at: null, difference_cents: null },
    ]);

    expect(summary).toEqual({
      closedCount: 3,
      totalDifferenceCents: -50,
      withDifferenceCount: 2,
    });
  });
});

describe("salesDailyReportCsv", () => {
  it("genera encabezado y filas consistentes con las filas de la pantalla", () => {
    const csv = salesDailyReportCsv([
      {
        dayKey: "2026-11-01",
        transactionCount: 2,
        grossCents: 1500,
        discountCents: 100,
        collectedCents: 1400,
        voidedCount: 1,
        voidedCents: 500,
      },
    ]);

    expect(csv.split("\r\n")[0]).toBe(
      "fecha,transacciones,bruto_bs,descuento_bs,cobrado_bs,anuladas,monto_anulado_bs",
    );
    expect(csv).toContain("2026-11-01,2,15.00,1.00,14.00,1,5.00");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("escapa comas y neutraliza inyección de fórmulas", () => {
    const csv = salesDailyReportCsv([
      {
        dayKey: "=cmd|' /C calc'!A0,1",
        transactionCount: 0,
        grossCents: 0,
        discountCents: 0,
        collectedCents: 0,
        voidedCount: 0,
        voidedCents: 0,
      },
    ]);

    expect(csv).toContain("\"'=cmd|' /C calc'!A0,1\"");
  });

  it("con lista vacía devuelve solo el encabezado", () => {
    const csv = salesDailyReportCsv([]);

    expect(csv.split("\r\n")).toHaveLength(2);
    expect(csv.split("\r\n")[0]).toContain("fecha");
  });
});
