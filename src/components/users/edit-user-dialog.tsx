"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { Profile } from "@/lib/repos/types";
import {
  toggleUserActiveAction,
  updateUserNameAction,
  updateUserRoleAction,
} from "@/lib/actions/users";

export interface EditUserDialogProps {
  user: Profile | null;
  open: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: Profile) => void;
}

export function EditUserDialog({
  user,
  open,
  onClose,
  onUserUpdated,
}: EditUserDialogProps) {
  if (!user) return null;

  return (
    <EditUserDialogContent
      key={user.id}
      user={user}
      open={open}
      onClose={onClose}
      onUserUpdated={onUserUpdated}
    />
  );
}

function EditUserDialogContent({
  user,
  open,
  onClose,
  onUserUpdated,
}: {
  user: Profile;
  open: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: Profile) => void;
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState<"owner" | "cashier">(user.role as "owner" | "cashier");
  const [active, setActive] = useState(user.active);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      let current = user;

      // 1. Actualizar nombre si cambió
      if (fullName.trim() !== user.full_name) {
        const nameRes = await updateUserNameAction({
          id: user.id,
          fullName: fullName.trim(),
        });
        if (!nameRes.ok) {
          setErrorMessage(nameRes.message);
          setLoading(false);
          return;
        }
        current = nameRes.data;
      }

      // 2. Actualizar rol si cambió
      if (role !== user.role) {
        const roleRes = await updateUserRoleAction({
          id: user.id,
          role,
        });
        if (!roleRes.ok) {
          setErrorMessage(roleRes.message);
          setLoading(false);
          return;
        }
        current = roleRes.data;
      }

      // 3. Actualizar estado activo si cambió
      if (active !== user.active) {
        const activeRes = await toggleUserActiveAction({
          id: user.id,
          active,
        });
        if (!activeRes.ok) {
          setErrorMessage(activeRes.message);
          setLoading(false);
          return;
        }
        current = activeRes.data;
      }

      onUserUpdated(current);
      onClose();
    } catch {
      setErrorMessage("Error al guardar los cambios del usuario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Editar Usuario"
      description={`Modifica los datos y permisos de ${user.full_name}.`}
      className="max-w-md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="ghost" onClick={onClose} disabled={loading} type="button">
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <>
                <Spinner className="size-4 mr-2" />
                Guardando...
              </>
            ) : (
              "Guardar Cambios"
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="user-full-name" className="text-xs font-medium text-foreground">
            Nombre Completo
          </label>
          <Input
            id="user-full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ej. Juan Pérez"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="user-role-select" className="text-xs font-medium text-foreground">
            Rol en el sistema
          </label>
          <select
            id="user-role-select"
            value={role}
            onChange={(e) => setRole(e.target.value as "owner" | "cashier")}
            disabled={loading}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            <option value="owner">Propietario (Acceso total)</option>
            <option value="cashier">Cajero (Solo Caja, Turno e Historial)</option>
          </select>
          <p className="text-xs text-foreground-muted">
            Los cajeros no pueden ver reportes, costos ni configuración.
          </p>
        </div>

        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-medium text-foreground">Estado de la cuenta</label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="user-active"
                checked={active}
                onChange={() => setActive(true)}
                disabled={loading}
                className="text-primary focus:ring-primary"
              />
              <span className="text-success font-medium">Activo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="user-active"
                checked={!active}
                onChange={() => setActive(false)}
                disabled={loading}
                className="text-primary focus:ring-primary"
              />
              <span className="text-foreground-muted">Inactivo</span>
            </label>
          </div>
          <p className="text-xs text-foreground-muted">
            Un usuario inactivo no podrá iniciar sesión en ninguna terminal.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
