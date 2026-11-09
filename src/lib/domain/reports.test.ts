import { describe, expect, it } from "vitest";
import {
  buildBcgMatrix,
  buildCashFlowDaily,
  buildCashFlowMonthly,
  dayKeysBetween,
  inventoryTurnover,
  inventoryValuation,
  leastSellingProducts,
  previousPeriodRange,
  salesByHour,
  salesByWeekday,
  salesDailyReportCsv,
  stockZeroDays,
  summarizeClosedCashSessions,
  summarizePurchases,
  summarizeWaste,
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

describe("salesByHour (Fase F)", () => {
  it("agrupa ventas cobradas por hora de La Paz en 24 filas y excluye anuladas", () => {
    const rows = salesByHour([
      {
        status: "paid",
        payment_method: "cash",
        total_cents: 2500,
        created_at: "2026-11-01T12:00:00.000Z",
      },
      {
        status: "paid",
        payment_method: "card",
        total_cents: 700,
        created_at: "2026-11-01T23:00:00.000Z",
      },
      {
        status: "voided",
        payment_method: "cash",
        total_cents: 900,
        created_at: "2026-11-01T15:00:00.000Z",
      },
    ]);

    expect(rows).toHaveLength(24);
    expect(rows[8]).toEqual({ hour: 8, transactionCount: 1, totalCents: 2500 });
    expect(rows[19]).toEqual({ hour: 19, transactionCount: 1, totalCents: 700 });
    expect(rows.reduce((sum, row) => sum + row.transactionCount, 0)).toBe(2);
  });
});

describe("salesByWeekday (Fase F)", () => {
  it("agrupa por día de la semana con 0 = lunes y excluye anuladas", () => {
    const rows = salesByWeekday([
      {
        status: "paid",
        payment_method: "cash",
        total_cents: 2500,
        created_at: "2026-11-01T12:00:00.000Z",
      },
      {
        status: "paid",
        payment_method: "cash",
        total_cents: 600,
        created_at: "2026-11-02T18:00:00.000Z",
      },
      {
        status: "voided",
        payment_method: "cash",
        total_cents: 900,
        created_at: "2026-11-02T19:00:00.000Z",
      },
    ]);

    expect(rows).toHaveLength(7);
    expect(rows[0]?.label).toBe("Lunes");
    expect(rows[6]).toMatchObject({ label: "Domingo", transactionCount: 1, totalCents: 2500 });
    expect(rows[0]).toMatchObject({ transactionCount: 1, totalCents: 600 });
    expect(rows.reduce((sum, row) => sum + row.transactionCount, 0)).toBe(2);
  });
});

describe("buildCashFlowDaily / buildCashFlowMonthly (Fase F)", () => {
  const dayKeys = dayKeysBetween("2026-11-01", "2026-11-02");

  it("suma solo ventas en efectivo cobradas más movimientos in/out, con acumulado", () => {
    const rows = buildCashFlowDaily(
      [
        {
          status: "paid",
          payment_method: "cash",
          total_cents: 2500,
          created_at: "2026-11-01T12:00:00.000Z",
        },
        {
          status: "paid",
          payment_method: "card",
          total_cents: 700,
          created_at: "2026-11-01T13:00:00.000Z",
        },
        {
          status: "voided",
          payment_method: "cash",
          total_cents: 900,
          created_at: "2026-11-02T19:00:00.000Z",
        },
      ],
      [
        { kind: "in", amount_cents: 500, created_at: "2026-11-01T14:00:00.000Z" },
        { kind: "out", amount_cents: 200, created_at: "2026-11-02T15:00:00.000Z" },
      ],
      dayKeys,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      key: "2026-11-01",
      cashSalesCents: 2500,
      manualInCents: 500,
      inflowCents: 3000,
      outflowCents: 0,
      availabilityCents: 3000,
    });
    expect(rows[1]).toMatchObject({
      key: "2026-11-02",
      cashSalesCents: 0,
      manualOutCents: 200,
      inflowCents: 0,
      outflowCents: 200,
      availabilityCents: 2800,
    });
  });

  it("agrupa el flujo diario en meses conservando el acumulado", () => {
    const monthly = buildCashFlowMonthly([
      {
        key: "2026-10-31",
        cashSalesCents: 1000,
        manualInCents: 100,
        manualOutCents: 50,
        inflowCents: 1100,
        outflowCents: 50,
        netCents: 1050,
        availabilityCents: 1050,
      },
      {
        key: "2026-11-01",
        cashSalesCents: 2000,
        manualInCents: 0,
        manualOutCents: 300,
        inflowCents: 2000,
        outflowCents: 300,
        netCents: 1700,
        availabilityCents: 2750,
      },
    ]);

    expect(monthly).toHaveLength(2);
    expect(monthly[0]).toMatchObject({
      key: "2026-10",
      inflowCents: 1100,
      outflowCents: 50,
      availabilityCents: 1050,
    });
    expect(monthly[1]).toMatchObject({
      key: "2026-11",
      inflowCents: 2000,
      outflowCents: 300,
      availabilityCents: 2750,
    });
  });

  it("con lista vacía devuelve un día en cero", () => {
    const rows = buildCashFlowDaily([], [], dayKeys);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ inflowCents: 0, outflowCents: 0, availabilityCents: 0 });
  });
});

