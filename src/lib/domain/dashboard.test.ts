import { describe, expect, it } from "vitest";
import {
  buildDashboardNotifications,
  buildPanelComparison,
  compareSalesDays,
  estimateGrossMargin,
  lastDayKeys,
  summarizeDayMovements,
  summarizeSalesByDay,
  summarizeSalesDay,
  type DashboardSale,
} from "./dashboard";

function sale(overrides: Partial<DashboardSale> = {}): DashboardSale {
  return {
    status: "paid",
    subtotal_cents: 1000,
    discount_cents: 0,
    total_cents: 1000,
    created_at: "2026-11-03T15:00:00.000Z",
    ...overrides,
  };
}

describe("dashboard - resumen diario de ventas (E8-01)", () => {
  it("suma solo ventas pagadas: bruto, descuento, cobrado y transacciones", () => {
    const stats = summarizeSalesDay([
      sale({ subtotal_cents: 1500, discount_cents: 100, total_cents: 1400 }),
      sale({ subtotal_cents: 800, discount_cents: 0, total_cents: 800 }),
      sale({ status: "voided", subtotal_cents: 9999, total_cents: 9999 }),
    ]);

    expect(stats.grossCents).toBe(2300);
    expect(stats.discountCents).toBe(100);
    expect(stats.totalCents).toBe(2200);
    expect(stats.transactionCount).toBe(2);
    expect(stats.voidedCount).toBe(1);
    expect(stats.averageTicketCents).toBe(1100);
  });

  it("redondea el ticket promedio a centavos enteros", () => {
    const stats = summarizeSalesDay([
      sale({ total_cents: 334, subtotal_cents: 334 }),
      sale({ total_cents: 333, subtotal_cents: 333 }),
      sale({ total_cents: 333, subtotal_cents: 333 }),
    ]);

    expect(stats.averageTicketCents).toBe(333);
  });

  it("sin ventas el ticket promedio es null (dato insuficiente, nunca 0 engañoso)", () => {
    const stats = summarizeSalesDay([]);

    expect(stats.transactionCount).toBe(0);
    expect(stats.totalCents).toBe(0);
    expect(stats.averageTicketCents).toBeNull();
    expect(stats.voidedCount).toBe(0);
  });
});

describe("dashboard - comparación vs. mismo día de la semana anterior (E8-01)", () => {
  it("compara cobrado y transacciones contra el día anterior de la semana", () => {
    const comparison = compareSalesDays(
      [
        sale({ total_cents: 150, subtotal_cents: 150 }),
        sale({ total_cents: 150, subtotal_cents: 150 }),
        sale({ total_cents: 150, subtotal_cents: 150 }),
      ],
      [
        sale({ total_cents: 100, subtotal_cents: 100 }),
        sale({ total_cents: 100, subtotal_cents: 100 }),
      ],
    );

    expect(comparison.current.totalCents).toBe(450);
    expect(comparison.previous?.totalCents).toBe(200);
    expect(comparison.totalCentsChangePercent).toBe(125);
    expect(comparison.transactionCountChangePercent).toBe(50);
  });

  it("sin ventas el día anterior devuelve null (se muestra «—», no 0)", () => {
    const comparison = compareSalesDays([sale()], []);

    expect(comparison.previous).toBeNull();
    expect(comparison.totalCentsChangePercent).toBeNull();
    expect(comparison.transactionCountChangePercent).toBeNull();
  });

  it("caída a cero respecto a un día con ventas sí es -100 (dato real)", () => {
    const comparison = compareSalesDays(
      [],
      [sale({ total_cents: 500, subtotal_cents: 500 })],
    );

    expect(comparison.current.transactionCount).toBe(0);
    expect(comparison.totalCentsChangePercent).toBe(-100);
    expect(comparison.transactionCountChangePercent).toBe(-100);
  });

  it("ignora las anuladas en ambos días", () => {
    const comparison = compareSalesDays(
      [sale({ status: "voided" }), sale({ total_cents: 100, subtotal_cents: 100 })],
      [sale({ status: "voided" }), sale({ total_cents: 100, subtotal_cents: 100 })],
    );

    expect(comparison.current.transactionCount).toBe(1);
    expect(comparison.current.voidedCount).toBe(1);
    expect(comparison.totalCentsChangePercent).toBe(0);
  });
});

