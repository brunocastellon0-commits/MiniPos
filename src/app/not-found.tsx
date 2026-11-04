"use client";

import { FileQuestion } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-card border border-border bg-surface p-8 text-center">
        <FileQuestion className="h-8 w-8 text-muted" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-muted">404</p>
          <h1 className="mt-1 text-lg font-semibold text-foreground">Página no encontrada</h1>
          <p className="mt-1 text-sm text-muted">
            La página que buscas no existe o fue movida de lugar.
          </p>
        </div>
        <Button onClick={() => router.push("/panel")}>Volver al panel</Button>
      </div>
    </div>
  );
}
