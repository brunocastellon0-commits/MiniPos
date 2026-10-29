import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Panel del Dueño",
};

export default async function PanelPage() {
  await requireRole("owner");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Panel de Control</h1>
      <p className="text-sm text-muted">Resumen operativo y comercial del minimarket.</p>
    </div>
  );
}
