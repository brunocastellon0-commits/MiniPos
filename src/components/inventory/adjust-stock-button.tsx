"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SlidersHorizontal,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { adjustStockAction } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

export interface AdjustStockButtonProps {
  productId: string;
  productName: string;
  currentStock: number;
}

type MovementType = "in" | "out" | "waste" | "correction";

const MOVEMENT_TYPES: Array<{
  id: MovementType;
  label: string;
  icon: typeof ArrowUpCircle;
  color: string;
  border: string;
  bg: string;
  description: string;
}> = [
  {
    id: "in",
    label: "Entrada",
    icon: ArrowUpCircle,
    color: "text-emerald-700",
    border: "border-emerald-300",
    bg: "bg-emerald-50",
    description: "Ingreso o reposición adicional",
  },
  {
    id: "out",
    label: "Salida",
    icon: ArrowDownCircle,
    color: "text-amber-700",
    border: "border-amber-300",
    bg: "bg-amber-50",
    description: "Retiro sin venta",
  },
  {
    id: "waste",
    label: "Merma",
    icon: Trash2,
    color: "text-red-700",
    border: "border-red-300",
    bg: "bg-red-50",
    description: "Dañado, roto o vencido",
  },
  {
    id: "correction",
    label: "Corrección",
    icon: RotateCcw,
    color: "text-purple-700",
    border: "border-purple-300",
    bg: "bg-purple-50",
    description: "Ajuste por conteo físico",
  },
];

const PREDEFINED_REASONS: Record<MovementType, string[]> = {
  in: ["Compra no registrada", "Devolución de cliente", "Conteo físico (sobrante)", "Otro ingreso"],
  out: ["Uso interno", "Muestra / Degustación", "Retiro por dueño", "Otra salida"],
  waste: ["Producto vencido", "Envase dañado / roto", "Mal estado de fábrica", "Robo / Pérdida"],
  correction: ["Conteo físico de inventario", "Error en registro anterior", "Ajuste inicial"],
};

export function AdjustStockButton({ productId, productName, currentStock }: AdjustStockButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [movementType, setMovementType] = useState<MovementType>("in");
  const [quantity, setQuantity] = useState("");
  const [selectedChip, setSelectedChip] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Cantidad parseada
  const parsedQty = Math.abs(parseInt(quantity, 10)) || 0;

  // Cálculo de delta según el tipo visual
  let calculatedDelta = 0;
  if (movementType === "in") {
    calculatedDelta = parsedQty;
  } else if (movementType === "out" || movementType === "waste") {
    calculatedDelta = -parsedQty;
  } else if (movementType === "correction") {
    // En corrección, el usuario indica la cantidad a sumar o restar
    calculatedDelta = parsedQty;
  }

  const resultingStock = currentStock + calculatedDelta;

  function handleClose() {
    if (submitting) return;
    setOpen(false);
    setMovementType("in");
    setQuantity("");
    setSelectedChip("");
    setNotes("");
    setError(null);
  }

  function handleTypeChange(type: MovementType) {
    setMovementType(type);
    setSelectedChip("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;

    if (parsedQty <= 0) {
      setError("Ingresa una cantidad entera distinta de cero.");
      return;
    }

    const finalReason = selectedChip
      ? notes.trim()
        ? `${selectedChip} — ${notes.trim()}`
        : selectedChip
      : notes.trim();

    if (!finalReason) {
      setError("El motivo es obligatorio: selecciona una sugerencia o escribe el detalle.");
      return;
    }

    // Mapeo a kind de base de datos
    const dbKind = movementType === "waste" ? "waste" : "adjustment";

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const result = await adjustStockAction({
        productId,
        delta: calculatedDelta,
        kind: dbKind,
        reason: finalReason,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setOpen(false);
      setSuccess(true);
      router.refresh();
    } catch {
      setError("No se pudo ajustar el stock.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      {success ? (
        <Toast
          tone="success"
          title="Stock actualizado"
          description={`Las existencias de ${productName} quedaron en ${resultingStock}.`}
        />
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Ajustar stock de ${productName}`}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Ajustar
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        title={`Ajustar inventario — ${productName}`}
        description="Selecciona el tipo de movimiento e indica la cantidad. Los cambios se registran en la auditoría con tu usuario."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="adjust-stock-form"
              variant="primary"
              disabled={submitting}
              loading={submitting}
            >
              {submitting ? "Guardando…" : "Guardar ajuste"}
            </Button>
          </>
        }
      >
        <form id="adjust-stock-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Tarjeta de producto y stock resultante en vivo */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/60 p-3">
            <div>
              <span className="text-xs text-muted">Existencias actuales</span>
              <p className="text-base font-bold text-foreground">{currentStock} unidades</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted">Stock resultante</span>
              <p
                className={cn(
                  "text-base font-bold tabular-nums",
                  resultingStock < 0
                    ? "text-danger"
                    : resultingStock > currentStock
                    ? "text-emerald-700"
                    : resultingStock < currentStock
                    ? "text-amber-700"
                    : "text-foreground",
                )}
              >
                {resultingStock} unidades
              </p>
            </div>
          </div>

          {/* Selector visual de tipo de movimiento (4 opciones) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Tipo de movimiento
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MOVEMENT_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = movementType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTypeChange(t.id)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-md border p-2 text-center transition-all",
                      isSelected
                        ? `${t.border} ${t.bg} ring-2 ring-ring ring-offset-1`
                        : "border-border bg-surface hover:bg-surface-muted",
                    )}
                  >
                    <Icon className={cn("size-5 mb-1", t.color)} aria-hidden="true" />
                    <span className="text-xs font-semibold text-foreground">{t.label}</span>
                    <span className="text-[10px] text-muted line-clamp-1">{t.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cantidad siempre positiva */}
          <FormField
            id="adjust-qty"
            label="Cantidad de unidades"
            required
            error={error && parsedQty <= 0 ? error : undefined}
          >
            <Input
              id="adjust-qty"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ej. 5"
              autoFocus
              className="text-base tabular-nums"
            />
          </FormField>

          {/* Chips de motivos predefinidos */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Motivo sugerido
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PREDEFINED_REASONS[movementType].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setSelectedChip(selectedChip === chip ? "" : chip)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    selectedChip === chip
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-surface text-muted hover:bg-surface-muted",
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Observaciones detalladas */}
          <FormField id="adjust-notes" label="Motivo del ajuste" required>
            <Textarea
              id="adjust-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle opcional sobre el ajuste..."
              maxLength={250}
            />
          </FormField>

          {error && parsedQty > 0 ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}
        </form>
      </Dialog>
    </>
  );
}