describe("summarizeWaste (Fase F)", () => {
  it("agrupa solo mermas por producto al costo actual y marca sin costo", () => {
    const rows = summarizeWaste(
      [
        { kind: "waste", delta: -2, product_id: "p1", created_at: "2026-11-01T16:00:00.000Z" },
        { kind: "sale", delta: -1, product_id: "p1", created_at: "2026-11-01T12:00:00.000Z" },
        { kind: "waste", delta: -3, product_id: "p2", created_at: "2026-11-02T16:00:00.000Z" },
      ],
      [
        { id: "p1", name: "Coca-Cola", cost_cents: 100 },
        { id: "p2", name: "Pan", cost_cents: null },
      ],
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ productId: "p2", name: "Pan", units: 3, valueCents: null });
    expect(rows[1]).toEqual({ productId: "p1", name: "Coca-Cola", units: 2, valueCents: 200 });
  });
});

describe("inventoryTurnover (Fase F)", () => {
  it("lista solo productos vendidos con existencias y valor al costo", () => {
    const rows = inventoryTurnover(
      [
        { product_id: "p1", name_snapshot: "Arroz", quantity: 3, line_total_cents: 2100 },
        { product_id: "p1", name_snapshot: "Arroz", quantity: 1, line_total_cents: 700 },
        { product_id: "p2", name_snapshot: "Aceite", quantity: 5, line_total_cents: 4500 },
        { product_id: null, name_snapshot: "Sin código", quantity: 2, line_total_cents: 400 },
      ],
      [
        { id: "p1", name: "Arroz", stock_qty: 10, cost_cents: 50 },
        { id: "p2", name: "Aceite", stock_qty: 4, cost_cents: null },
        { id: "p3", name: "Harina", stock_qty: 7, cost_cents: 20 },
      ],
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      productId: "p2",
      name: "Aceite",
      unitsSold: 5,
      stockQty: 4,
      stockValueCents: null,
    });
    expect(rows[1]).toEqual({
      productId: "p1",
      name: "Arroz",
      unitsSold: 4,
      stockQty: 10,
      stockValueCents: 500,
    });
  });
});

describe("stockZeroDays (Fase F)", () => {
  const dayKeys = dayKeysBetween("2026-11-01", "2026-11-02");

  it("reconstruye el stock por día y lista solo los productos con días en cero", () => {
    const rows = stockZeroDays(
      [
        { id: "p0", name: "Agotado", stock_qty: 0 },
        { id: "p1", name: "Disponible", stock_qty: 5 },
        { id: "p2", name: "Reponido", stock_qty: 5 },
      ],
      [
        {
          product_id: "p1",
          delta: -5,
          created_at: "2026-11-01T12:00:00.000Z",
        },
        {
          product_id: "p2",
          delta: 5,
          created_at: "2026-11-02T06:00:00.000Z",
        },
      ],
      dayKeys,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ productId: "p0", name: "Agotado", zeroDays: 2 });
    expect(rows[1]).toEqual({ productId: "p2", name: "Reponido", zeroDays: 1 });
  });

  it("sin claves de día devuelve lista vacía", () => {
    expect(stockZeroDays([{ id: "p0", name: "A", stock_qty: 0 }], [], [])).toEqual([]);
  });
});

describe("buildBcgMatrix (Fase F)", () => {
  const items = [
    { product_id: "a", name_snapshot: "A", quantity: 10, line_total_cents: 10_000 },
    { product_id: "b", name_snapshot: "B", quantity: 10, line_total_cents: 5000 },
    { product_id: "c", name_snapshot: "C", quantity: 1, line_total_cents: 4000 },
    { product_id: "d", name_snapshot: "D", quantity: 1, line_total_cents: 500 },
    { product_id: "e", name_snapshot: "E", quantity: 2, line_total_cents: 200 },
    { product_id: null, name_snapshot: "Sin código", quantity: 1, line_total_cents: 100 },
  ];
  const products = [
    { id: "a", name: "A", cost_cents: 100 },
    { id: "b", name: "B", cost_cents: 490 },
    { id: "c", name: "C", cost_cents: 100 },
    { id: "d", name: "D", cost_cents: 490 },
    { id: "e", name: "E", cost_cents: null },
  ];

  it("clasifica por mediana de volumen y margen en orden de cuadrantes", () => {
    const matrix = buildBcgMatrix(items, products);

    expect(matrix.uncostedCount).toBe(1);
    expect(matrix.rows).toHaveLength(4);
    expect(matrix.rows.map((row) => [row.productId, row.quadrant])).toEqual([
      ["a", "estrella"],
      ["c", "vaca"],
      ["b", "enigma"],
      ["d", "perro"],
    ]);
    expect(matrix.rows[0]?.marginCents).toBe(10_000 - 10 * 100);
  });

  it("sin ventas con costo devuelve filas vacías", () => {
    const matrix = buildBcgMatrix(
      [{ product_id: "e", name_snapshot: "E", quantity: 2, line_total_cents: 200 }],
      products,
    );

    expect(matrix.rows).toEqual([]);
    expect(matrix.uncostedCount).toBe(1);
  });
});
