"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { createPurchaseAction } from "@/lib/actions/purchases";
import { formatBs, toCents } from "@/lib/money";
import type { Product, Supplier } from "@/lib/repos/types";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";

export interface NewPurchaseFormProps {
  suppliers: Supplier[];
  products: Product[];
  initialItems?: { productId: string; quantity: number }[];
}

interface Row {
  key: number;
  productId: string;
  quantity: string;
  costBs: string;
}

function centsToBsInput(cents: number): string {
  const units = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${units}.${fraction}`;
}

export function NewPurchaseForm({ suppliers, products, initialItems = [] }: NewPurchaseFormProps) {
  const router = useRouter();
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const nextKey = useRef(initialItems.length);

  const [rows, setRows] = useState<Row[]>(() =>
    initialItems.map((item, index) => {
      const product = productById.get(item.productId);
      return {
        key: index + 1,
        productId: item.productId,
        quantity: String(item.quantity),
        costBs: product?.cost_cents != null ? centsToBsInput(product.cost_cents) : "",
      };
    }),
  );
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addRow() {
    nextKey.current += 1;
    setRows((prev) => [...prev, { key: nextKey.current, productId: "", quantity: "1", costBs: "" }]);
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function handleProductChange(key: number, productId: string) {
    const product = productById.get(productId);
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const costBs =
          row.costBs === "" && product?.cost_cents != null
            ? centsToBsInput(product.cost_cents)
            : row.costBs;
        return { ...row, productId, costBs };
      }),
    );
  }

  const totalCents = rows.reduce((sum, row) => {
    const quantity = Number(row.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || row.costBs.trim() === "") return sum;
    try {
      return sum + quantity * toCents(row.costBs);
    } catch {
      return sum;
    }
  }, 0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSupplierError(null);

    if (!supplierId) {
      setSupplierError("Selecciona un proveedor.");
      return;
    }
    if (rows.length === 0) {
      setError("Agrega al menos un producto.");
      return;
    }

    const items: { productId: string; quantity: number; unitCostCents: number }[] = [];
    for (const row of rows) {
      if (!row.productId) {
        setError("Cada fila debe tener un producto seleccionado.");
        return;
      }
      const quantity = Number(row.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        setError("Las cantidades deben ser enteros mayores a 0.");
        return;
      }
      let unitCostCents: number;
      try {
        unitCostCents = toCents(row.costBs);
      } catch {
        setError("Revisa los costos unitarios: usa montos como 12.50 o 12,50.");
        return;
      }
      if (unitCostCents < 0) {
        setError("Los costos no pueden ser negativos.");
        return;
      }
      items.push({ productId: row.productId, quantity, unitCostCents });
    }

    setSubmitting(true);
    try {
      const result = await createPurchaseAction({
        supplierId,
        notes: notes.trim() || null,
        items,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/compras");
    } catch {
      setError("No se pudo registrar la compra.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id="new-purchase-form" onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="purchase-supplier"
          label="Proveedor (obligatorio)"
          error={supplierError}
          help="Elige el proveedor de esta compra."
        >
          {(control) => (
            <select
              id={control.id}
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              aria-invalid={control.invalid || undefined}
              aria-describedby={control["aria-describedby"]}
              className="h-10 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">
                {suppliers.length === 0 ? "Sin proveedores disponibles" : "Selecciona un proveedor"}
              </option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField id="purchase-notes" label="Notas" help="Ej. Entrega el viernes.">
          {(control) => (
            <input
              id={control.id}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={300}
              placeholder="Ej. Entrega el viernes"
              aria-describedby={control["aria-describedby"]}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}
        </FormField>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Productos del pedido</h2>
          <Button type="button" variant="secondary" onClick={addRow}>
            <Plus className="size-4" aria-hidden="true" />
            Agregar producto
          </Button>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface-muted/40 p-3 text-sm text-foreground-muted">
            Aún no hay productos. Agréjalos para armar el pedido.
          </p>
        ) : null}

        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid gap-3 rounded-card border border-border bg-surface p-3 sm:grid-cols-[1fr_7rem_9rem_auto]"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor={`purchase-product-${row.key}`}
                  className="block text-xs font-medium text-muted"
                >
                  Producto
                </label>
                <select
                  id={`purchase-product-${row.key}`}
                  value={row.productId}
                  onChange={(event) => handleProductChange(row.key, event.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Selecciona…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} (stock {product.stock_qty})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor={`purchase-qty-${row.key}`}
                  className="block text-xs font-medium text-muted"
                >
                  Cant.
                </label>
                <input
                  id={`purchase-qty-${row.key}`}
                  type="number"
                  min={1}
                  step={1}
                  value={row.quantity}
                  onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor={`purchase-cost-${row.key}`}
                  className="block text-xs font-medium text-muted"
                >
                  Costo unit. (Bs)
                </label>
                <input
                  id={`purchase-cost-${row.key}`}
                  type="text"
                  inputMode="decimal"
                  value={row.costBs}
                  onChange={(event) => updateRow(row.key, { costBs: event.target.value })}
                  placeholder="0.00"
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Quitar producto de la fila ${index + 1}`}
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length <= 1}
                >
                  <Trash2 className="size-4 text-danger" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-muted/40 p-4">
        <div>
          <span className="block text-xs font-medium uppercase tracking-wide text-muted">
            Total del pedido
          </span>
          <span className="text-lg font-bold text-foreground" data-testid="purchase-total">
            {formatBs(totalCents)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push("/compras")} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
            {submitting ? "Registrando…" : "Registrar compra"}
          </Button>
        </div>
      </div>
    </form>
  );
}
