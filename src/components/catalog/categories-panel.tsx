"use client";

import { Table, Td, Th } from "@/components/ui/table";
import { useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  FolderTree,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  deleteCategoryAction,
  reorderCategoriesAction,
  updateCategoryAction,
} from "@/lib/actions/categories";
import { moveCategory, sortCategories } from "@/lib/domain/categories";
import type { Category } from "@/lib/repos/types";
import { CategoryFormDialog } from "./category-form-dialog";

export interface CategoriesPanelProps {
  initialCategories: Category[];
  onCategoriesChange?: (categories: Category[]) => void;
}

export function CategoriesPanel({ initialCategories, onCategoriesChange }: CategoriesPanelProps) {
  const [categories, setCategories] = useState<Category[]>(sortCategories(initialCategories));

  const updateCategories = (next: Category[]) => {
    const sorted = sortCategories(next);
    setCategories(sorted);
    onCategoriesChange?.(sorted);
  };
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleSaved = (category: Category) => {
    const exists = categories.some((item) => item.id === category.id);
    const next = exists
      ? categories.map((item) => (item.id === category.id ? category : item))
      : [...categories, category];
    updateCategories(next);
    setErrorMessage(null);
  };

  const openCreate = () => {
    setEditingCategory(null);
    setIsFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setIsFormOpen(true);
  };

  const handleToggleActive = async (category: Category) => {
    setErrorMessage(null);
    setPendingId(category.id);
    const result = await updateCategoryAction({ id: category.id, active: !category.active });
    setPendingId(null);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }
    handleSaved(result.data);
  };

  const handleMove = async (category: Category, direction: "up" | "down") => {
    setErrorMessage(null);
    const reordered = moveCategory(categories, category.id, direction);
    if (reordered.every((item, index) => item.id === categories[index]?.id)) return;

    setPendingId(category.id);
    const result = await reorderCategoriesAction({ ids: reordered.map((item) => item.id) });
    setPendingId(null);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }
    updateCategories(result.data);
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    setDeleteLoading(true);
    setErrorMessage(null);
    const result = await deleteCategoryAction({ id: deletingCategory.id });
    setDeleteLoading(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      setDeletingCategory(null);
      return;
    }

    updateCategories(categories.filter((item) => item.id !== result.data.id));
    setDeletingCategory(null);
  };

  return (
    <section className="space-y-4" aria-labelledby="categories-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="categories-title" className="text-lg font-semibold text-foreground">
            Categorías
          </h2>
          <p className="text-sm text-foreground-muted">
            Agrupa tus productos. Las categorías activas aparecen en la caja.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva categoría
        </Button>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {categories.length === 0 ? (
        <EmptyState
          title="Todavía no hay categorías"
          description="Crea la primera categoría para organizar los productos de tu minimarket."
          icon={<FolderTree className="h-8 w-8" />}
          action={
            <Button onClick={openCreate} variant="secondary" className="gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Crear categoría
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <Table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs font-medium text-foreground-muted">
              <tr>
                <Th scope="col" className="w-24">
                  Orden
                </Th>
                <Th scope="col">
                  Nombre
                </Th>
                <Th scope="col">
                  Estado
                </Th>
                <Th scope="col" className="text-right">
                  Acciones
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((category, index) => {
                const isPending = pendingId === category.id;
                return (
                  <tr key={category.id} className="hover:bg-surface-muted/30">
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 text-center text-xs font-semibold tabular-nums text-muted">
                          {category.sort_order}
                        </span>
                        <IconButton
                          aria-label={`Subir ${category.name}`}
                          
                          variant="ghost"
                          disabled={index === 0 || isPending}
                          onClick={() => handleMove(category, "up")}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          aria-label={`Bajar ${category.name}`}
                          
                          variant="ghost"
                          disabled={index === categories.length - 1 || isPending}
                          onClick={() => handleMove(category, "down")}
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      </div>
                    </Td>
                    <Td className="font-medium text-foreground">{category.name}</Td>
                    <Td>
                      <Badge tone={category.active ? "success" : "neutral"}>
                        {category.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          aria-label={`Editar ${category.name}`}
                          
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => openEdit(category)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          aria-label={
                            category.active
                              ? `Desactivar ${category.name}`
                              : `Activar ${category.name}`
                          }
                          
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => handleToggleActive(category)}
                        >
                          <Power className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          aria-label={`Eliminar ${category.name}`}
                          
                          variant="ghost"
                          className="text-danger"
                          disabled={isPending}
                          onClick={() => setDeletingCategory(category)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      <CategoryFormDialog
        category={editingCategory}
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={handleSaved}
      />

      <Dialog
        open={Boolean(deletingCategory)}
        onClose={() => setDeletingCategory(null)}
        title="Eliminar categoría"
        description={
          deletingCategory
            ? `¿Seguro que quieres eliminar "${deletingCategory.name}"? Esta acción no se puede deshacer.`
            : undefined
        }
        className="max-w-md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeletingCategory(null)}
              disabled={deleteLoading}
            >
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleteLoading}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground-muted">
          Si la categoría tiene productos, el sistema no permitirá eliminarla. En ese caso,
          desactívala o reasigna sus productos.
        </p>
      </Dialog>
    </section>
  );
}
