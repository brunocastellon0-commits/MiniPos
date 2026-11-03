"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createProductAction, updateProductAction } from "@/lib/actions/products";
import { formatBs, toCents } from "@/lib/money";
import type { Category, Product } from "@/lib/repos/types";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    let priceCents: number;
    try {
      priceCents = toCents(price);
    } catch {
      setErrorMessage("El precio no es válido. Usa un monto como 12,50.");
      return;
    }
    if (priceCents < 0) {
      setErrorMessage("El precio no puede ser negativo.");
      return;
    }

    let costCents: number | null = null;
    if (cost.trim() !== "") {
      try {
        costCents = toCents(cost);
      } catch {
        setErrorMessage("El costo no es válido. Usa un monto como 8,00 o déjalo vacío.");
        return;
      }
      if (costCents < 0) {
        setErrorMessage("El costo no puede ser negativo.");
        return;
      }
    }

    const parsedStock = parseInteger(stock);
    const parsedMinStock = parseInteger(minStock);
    if (parsedStock === null) {
      setErrorMessage("El stock debe ser un número entero mayor o igual a cero.");
      return;
    }
    if (parsedMinStock === null) {
      setErrorMessage("El stock mínimo debe ser un número entero mayor o igual a cero.");
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
        setErrorMessage(result.message);
        return;
      }

      onSaved(result.data);
      onClose();
    } catch {
      setErrorMessage("No se pudo guardar el producto. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          Identificación
        </legend>
        <div className="space-y-1.5">
          <label htmlFor="product-name" className="text-xs font-medium text-foreground">
            Nombre del producto
          </label>
          <Input
            id="product-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Coca-Cola 2L"
            maxLength={120}
            required
            disabled={loading}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="product-barcode" className="text-xs font-medium text-foreground">
              Código de barras
            </label>
            <Input
              id="product-barcode"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              placeholder="Escanea o escribe el código"
              maxLength={64}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="product-internal-code" className="text-xs font-medium text-foreground">
              Código interno (opcional)
            </label>
            <Input
              id="product-internal-code"
              value={internalCode}
              onChange={(event) => setInternalCode(event.target.value)}
              placeholder="Ej. A-001"
              maxLength={64}
              disabled={loading}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="product-category" className="text-xs font-medium text-foreground">
              Categoría
            </label>
            <select
              id="product-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={loading}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="product-unit" className="text-xs font-medium text-foreground">
              Unidad de venta
            </label>
            <Input
              id="product-unit"
              value={unitLabel}
              onChange={(event) => setUnitLabel(event.target.value)}
              placeholder="unidad, kg, litro..."
              maxLength={20}
              disabled={loading}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          Precio y costo
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="product-price" className="text-xs font-medium text-foreground">
              Precio de venta (Bs)
            </label>
            <Input
              id="product-price"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="12,50"
              required
              disabled={loading}
            />
            <p className="text-xs text-foreground-muted">
              {price.trim() !== "" ? `Se mostrará como ${safeFormat(price)}` : "Monto en bolivianos."}
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="product-cost" className="text-xs font-medium text-foreground">
              Costo (Bs, opcional)
            </label>
            <Input
              id="product-cost"
              inputMode="decimal"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              placeholder="8,00"
              disabled={loading}
            />
            <p className="text-xs text-foreground-muted">
              Solo lo ve el propietario. Sirve para estimar el margen.
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          Inventario
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="product-stock" className="text-xs font-medium text-foreground">
              Stock actual
            </label>
            <Input
              id="product-stock"
              inputMode="numeric"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              disabled={loading || Boolean(product)}
            />
            {product ? (
              <p className="text-xs text-foreground-muted">
                El stock se modifica con ventas, compras o ajustes en Inventario.
              </p>
            ) : (
              <p className="text-xs text-foreground-muted">Stock inicial al crear el producto.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="product-min-stock" className="text-xs font-medium text-foreground">
              Stock mínimo
            </label>
            <Input
              id="product-min-stock"
              inputMode="numeric"
              value={minStock}
              onChange={(event) => setMinStock(event.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-foreground-muted">
              Te avisaremos cuando el stock llegue a este nivel.
            </p>
          </div>
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