describe("dashboard - serie por día en zona La Paz (E8-01/E8-02)", () => {
  it("agrupa por día de La Paz y deja ceros en los días sin ventas", () => {
    const keys = ["2026-11-01", "2026-11-02", "2026-11-03"];
    const series = summarizeSalesByDay(
      [
        // 02:00 UTC del 3 = 22:00 del 2 en La Paz (UTC-4)
        sale({ created_at: "2026-11-03T02:00:00.000Z", total_cents: 700, subtotal_cents: 700 }),
        sale({ created_at: "2026-11-03T18:00:00.000Z", total_cents: 300, subtotal_cents: 300 }),
        sale({
          created_at: "2026-11-03T18:00:00.000Z",
          status: "voided",
          total_cents: 9999,
          subtotal_cents: 9999,
        }),
      ],
      keys,
    );

    expect(series["2026-11-01"]!).toEqual({
      grossCents: 0,
      discountCents: 0,
      totalCents: 0,
      transactionCount: 0,
      voidedCount: 0,
      voidedCents: 0,
      averageTicketCents: null,
    });
    expect(series["2026-11-02"]!.totalCents).toBe(700);
    expect(series["2026-11-02"]!.transactionCount).toBe(1);
    expect(series["2026-11-03"]!.totalCents).toBe(300);
    expect(series["2026-11-03"]!.voidedCount).toBe(1);
    expect(series["2026-11-03"]!.averageTicketCents).toBe(300);
  });

  it("ignora ventas de días fuera de la ventana pedida", () => {
    const series = summarizeSalesByDay(
      [sale({ created_at: "2026-10-01T12:00:00.000Z", total_cents: 500, subtotal_cents: 500 })],
      ["2026-11-03"],
    );

    expect(series["2026-11-03"]!.totalCents).toBe(0);
  });

  it("genera las claves de día La Paz para la ventana solicitada", () => {
    const keys = lastDayKeys(new Date("2026-11-03T16:00:00.000Z"), 7);

    expect(keys).toEqual([
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
  });
});

describe("dashboard - notificaciones del panel (E8-03)", () => {
  const now = new Date("2026-11-03T16:00:00.000Z");

  it("avisa de stock bajo con el conteo correcto y enlace al inventario", () => {
    const [first] = buildDashboardNotifications({ lowStockCount: 3, now });

    expect(first).toEqual({
      kind: "low_stock",
      title: "Stock bajo",
      description: "3 productos requieren reposición",
      href: "/inventario",
    });

    const [only] = buildDashboardNotifications({ lowStockCount: 1, now });
    expect(only?.description).toBe("1 producto requiere reposición");
  });

  it("avisa de diferencia de caja solo cuando la última cerrada no cuadró", () => {
    const withDifference = buildDashboardNotifications({
      lowStockCount: 0,
      lastClosedSession: { closed_at: "2026-11-02T22:00:00.000Z", difference_cents: -150 },
      now,
    });
    expect(withDifference).toHaveLength(1);
    expect(withDifference[0]).toEqual({
      kind: "cash_difference",
      title: "Diferencia de caja",
      description: "La última caja cerrada quedó en -Bs 1,50",
      href: "/turno",
    });

    expect(
      buildDashboardNotifications({
        lowStockCount: 0,
        lastClosedSession: { closed_at: "2026-11-02T22:00:00.000Z", difference_cents: 0 },
        now,
      }),
    ).toEqual([]);
    expect(
      buildDashboardNotifications({
        lowStockCount: 0,
        lastClosedSession: { closed_at: "2026-11-02T22:00:00.000Z", difference_cents: null },
        now,
      }),
    ).toEqual([]);
  });

  it("avisa cuando la caja sigue abierta desde el día anterior", () => {
    const notifications = buildDashboardNotifications({
      lowStockCount: 0,
      openSessionOpenedAt: "2026-11-02T12:00:00.000Z",
      now,
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.kind).toBe("stale_open_session");
    expect(notifications[0]?.href).toBe("/caja");
    expect(notifications[0]?.description).toContain("02/11/2026");
  });

  it("no avisa de caja abierta si se abrió hoy", () => {
    expect(
      buildDashboardNotifications({
        lowStockCount: 0,
        openSessionOpenedAt: "2026-11-03T12:00:00.000Z",
        now,
      }),
    ).toEqual([]);
  });

  it("ordena las notificaciones y devuelve vacío cuando no hay nada", () => {
    const notifications = buildDashboardNotifications({
      lowStockCount: 2,
      openSessionOpenedAt: "2026-11-01T12:00:00.000Z",
      lastClosedSession: { closed_at: "2026-10-31T22:00:00.000Z", difference_cents: 300 },
      now,
    });

    expect(notifications.map((item) => item.kind)).toEqual([
      "low_stock",
      "cash_difference",
      "stale_open_session",
    ]);
    expect(buildDashboardNotifications({ lowStockCount: 0, now })).toEqual([]);
  });
});

describe("dashboard - comparativa del panel hoy/ayer/semana (D7)", () => {
  const today = [sale({ total_cents: 19500, subtotal_cents: 19500 })];
  const yesterday = [
    sale({ total_cents: 10000, subtotal_cents: 10000, created_at: "2026-11-02T14:00:00.000Z" }),
  ];
  const weekAgo = [
    sale({ total_cents: 5000, subtotal_cents: 5000, created_at: "2026-10-27T14:00:00.000Z" }),
  ];

  it("calcula los porcentajes contra ayer y contra la semana pasada", () => {
    const comparison = buildPanelComparison(today, yesterday, weekAgo);

    expect(comparison.today.totalCents).toBe(19500);
    expect(comparison.yesterday?.totalCents).toBe(10000);
    expect(comparison.weekAgo?.totalCents).toBe(5000);
    expect(comparison.vsYesterdayPercent).toBe(95);
    expect(comparison.vsWeekAgoPercent).toBe(290);
  });

  it("usa null (no 0) cuando no hay ventas que comparar", () => {
    const comparison = buildPanelComparison([], [], []);

    expect(comparison.yesterday).toBeNull();
    expect(comparison.weekAgo).toBeNull();
    expect(comparison.vsYesterdayPercent).toBeNull();
    expect(comparison.vsWeekAgoPercent).toBeNull();
  });

  it("el porcentaje es null si el día anterior no tuvo transacciones", () => {
    const comparison = buildPanelComparison(today, [sale({ status: "voided" })], []);

    expect(comparison.yesterday).toBeNull();
    expect(comparison.vsYesterdayPercent).toBeNull();
  });
});

describe("dashboard - margen bruto estimado (D7)", () => {
  const item = (productId: string | null, quantity: number, lineTotal: number) => ({
    product_id: productId,
    quantity,
    line_total_cents: lineTotal,
  });

  it("devuelve null sin ítems o sin costos registrados (nunca inventa ganancia)", () => {
    const costs = new Map([["p-1", 700]]);

    expect(estimateGrossMargin([], costs)).toBeNull();
    expect(estimateGrossMargin([item("p-1", 1, 1500)], new Map())).toBeNull();
    expect(estimateGrossMargin([item(null, 1, 1500)], costs)).toBeNull();
  });

  it("resta el costo de las unidades vendidas al precio de línea", () => {
    const costs = new Map([
      ["p-1", 700],
      ["p-2", 300],
    ]);

    const margin = estimateGrossMargin([item("p-1", 2, 3000), item("p-2", 1, 800)], costs);

    expect(margin).toEqual({ marginCents: 2100, revenueCents: 3800, costCents: 1700 });
  });

  it("permite margen negativo si se vendió por debajo del costo", () => {
    const margin = estimateGrossMargin([item("p-1", 1, 500)], new Map([["p-1", 900]]));

    expect(margin?.marginCents).toBe(-400);
  });
});

describe("dashboard - ingresos y egresos del día (D7)", () => {
  it("suma solo los movimientos del día en zona La Paz", () => {
    const flow = summarizeDayMovements(
      [
        { kind: "in", amount_cents: 20000, created_at: "2026-11-03T12:00:00.000Z" },
        { kind: "out", amount_cents: 3500, created_at: "2026-11-03T18:30:00.000Z" },
        { kind: "in", amount_cents: 999, created_at: "2026-11-02T23:59:00.000Z" },
        { kind: "out", amount_cents: 100, created_at: "2026-11-04T05:00:00.000Z" },
      ],
      "2026-11-03",
    );

    expect(flow).toEqual({ incomeCents: 20000, expenseCents: 3500 });
  });

  it("devuelve ceros cuando no hay movimientos", () => {
    expect(summarizeDayMovements([], "2026-11-03")).toEqual({
      incomeCents: 0,
      expenseCents: 0,
    });
  });
});
