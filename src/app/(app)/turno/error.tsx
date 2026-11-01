"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TurnoError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-danger/30 bg-danger/10 p-8 text-center">
      <AlertCircle className="h-8 w-8 text-danger" aria-hidden="true" />
      <div>
        <h2 className="text-base font-semibold text-foreground">No se pudo cargar el turno</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Revisa tu conexión e intenta de nuevo.
        </p>
      </div>
      <Button variant="secondary" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
