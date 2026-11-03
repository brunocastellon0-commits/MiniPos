import type { Metadata } from "next";
import Link from "next/link";
import { BusinessSettingsView } from "@/components/settings/business-settings-view";
import { getBusinessSettingsAction } from "@/lib/actions/settings";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Configuración",
  description: "Datos del negocio, marca y preferencias de operación.",
};

export default async function ConfiguracionPage() {
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuración</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Datos del negocio, marca y preferencias de operación.
          </p>
        </div>
        <Link
          href="/configuracion/asistente"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Asistente de configuración inicial
        </Link>
      </div>

      <BusinessSettingsView initialSettings={settings} />
    </div>
  );
}
