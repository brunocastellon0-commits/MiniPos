"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RouteError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Nunca se muestra error.message: puede contener detalles internos (p. ej. de Postgres).
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div
        role="alert"
        className="flex w-full max-w-md flex-col items-center gap-3 rounded-card border border-danger/30 bg-danger/10 p-8 text-center"
      >
        <AlertTriangle className="h-8 w-8 text-danger" aria-hidden="true" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Algo salió mal</h1>
          <p className="mt-1 text-sm text-muted">
            No pudimos completar la operación. Tus datos no se perdieron; vuelve a intentar.
          </p>
        </div>
        <Button variant="secondary" onClick={reset}>
          Reintentar
        </Button>
      </div>
    </div>
  );
}
