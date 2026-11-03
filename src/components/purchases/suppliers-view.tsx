"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createSupplierAction,
  deleteSupplierAction,
  updateSupplierAction,
} from "@/lib/actions/suppliers";
import type { Supplier } from "@/lib/repos/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Toast } from "@/components/ui/toast";

export interface SuppliersViewProps {
  initialSuppliers: Supplier[];
  initialError?: string | null;
}

interface FormState {
  name: string;
  phone: string;
  notes: string;
  active: boolean;
}

const emptyForm: FormState = { name: "", phone: "", notes: "", active: true };

export function SuppliersView({ initialSuppliers, initialError = null }: SuppliersViewProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setCreateOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setForm({
      name: supplier.name,
      phone: supplier.phone ?? "",
      notes: supplier.notes ?? "",
      active: supplier.active,
    });
    setError(null);
    setEditTarget(supplier);
  }

  function closeDialogs() {
    if (submitting) return;
    setCreateOpen(false);
    setEditTarget(null);
    setDeleteTarget(null);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (name.length < 2) {
      setError("El nombre del proveedor es obligatorio (mínimo 2 caracteres).");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        active: form.active,
      };
      const result = editTarget
        ? await updateSupplierAction({ id: editTarget.id, ...payload })
        : await createSupplierAction(payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCreateOpen(false);
      setEditTarget(null);
      setSuccess(editTarget ? "Proveedor actualizado" : "Proveedor creado");
      router.refresh();
    } catch {
      setError("No se pudo guardar el proveedor.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await deleteSupplierAction({ id: deleteTarget.id });
      if (!result.ok) {
        setError(result.message);
        setDeleteTarget(null);
        return;
      }
      setDeleteTarget(null);
      setSuccess("Proveedor eliminado");
      router.refresh();
    } catch {
      setError("No se pudo eliminar el proveedor.");
      setDeleteTarget(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {success ? <Toast tone="success" title={success} /> : null}
      {error && !createOpen && !editTarget && !deleteTarget ? (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="primary" onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Nuevo proveedor
        </Button>
      </div>

      {initialSuppliers.length === 0 ? (
        <EmptyState
          title="No hay proveedores registrados"
          description="Crea un proveedor para poder registrar compras."
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Nombre
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Teléfono
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Notas
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {initialSuppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{supplier.name}</td>
                  <td className="px-4 py-3 text-foreground-muted">{supplier.phone ?? "—"}</td>
                  <td className="max-w-56 truncate px-4 py-3 text-foreground-muted">
                    {supplier.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={supplier.active ? "success" : "neutral"}>
                      {supplier.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`Editar ${supplier.name}`}
                        onClick={() => openEdit(supplier)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`Eliminar ${supplier.name}`}
                        onClick={() => {
                          setError(null);
                          setDeleteTarget(supplier);
                        }}
                      >
                        <Trash2 className="size-4 text-danger" aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={createOpen || editTarget !== null}
        onClose={closeDialogs}
        title={editTarget ? "Editar proveedor" : "Nuevo proveedor"}
        description="Los proveedores se usan al registrar compras. Puedes desactivarlos sin borrar su historial."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={closeDialogs} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="supplier-form"
              variant="primary"
              disabled={submitting}
              loading={submitting}
            >
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="supplier-name" className="block text-sm font-medium text-foreground">
              Nombre (obligatorio)
            </label>
            <input
              id="supplier-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Ej. Distribuidora Andina"
              aria-invalid={Boolean(error)}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="supplier-phone" className="block text-sm font-medium text-foreground">
              Teléfono
            </label>
            <input
              id="supplier-phone"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="Ej. 71234567"
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="supplier-notes" className="block text-sm font-medium text-foreground">
              Notas
            </label>
            <textarea
              id="supplier-notes"
              rows={2}
              maxLength={300}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Ej. Entrega los martes"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
              className="size-4 rounded border-border accent-primary"
            />
            Proveedor activo
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={closeDialogs}
        title="Eliminar proveedor"
        description={
          deleteTarget
            ? `Se eliminará "${deleteTarget.name}". Solo es posible si no tiene compras registradas.`
            : ""
        }
        footer={
          <>
            <Button type="button" variant="ghost" onClick={closeDialogs} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={handleDelete} loading={submitting}>
              {submitting ? "Eliminando…" : "Eliminar"}
            </Button>
          </>
        }
      >
        {error && deleteTarget ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
