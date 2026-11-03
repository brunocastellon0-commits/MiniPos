"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { receivePurchaseAction } from "@/lib/actions/purchases";
import { formatBs } from "@/lib/money";
import type { Purchase, PurchaseItem } from "@/lib/repos/types";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";

const STATUS_META: Record<Purchase["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  ordered: { label: "En pedido", tone: "info" },
  partial: { label: "Parcial", tone: "warning" },
  received: { label: "Recibida", tone: "success" },
  cancelled: { label: "Cancelada", tone: "danger" },
};

export interface PurchaseReceiveViewProps {
  purchase: Purchase;
  items: PurchaseItem[];
  productNames: Record<string, string>;
}

export function PurchaseReceiveView({ purchase, items, productNames }: PurchaseReceiveViewProps) {
  const router = useRouter();
  const isClosed = purchase.status === "received" || purchase.status === "cancelled";

  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.product_id, String(item.qty_received)])),
  );
  const [updateCost, setUpdateCost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const receiveItems: { productId: string; qtyReceived: number }[] = [];
    for (const item of items) {
      const raw = quantities[item.product_id] ?? "";
      const qtyReceived = Number(raw);
      if (!Number.isInteger(qtyReceived) || qtyReceived < 0) {
        setError("Las cantidades recibidas deben ser enteros mayores o iguales a 0.");
        return;
      }
      if (qtyReceived > item.qty_ordered) {
        setError(
          `La cantidad recibida de "${productNames[item.product_id] ?? "un producto"}" no puede superar la ordenada (${item.qty_ordered}).`,
        );
        return;
      }
      receiveItems.push({ productId: item.product_id, qtyReceived });
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await receivePurchaseAction({
        purchaseId: purchase.id,
        items: receiveItems,
        updateCost,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("No se pudo registrar la recepción.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {success ? (
        <Toast
          tone="success"
          title="Recepción registrada"
          description="El stock se actualizó con las cantidades recibidas."
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={STATUS_META[purchase.status].tone}>{STATUS_META[purchase.status].label}</Badge>
        <span className="text-sm text-foreground-muted">Total {formatBs(purchase.total_cents)}</span>
        {purchase.supplier_id ? null : (
          <span className="text-sm text-foreground-muted">Sin proveedor</span>
        )}
      </div>

      <form id="receive-purchase-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Producto
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Pedido
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Costo unit.
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Recibido
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {productNames[item.product_id] ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground-muted">{item.qty_ordered}</td>
                  <td className="px-4 py-3 text-right text-foreground-muted">
                    {formatBs(item.unit_cost_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      max={item.qty_ordered}
                      step={1}
                      value={quantities[item.product_id] ?? ""}
                      disabled={isClosed}
                      onChange={(event) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [item.product_id]: event.target.value,
                        }))
                      }
                      aria-label={`Cantidad recibida de ${productNames[item.product_id] ?? "producto"}`}
                      className="h-9 w-24 rounded-md border border-border bg-surface px-2 text-right text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isClosed ? (
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={updateCost}
              onChange={(event) => setUpdateCost(event.target.checked)}
              className="mt-0.5 size-4 rounded border-border accent-primary"
            />
            Actualizar el costo del producto con el costo de esta compra
          </label>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        {!isClosed ? (
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
              {submitting ? "Registrando…" : "Confirmar recepción"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-foreground-muted" role="status">
            {purchase.status === "received"
              ? "Esta compra ya fue recibida en su totalidad."
              : "Esta compra está cancelada: no se puede recibir."}
          </p>
        )}
      </form>
    </div>
  );
}
