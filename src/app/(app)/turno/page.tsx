import type { Metadata } from "next";
import { TurnoClient } from "@/components/cash/turno-client";
import { getCashOverviewAction, listCashSessionsAction } from "@/lib/actions/cash";
import { requireUser } from "@/lib/auth";
import type { CashOverview } from "@/lib/actions/cash-core";
import type { CashSession } from "@/lib/repos/types";

export const metadata: Metadata = {
  title: "Turno",
  description: "Apertura, movimientos, cierre e historial del turno de caja.",
};

export default async function TurnoPage() {
  await requireUser("/login");

  let initialOverview: CashOverview | null = null;
  let initialHistory: CashSession[] = [];
  let initialError: string | undefined;

  try {
    const [overviewResult, historyResult] = await Promise.all([
      getCashOverviewAction(),
      listCashSessionsAction({ limit: 30 }),
    ]);

    if (overviewResult.ok) initialOverview = overviewResult.data;
    else initialError = overviewResult.message;

    if (historyResult.ok) initialHistory = historyResult.data;
  } catch {
    initialError = "No se pudo cargar el turno. Recarga la página.";
  }

  return (
    <TurnoClient
      initialOverview={initialOverview}
      initialHistory={initialHistory}
      initialError={initialError}
    />
  );
}
