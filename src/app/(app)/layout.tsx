import type { Metadata } from "next";
import { AppLayoutClient } from "@/components/layout/app-layout-client";
import { getOpenCashSessionAction } from "@/lib/actions/cash";
import { requireUser } from "@/lib/auth";
import type { OpenCashSessionPublic } from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";

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

  try {
    const supabase = await createClient();

    const { data: settings } = await supabase
      .from("business_settings")
      .select("name, logo_url")
      .eq("id", 1)
      .maybeSingle();

    if (settings?.name) {
      businessName = settings.name;
    }
    if (settings?.logo_url) {
      logoUrl = settings.logo_url;
    }

    const openSessionResult = await getOpenCashSessionAction();
    if (openSessionResult.ok) {
      cashSession = openSessionResult.data;
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
    >
      {children}
    </AppLayoutClient>
  );
}
