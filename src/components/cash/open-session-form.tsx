"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { openCashSessionAction } from "@/lib/actions/cash";
import { toCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface OpenSessionFormProps {
  onOpened: () => void;
}

export function OpenSessionForm({ onOpened }: OpenSessionFormProps) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    let openingCents: number;
    try {
      openingCents = toCents(amount);
    } catch {
      setError("Ingresa un monto válido, por ejemplo 100,00.");
      return;
    }

    if (openingCents < 0) {
      setError("El saldo inicial no puede ser negativo.");
      return;
    }

    setSaving(true);
    try {
      const result = await openCashSessionAction({
        openingCents,
        notes: notes.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setAmount("");
      setNotes("");
      onOpened();
    } catch {
      setError("No se pudo abrir el turno. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Abrir turno de caja</CardTitle>
            <CardDescription>
              Registra el efectivo inicial antes de empezar a vender.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="opening-cents" className="text-sm font-medium text-foreground">
              Saldo inicial en efectivo
            </label>
            <Input
              id="opening-cents"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              invalid={Boolean(error)}
              onChange={(event) => setAmount(event.target.value)}
              aria-describedby={error ? "open-session-error" : undefined}
            />
            <p className="text-xs text-muted">Monto que ya está físicamente en la caja.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="opening-notes" className="text-sm font-medium text-foreground">
              Notas <span className="font-normal text-muted">(opcional)</span>
            </label>
            <Input
              id="opening-notes"
              maxLength={500}
              placeholder="Ej. Turno mañana"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {error ? (
            <p id="open-session-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={saving} disabled={saving}>
            Abrir caja
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
