import type { Metadata } from "next";
import { ReportsView } from "@/components/reports/reports-view";
import { getReportsDataAction } from "@/lib/actions/reports";
import type { ReportsRangeInput } from "@/lib/actions/reports-schema";
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
  try {
    const result = await getReportsDataAction(range);
    if (result.ok) {
      initialData = result.data;
    } else {
      initialError = result.message;
    }
  } catch {
    initialError = "No se pudieron cargar los reportes.";
  }

  return (
    <ReportsView initialRange={range} initialData={initialData} initialError={initialError} />
  );
}
