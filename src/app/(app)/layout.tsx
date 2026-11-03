import type { Metadata } from "next";
import { AppLayoutClient } from "@/components/layout/app-layout-client";
import { getOpenCashSessionAction, listCashSessionsAction } from "@/lib/actions/cash";
import { listInventoryProductsAction } from "@/lib/actions/inventory";
import { getBusinessPublicAction } from "@/lib/actions/settings";
import { requireUser } from "@/lib/auth";
import { buildDashboardNotifications, type DashboardNotification } from "@/lib/domain/dashboard";
import { countLowStock } from "@/lib/domain/inventory";
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
  let logoUrl: string | null = null;
  let cashSession: OpenCashSessionPublic | null = null;
  let lowStockCount = 0;
  let notifications: DashboardNotification[] | null = null;

  try {
    const publicSettingsResult = await getBusinessPublicAction();
    if (publicSettingsResult.ok) {
      businessName = publicSettingsResult.data.name;
      logoUrl = publicSettingsResult.data.logo_url;
    }

    const openSessionResult = await getOpenCashSessionAction();
    if (openSessionResult.ok) {
      cashSession = openSessionResult.data;
    }

    if (user.role === "owner") {
      const [inventoryResult, sessionsResult] = await Promise.all([
        listInventoryProductsAction(),
        listCashSessionsAction({ limit: 20 }),
      ]);
      if (inventoryResult.ok) {
        lowStockCount = countLowStock(inventoryResult.data.filter((product) => product.active));
      }
      const sessions = sessionsResult.ok ? sessionsResult.data : [];
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
      logoUrl={logoUrl}
      cashSession={cashSession}
      lowStockCount={lowStockCount}
      notifications={notifications}
    >
      {children}
    </AppLayoutClient>
  );
}
