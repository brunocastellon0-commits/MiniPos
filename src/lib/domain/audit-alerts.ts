export interface AuditEntryInput {
  action: string;
  entityId: string | null;
  at: string;
  summary?: unknown;
}

export interface ClosedCashSessionInput {
  closedAt: string | null;
  differenceCents: number | null;
}

export type AuditAlertKind = "voids" | "discounts" | "cash_difference";

export interface AuditAlert {
  kind: AuditAlertKind;
  title: string;
  description: string;
  count: number;
}

export const AUDIT_ALERT_WINDOW_HOURS = 24;
export const AUDIT_ALERT_MIN_VOIDS = 3;
export const AUDIT_ALERT_MIN_DISCOUNTS = 3;
export const AUDIT_ALERT_MIN_CASH_DIFFERENCES = 2;

export function parseAuditSummary(summary: unknown): Record<string, unknown> {
  if (typeof summary === "string") {
    try {
      const parsed: unknown = JSON.parse(summary);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (summary && typeof summary === "object" && !Array.isArray(summary)) {
    return summary as Record<string, unknown>;
  }
  return {};
}

function isDiscountedSale(entry: AuditEntryInput): boolean {
  if (entry.action !== "sales.confirm") return false;
  const discount = parseAuditSummary(entry.summary).discountCents;
  return typeof discount === "number" && discount > 0;
}

function distinctEntityCount(
  entries: readonly AuditEntryInput[],
  since: Date,
  predicate: (entry: AuditEntryInput) => boolean,
): number {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (
      entry.entityId &&
      predicate(entry) &&
      new Date(entry.at).getTime() >= since.getTime()
    ) {
      ids.add(entry.entityId);
    }
  }
  return ids.size;
}

export function computeAuditAlerts(input: {
  entries: readonly AuditEntryInput[];
  closedSessions: readonly ClosedCashSessionInput[];
  now: Date;
}): AuditAlert[] {
  const since = new Date(
    input.now.getTime() - AUDIT_ALERT_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const alerts: AuditAlert[] = [];

  const voids = distinctEntityCount(input.entries, since, (entry) => entry.action === "sales.void");
  if (voids >= AUDIT_ALERT_MIN_VOIDS) {
    alerts.push({
      kind: "voids",
      title: "Anulaciones repetidas",
      description: `${voids} ventas anuladas en las últimas 24 horas. Revisa la bitácora de auditoría.`,
      count: voids,
    });
  }

  const discounts = distinctEntityCount(input.entries, since, isDiscountedSale);
  if (discounts >= AUDIT_ALERT_MIN_DISCOUNTS) {
    alerts.push({
      kind: "discounts",
      title: "Descuentos repetidos",
      description: `${discounts} cobros con descuento en las últimas 24 horas. Revisa la bitácora de auditoría.`,
      count: discounts,
    });
  }

  const differences = input.closedSessions.filter(
    (session) =>
      session.closedAt &&
      new Date(session.closedAt).getTime() >= since.getTime() &&
      session.differenceCents !== null &&
      session.differenceCents !== 0,
  );
  if (differences.length >= AUDIT_ALERT_MIN_CASH_DIFFERENCES) {
    alerts.push({
      kind: "cash_difference",
      title: "Diferencias de caja repetidas",
      description: `${differences.length} cierres con diferencia en las últimas 24 horas. Revisa los turnos.`,
      count: differences.length,
    });
  }

  return alerts;
}
