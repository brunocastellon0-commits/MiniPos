import type { Metadata } from "next";
import { AppLayoutClient } from "@/components/layout/app-layout-client";
import { getOpenCashSessionAction, listCashSessionsAction } from "@/lib/actions/cash";
import { countLowStockAction } from "@/lib/actions/inventory";
import { getBusinessPublicAction } from "@/lib/actions/settings";
import { requireUser } from "@/lib/auth";
import { buildDashboardNotifications, type DashboardNotification } from "@/lib/domain/dashboard";
import type { OpenCashSessionPublic } from "@/lib/repos/types";

export const metadata: Metadata = {
  title: {
    template: "%s | LILA MARKET",
    default: "LILA MARKET",
  },
  description: "Sistema de gestión comercial para minimarkets",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/login");

  let businessName = "LILA MARKET";
  let operatingMode: "micromarket" | "restaurant" = "micromarket";
  let cashSession: OpenCashSessionPublic | null = null;
  let lowStockCount = 0;
  let notifications: DashboardNotification[] | null = null;

  const isOwner = user.role === "owner";

  try {
    const [publicSettingsResult, openSessionResult, lowStockResult, sessionsResult] =
      await Promise.all([
        getBusinessPublicAction(),
        getOpenCashSessionAction(),
        isOwner ? countLowStockAction() : Promise.resolve(null),
        isOwner ? listCashSessionsAction({ limit: 20 }) : Promise.resolve(null),
      ]);

    if (publicSettingsResult.ok) {
      businessName = publicSettingsResult.data.name;
      operatingMode = publicSettingsResult.data.operating_mode;
    }
    if (openSessionResult.ok) {
      cashSession = openSessionResult.data;
    }

    if (isOwner) {
      if (lowStockResult?.ok) {
        lowStockCount = lowStockResult.data;
      }
      const sessions = sessionsResult?.ok ? sessionsResult.data : [];
      const openFromSessions = sessions.find((session) => session.status === "open");
      const lastClosed = sessions.find((session) => session.status === "closed");
      notifications = buildDashboardNotifications({
        lowStockCount,
        openSessionOpenedAt: cashSession?.opened_at ?? openFromSessions?.opened_at ?? null,
        lastClosedSession: lastClosed,
        now: new Date(),
      });
    }
  } catch {
    // Si falla o estamos en entorno sin BD activa, usamos valores por defecto seguros
  }

  return (
    <AppLayoutClient
      user={user}
      businessName={businessName}
      cashSession={cashSession}
      lowStockCount={lowStockCount}
      notifications={notifications}
      operatingMode={operatingMode}
    >
      {children}
    </AppLayoutClient>
  );
}
