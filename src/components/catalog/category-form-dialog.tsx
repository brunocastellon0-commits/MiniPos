"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createCategoryAction, updateCategoryAction } from "@/lib/actions/categories";
import type { Category } from "@/lib/repos/types";

export interface CategoryFormDialogProps {
  category: Category | null;
  open: boolean;
  onClose: () => void;
  onSaved: (category: Category) => void;
}

export function CategoryFormDialog({
  category,
  open,
  onClose,
  onSaved,
}: CategoryFormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={category ? "Editar categoría" : "Nueva categoría"}
      description={
        category
          ? "Cambia el nombre, el orden o el estado de la categoría."
          : "Agrupa productos para encontrarlos más rápido en la caja."
      }
      className="max-w-md"
    >
      <CategoryForm
        key={category?.id ?? "new"}
        category={category}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Dialog>
  );
}

function CategoryForm({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: (category: Category) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(category?.sort_order ?? ""));
  const [active, setActive] = useState(category?.active ?? true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const parsedSortOrder = sortOrder.trim() === "" ? undefined : Number(sortOrder);
    if (parsedSortOrder !== undefined && (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 0)) {
      setErrorMessage("El orden debe ser un número entero mayor o igual a cero.");
      setLoading(false);
      return;
    }

    try {
      const result = category
        ? await updateCategoryAction({
            id: category.id,
            name,
            sortOrder: parsedSortOrder,
            active,
          })
        : await createCategoryAction({
            name,
            sortOrder: parsedSortOrder,
            active,
          });

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      onSaved(result.data);
      onClose();
    } catch {
      setErrorMessage("No se pudo guardar la categoría. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="category-name" className="text-xs font-medium text-foreground">
          Nombre
        </label>
        <Input
          id="category-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Bebidas"
          maxLength={60}
          required
          disabled={loading}
          invalid={Boolean(errorMessage)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="category-order" className="text-xs font-medium text-foreground">
          Orden (opcional)
        </label>
        <Input
          id="category-order"
          type="number"
          min={0}
          max={9999}
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          placeholder="Se asigna automáticamente"
          disabled={loading}
        />
        <p className="text-xs text-foreground-muted">
          Un número menor aparece primero en la caja y en los filtros.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          disabled={loading}
          className="size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
        />
        Categoría activa
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {category ? "Guardar cambios" : "Crear categoría"}
        </Button>
      </div>
    </form>
  );
}
