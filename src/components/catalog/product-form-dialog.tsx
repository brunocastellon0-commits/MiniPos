"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { createProductAction, updateProductAction } from "@/lib/actions/products";
import { formatBs, toCents } from "@/lib/money";
import type { Category, Product } from "@/lib/repos/types";
import { BarcodeCameraScanner } from "./barcode-camera-scanner";

export interface ProductFormDialogProps {
  product: Product | null;
  categories: Category[];
  open: boolean;
  defaultMinStock?: number;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

export function ProductFormDialog({
  product,
  categories,
  open,
  defaultMinStock = 5,
  onClose,
  onSaved,
}: ProductFormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={product ? "Editar producto" : "Nuevo producto"}
      description={
        product
          ? "Actualiza los datos del producto. El stock se ajusta desde Inventario."
          : "Registra un producto para venderlo en la caja."
      }
      className="max-w-2xl"
    >
      <ProductForm
        key={product?.id ?? "new"}
        product={product}
        categories={categories}
        defaultMinStock={defaultMinStock}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Dialog>
  );
}

function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

function parseInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function ProductForm({
  product,
  categories,
  defaultMinStock,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  defaultMinStock: number;
  onClose: () => void;
  onSaved: (product: Product) => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [internalCode, setInternalCode] = useState(product?.internal_code ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [unitLabel, setUnitLabel] = useState(product?.unit_label ?? "unidad");
  const [price, setPrice] = useState(centsToInput(product?.price_cents));
  const [cost, setCost] = useState(centsToInput(product?.cost_cents));
  const [stock, setStock] = useState(String(product?.stock_qty ?? 0));
  const [minStock, setMinStock] = useState(String(product?.min_stock ?? defaultMinStock));
  const [active, setActive] = useState(product?.active ?? true);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"name" | "price" | "cost" | "stock" | "minStock", string>>
  >({});

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (name.trim() === "") {
      setFieldErrors({ name: "Escribe el nombre del producto." });
      return;
    }

    let priceCents: number;
    try {
      priceCents = toCents(price);
    } catch {
      setFieldErrors({ price: "El precio no es válido. Usa un monto como 12,50." });
      return;
    }
    if (priceCents < 0) {
      setFieldErrors({ price: "El precio no puede ser negativo." });
      return;
    }

    let costCents: number | null = null;
    if (cost.trim() !== "") {
      try {
        costCents = toCents(cost);
      } catch {
        setFieldErrors({ cost: "El costo no es válido. Usa un monto como 8,00 o déjalo vacío." });
        return;
      }
      if (costCents < 0) {
        setFieldErrors({ cost: "El costo no puede ser negativo." });
        return;
      }
    }

    const parsedStock = parseInteger(stock);
    const parsedMinStock = parseInteger(minStock);
    if (parsedStock === null) {
      setFieldErrors({ stock: "El stock debe ser un número entero mayor o igual a cero." });
      return;
    }
    if (parsedMinStock === null) {
      setFieldErrors({ minStock: "El stock mínimo debe ser un número entero mayor o igual a cero." });
      return;
    }

    setLoading(true);
    try {
      const result = product
        ? await updateProductAction({
            id: product.id,
            name,
            barcode: barcode.trim() === "" ? null : barcode,
            internalCode: internalCode.trim() === "" ? null : internalCode,
            categoryId: categoryId === "" ? null : categoryId,
            unitLabel,
            priceCents,
            costCents,
            minStock: parsedMinStock,
            active,
          })
        : await createProductAction({
            name,
            barcode: barcode.trim() === "" ? null : barcode,
            internalCode: internalCode.trim() === "" ? null : internalCode,
            categoryId: categoryId === "" ? null : categoryId,
            unitLabel,
            priceCents,
            costCents,
            stockQty: parsedStock,
            minStock: parsedMinStock,
            active,
          });

      if (!result.ok) {
        setFormError(result.message);
        return;
      }

      onSaved(result.data);
      onClose();
    } catch {
      setFormError("No se pudo guardar el producto. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          Identificación
        </legend>
        <FormField id="product-name" label="Nombre del producto" error={fieldErrors.name}>
          {(control) => (
            <Input
              id={control.id}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Coca-Cola 2L"
              maxLength={120}
              required
              disabled={loading}
              invalid={control.invalid}
              aria-describedby={control["aria-describedby"]}
            />
          )}
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="product-barcode" label="Código de barras">
            {(control) => (
              <div className="flex gap-2">
                <Input
                  id={control.id}
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  placeholder="Escanea o escribe el código"
                  maxLength={64}
                  disabled={loading}
                  aria-describedby={control["aria-describedby"]}
                  className="flex-1"
                />
                <BarcodeCameraScanner onDetected={(code) => setBarcode(code)} />
              </div>
            )}
          </FormField>
          <FormField id="product-internal-code" label="Código interno (opcional)">
            {(control) => (
              <Input
                id={control.id}
                value={internalCode}
                onChange={(event) => setInternalCode(event.target.value)}
                placeholder="Ej. A-001"
                maxLength={64}
                disabled={loading}
                aria-describedby={control["aria-describedby"]}
              />
            )}
          </FormField>
        </div>
        <FormField id="product-category" label="Categoría" help="Agrupa el producto en la caja.">
          {(control) => (
            <select
              id={control.id}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={loading}
              aria-describedby={control["aria-describedby"]}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          Precio y costo
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            id="product-price"
            label="Precio de venta (Bs)"
            error={fieldErrors.price}
            help={
              price.trim() !== "" ? `Se mostrará como ${safeFormat(price)}` : "Monto en bolivianos."
            }
          >
            {(control) => (
              <Input
                id={control.id}
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="12,50"
                required
                disabled={loading}
                invalid={control.invalid}
                aria-describedby={control["aria-describedby"]}
              />
            )}
          </FormField>
          <FormField
            id="product-cost"
            label="Costo (Bs, opcional)"
            error={fieldErrors.cost}
            help="Solo lo ve el propietario. Sirve para estimar el margen."
          >
            {(control) => (
              <Input
                id={control.id}
                inputMode="decimal"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                placeholder="8,00"
                disabled={loading}
                invalid={control.invalid}
                aria-describedby={control["aria-describedby"]}
              />
            )}
          </FormField>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          Inventario
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            id="product-stock"
            label="Stock actual"
            error={fieldErrors.stock}
            help={
              product
                ? "El stock se modifica con ventas, compras o ajustes en Inventario."
                : "Stock inicial al crear el producto."
            }
          >
            {(control) => (
              <Input
                id={control.id}
                inputMode="numeric"
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                disabled={loading || Boolean(product)}
                invalid={control.invalid}
                aria-describedby={control["aria-describedby"]}
              />
            )}
          </FormField>
          <FormField
            id="product-min-stock"
            label="Stock mínimo"
            error={fieldErrors.minStock}
            help="Te avisaremos cuando el stock llegue a este nivel."
          >
            {(control) => (
              <Input
                id={control.id}
                inputMode="numeric"
                value={minStock}
                onChange={(event) => setMinStock(event.target.value)}
                disabled={loading}
                invalid={control.invalid}
                aria-describedby={control["aria-describedby"]}
              />
            )}
          </FormField>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            disabled={loading}
            className="size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
          />
          Producto activo (disponible en la caja)
        </label>
      </fieldset>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {product ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}

function safeFormat(value: string): string {
  try {
    return formatBs(toCents(value));
  } catch {
    return "monto inválido";
  }
}
