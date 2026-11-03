import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/settings/onboarding-wizard";
import { getBusinessSettingsAction } from "@/lib/actions/settings";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Asistente de configuración",
  description: "Configura negocio, categorías, productos y saldo inicial de caja.",
};

export default async function AsistentePage() {
  await requireRole("owner", "/caja");

  let settings = null;
  let initialError: string | null = null;
  try {
    const result = await getBusinessSettingsAction();
    if (result.ok) {
      settings = result.data;
    } else {
      initialError = result.message;
    }
  } catch {
    initialError = "No se pudo cargar la configuración.";
  }

  if (!settings) {
    return (
      <div
        role="alert"
        className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
      >
        {initialError ?? "No se pudo cargar la configuración."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Asistente de configuración
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Cuatro pasos para dejar tu negocio listo para vender.
        </p>
      </div>

      <OnboardingWizard initialSettings={settings} />
    </div>
  );
}
