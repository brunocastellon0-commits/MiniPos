import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Caja (POS)",
};

export default function CajaPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Caja (Punto de Venta)</h1>
      <p className="text-sm text-muted">Módulo de ventas en mostrador y cobro rápido.</p>
    </div>
  );
}
