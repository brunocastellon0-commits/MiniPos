import type { Metadata } from "next";
import { AuditView } from "@/components/audit/audit-view";
import type { AuditEntryView } from "@/lib/actions/audit-core";
import { getAuditAlertsAction, listAuditLogAction } from "@/lib/actions/audit";
import type { AuditAlert } from "@/lib/domain/audit-alerts";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Auditoría",
  description: "Bitácora de auditoría y alertas del minimarket.",
};

export default async function AuditoriaPage() {
  await requireRole("owner", "/caja");

  let entries: AuditEntryView[] = [];
  let alerts: AuditAlert[] = [];
  try {
    const [entriesResult, alertsResult] = await Promise.all([
      listAuditLogAction(),
      getAuditAlertsAction(),
    ]);
    if (entriesResult.ok) {
      entries = entriesResult.data;
    }
    if (alertsResult.ok) {
      alerts = alertsResult.data;
    }
  } catch {
    // Si falla la consulta inicial, inicializa vacío
    entries = [];
    alerts = [];
  }

  return <AuditView entries={entries} alerts={alerts} />;
}
