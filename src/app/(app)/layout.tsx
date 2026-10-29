import type { Metadata } from "next";
import { AppLayoutClient } from "@/components/layout/app-layout-client";
import { requireUser } from "@/lib/auth";
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
  let cashSessionOpen = false;

  try {
    const supabase = await createClient();

    // Obtener configuración de negocio
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

    // Verificar si hay sesión de caja abierta
    const { data: openSession } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("status", "open")
      .maybeSingle();

    if (openSession) {
      cashSessionOpen = true;
    }
  } catch {
    // Si falla o estamos en entorno sin BD activa, usamos valores por defecto seguros
  }

  return (
    <AppLayoutClient
      user={user}
      businessName={businessName}
      logoUrl={logoUrl}
      cashSessionOpen={cashSessionOpen}
    >
      {children}
    </AppLayoutClient>
  );
}
