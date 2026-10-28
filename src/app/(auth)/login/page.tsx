import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Iniciar sesión | LILA MARKET",
  description: "Ingreso al sistema de gestión comercial LILA MARKET",
};

export default async function LoginPage() {
  let businessName = "LILA MARKET";
  let logoUrl: string | null = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("business_settings")
      .select("name, logo_url")
      .eq("id", 1)
      .maybeSingle();

    if (data?.name) {
      businessName = data.name;
    }
    if (data?.logo_url) {
      logoUrl = data.logo_url;
    }
  } catch {
    // Si no hay conexión o no está configurado, usamos los valores por defecto de LILA MARKET
  }

  return <LoginForm businessName={businessName} logoUrl={logoUrl} />;
}
