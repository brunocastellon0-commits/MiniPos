import type { Metadata } from "next";
import { ReportsView, type OperatingMode } from "@/components/reports/reports-view";
import { getReportsDataAction } from "@/lib/actions/reports";
import type { ReportsRangeInput } from "@/lib/actions/reports-schema";
import { getBusinessPublicAction } from "@/lib/actions/settings";
import { requireRole } from "@/lib/auth";
import { laPazDayKey } from "@/lib/dates";
import { lastDayKeys } from "@/lib/domain/dashboard";

export const metadata: Metadata = {
  title: "Reportes",
  description: "Reportes de ventas, productos, inventario y caja del dueño.",
};

export default async function ReportesPage() {
  await requireRole("owner", "/caja");

  const now = new Date();
  const todayKey = laPazDayKey(now);
  const keys = lastDayKeys(now, 7);
  const range: ReportsRangeInput = {
    dateFrom: keys[0] ?? todayKey,
    dateTo: keys[keys.length - 1] ?? todayKey,
  };

  let initialData = null;
  let initialError: string | null = null;
  let settings = null;
  try {
    const [reportsResult, settingsResult] = await Promise.all([
      getReportsDataAction(range),
      // Settings es best-effort: un fallo acá no debe perder el reporte.
      getBusinessPublicAction().catch(() => null),
    ]);
    if (reportsResult.ok) {
      initialData = reportsResult.data;
    } else {
      initialError = reportsResult.message;
    }
    if (settingsResult?.ok) {
      settings = settingsResult.data;
    }
  } catch {
    initialError = "No se pudieron cargar los reportes.";
  }
  const operatingMode: OperatingMode =
    settings?.operating_mode === "restaurant" ? "restaurant" : "micromarket";

  return (
    <ReportsView
      initialRange={range}
      initialData={initialData}
      initialError={initialError}
      operatingMode={operatingMode}
    />
  );
}
