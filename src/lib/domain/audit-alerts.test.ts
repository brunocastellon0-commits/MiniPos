import { describe, expect, it } from "vitest";
import {
  AUDIT_ALERT_MIN_CASH_DIFFERENCES,
  AUDIT_ALERT_MIN_DISCOUNTS,
  AUDIT_ALERT_MIN_VOIDS,
  computeAuditAlerts,
  parseAuditSummary,
  type AuditEntryInput,
} from "./audit-alerts";

const NOW = new Date("2026-11-03T12:00:00.000Z");

function isoHoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function voidEntry(entityId: string, hoursAgo = 1): AuditEntryInput {
  return { action: "sales.void", entityId, at: isoHoursAgo(hoursAgo), summary: {} };
}

function confirmEntry(
  entityId: string,
  discountCents: number,
  hoursAgo = 1,
): AuditEntryInput {
  return {
    action: "sales.confirm",
    entityId,
    at: isoHoursAgo(hoursAgo),
    summary: { discountCents },
  };
}

describe("computeAuditAlerts (E11-08)", () => {
  it("no alerta por debajo de los umbrales", () => {
    const alerts = computeAuditAlerts({
      entries: [voidEntry("s1"), voidEntry("s2"), confirmEntry("x1", 500), confirmEntry("x2", 300)],
      closedSessions: [{ closedAt: isoHoursAgo(2), differenceCents: -100 }],
      now: NOW,
    });

    expect(alerts).toEqual([]);
    expect(AUDIT_ALERT_MIN_VOIDS).toBeGreaterThanOrEqual(3);
    expect(AUDIT_ALERT_MIN_DISCOUNTS).toBeGreaterThanOrEqual(3);
    expect(AUDIT_ALERT_MIN_CASH_DIFFERENCES).toBeGreaterThanOrEqual(2);
  });

  it("alerta por anulaciones repetidas: ventas distintas >= 3 en 24 h", () => {
    const alerts = computeAuditAlerts({
      entries: [
        voidEntry("s1"),
        voidEntry("s2"),
        voidEntry("s3"),
        voidEntry("s1"),
        voidEntry("s4", 48),
      ],
      closedSessions: [],
      now: NOW,
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.kind).toBe("voids");
    expect(alerts[0]?.count).toBe(3);
    expect(alerts[0]?.title).toBe("Anulaciones repetidas");
  });

  it("cuenta solo los cobros con descuento mayor a cero", () => {
    const alerts = computeAuditAlerts({
      entries: [
        confirmEntry("x1", 500),
        confirmEntry("x2", 300),
        confirmEntry("x3", 100),
        confirmEntry("x4", 0),
        confirmEntry("x5", 0),
      ],
      closedSessions: [],
      now: NOW,
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.kind).toBe("discounts");
    expect(alerts[0]?.count).toBe(3);
  });

  it("alerta por diferencias de caja repetidas: cierres distintos >= 2 en 24 h", () => {
    const alerts = computeAuditAlerts({
      entries: [],
      closedSessions: [
        { closedAt: isoHoursAgo(1), differenceCents: -100 },
        { closedAt: isoHoursAgo(5), differenceCents: 250 },
        { closedAt: isoHoursAgo(3), differenceCents: 0 },
        { closedAt: null, differenceCents: null },
      ],
      now: NOW,
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.kind).toBe("cash_difference");
    expect(alerts[0]?.count).toBe(2);
  });

  it("ignora eventos anteriores a la ventana de 24 horas", () => {
    const alerts = computeAuditAlerts({
      entries: [voidEntry("s1", 30), voidEntry("s2", 31), voidEntry("s3", 32)],
      closedSessions: [
        { closedAt: isoHoursAgo(30), differenceCents: -100 },
        { closedAt: isoHoursAgo(31), differenceCents: 100 },
      ],
      now: NOW,
    });

    expect(alerts).toEqual([]);
  });

  it("devuelve las alertas en orden estable: anulaciones, descuentos, caja", () => {
    const alerts = computeAuditAlerts({
      entries: [voidEntry("s1"), voidEntry("s2"), voidEntry("s3"), confirmEntry("x1", 500), confirmEntry("x2", 300), confirmEntry("x3", 200)],
      closedSessions: [
        { closedAt: isoHoursAgo(1), differenceCents: -100 },
        { closedAt: isoHoursAgo(2), differenceCents: 100 },
      ],
      now: NOW,
    });

    expect(alerts.map((alert) => alert.kind)).toEqual(["voids", "discounts", "cash_difference"]);
  });
});

describe("parseAuditSummary", () => {
  it("acepta objetos JSON (Supabase)", () => {
    expect(parseAuditSummary({ discountCents: 500 })).toEqual({ discountCents: 500 });
  });

  it("acepta cadenas JSON (repositorio en memoria)", () => {
    expect(parseAuditSummary('{"discountCents":500}')).toEqual({ discountCents: 500 });
  });

  it("devuelve objeto vacío ante JSON inválido o valores no objetos", () => {
    expect(parseAuditSummary("no es json")).toEqual({});
    expect(parseAuditSummary(null)).toEqual({});
    expect(parseAuditSummary(42)).toEqual({});
    expect(parseAuditSummary('["a"]')).toEqual({});
  });
});
