import { describe, expect, it } from "vitest";
import {
  buildDashboardNotifications,
  compareSalesDays,
  lastDayKeys,
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
