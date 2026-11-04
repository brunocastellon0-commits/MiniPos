"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
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
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; sortOrder?: string }>({});

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (name.trim() === "") {
      setFieldErrors({ name: "Escribe el nombre de la categoría." });
      return;
    }

    const parsedSortOrder = sortOrder.trim() === "" ? undefined : Number(sortOrder);
    if (parsedSortOrder !== undefined && (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 0)) {
      setFieldErrors({ sortOrder: "El orden debe ser un número entero mayor o igual a cero." });
      return;
    }

    setLoading(true);
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
        setFormError(result.message);
        return;
      }

      onSaved(result.data);
      onClose();
    } catch {
      setFormError("No se pudo guardar la categoría. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      ) : null}

      <FormField id="category-name" label="Nombre" error={fieldErrors.name}>
        {(control) => (
          <Input
            id={control.id}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Bebidas"
            maxLength={60}
            required
            disabled={loading}
            invalid={control.invalid}
            aria-describedby={control["aria-describedby"]}
          />
        )}
      </FormField>

      <FormField
        id="category-order"
        label="Orden (opcional)"
        error={fieldErrors.sortOrder}
        help="Un número menor aparece primero en la caja y en los filtros."
      >
        {(control) => (
          <Input
            id={control.id}
            type="number"
            min={0}
            max={9999}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            placeholder="Se asigna automáticamente"
            disabled={loading}
            invalid={control.invalid}
            aria-describedby={control["aria-describedby"]}
          />
        )}
      </FormField>

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
