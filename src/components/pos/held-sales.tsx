"use client";

import { useEffect, useState } from "react";
import { deleteHeldSaleAction, listHeldSalesAction } from "@/lib/actions/held-sales";
import type { HeldSale } from "@/lib/repos/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";

export interface HeldSalesDialogProps {
  onClose: () => void;
  onRecovered: (label: string, lines: Array<{ productId: string; quantity: number }>) => void;
}

function parseHeldLines(items: unknown): Array<{ productId: string; quantity: number }> {
  if (!Array.isArray(items)) return [];
  return items
    .filter(
      (line): line is { productId: string; quantity: number } =>
        typeof line === "object" &&
        line !== null &&
        typeof (line as { productId?: unknown }).productId === "string" &&
        typeof (line as { quantity?: unknown }).quantity === "number" &&
        Number.isInteger((line as { quantity: number }).quantity) &&
        (line as { quantity: number }).quantity > 0,
    )
    .map((line) => ({ productId: line.productId, quantity: line.quantity }));
}

export function HeldSalesDialog({ onClose, onRecovered }: HeldSalesDialogProps) {
  const [held, setHeld] = useState<HeldSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listHeldSalesAction()
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setHeld(result.data);
        else setError(result.message);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar las ventas pausadas.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(id: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await deleteHeldSaleAction({ id });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setHeld((current) => current.filter((item) => item.id !== id));
    } catch {
      setError("No se pudo descartar la venta pausada.");
    } finally {
      setBusy(false);
    }
  }

  function handleRecover(item: HeldSale) {
    const lines = parseHeldLines(item.items);
    if (lines.length === 0) {
      setError("La venta pausada no tiene productos válidos.");
      return;
    }
    onRecovered(item.label, lines);
  }

  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Ventas pausadas"
      description="Recupera una venta en espera o descártala."
      footer={
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Cerrar
        </Button>
      }
    >
      {loading ? (
        <p className="text-sm text-muted" role="status">
          Cargando ventas pausadas…
        </p>
      ) : held.length === 0 ? (
        <EmptyState
          title="Sin ventas pausadas"
          description="Pausa una venta para retomarla más tarde."
        />
      ) : (
        <ul className="divide-y divide-border">
          {held.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted">
                  {new Intl.DateTimeFormat("es-BO", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                    timeZone: "America/La_Paz",
                  }).format(new Date(item.created_at))}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" onClick={() => handleRecover(item)} disabled={busy}>
                  Recuperar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(item.id)}
                  disabled={busy}
                >
                  Descartar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

export interface PauseSaleDialogProps {
  onClose: () => void;
  onPaused: () => void;
  onSave: (label: string) => Promise<string | null>;
}

export function PauseSaleDialog({ onClose, onPaused, onSave }: PauseSaleDialogProps) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError("La etiqueta es obligatoria.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const failure = await onSave(trimmed);
      if (failure) {
        setError(failure);
        return;
      }
      onPaused();
    } catch {
      setError("No se pudo pausar la venta.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open
      onClose={() => {
        if (!sending) onClose();
      }}
      title="Pausar venta"
      description="Guarda el carrito para retomarlo más tarde."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button type="submit" form="pause-sale-form" disabled={sending} loading={sending}>
            Pausar
          </Button>
        </>
      }
    >
      <form id="pause-sale-form" className="space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="pause-label" className="text-sm font-medium text-foreground">
            Etiqueta
          </label>
          <Input
            id="pause-label"
            value={label}
            placeholder="Ej. Cliente que va al cajero"
            onChange={(event) => setLabel(event.target.value)}
            disabled={sending}
            invalid={Boolean(error)}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
