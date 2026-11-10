import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Iniciar sesión | LILA MARKET",
  description: "Ingreso al sistema de gestión comercial LILA MARKET",
};

export default async function LoginPage() {
  let businessName = "LILA MARKET";

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("business_settings")
      .select("name")
      .maybeSingle();

    
    if (data?.name) {
      businessName = data.name;
    }
  } catch {
    // Si no hay conexión o no está configurado, usamos los valores por defecto de LILA MARKET
  }

  return <LoginForm businessName={businessName} />;
}
