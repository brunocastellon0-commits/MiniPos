"use client";

import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InviteUserDialog({ open, onClose }: InviteUserDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cómo agregar un nuevo usuario"
      description="Guía paso a paso para dar de alta personal en LILA MARKET manteniendo la máxima seguridad."
      className="max-w-lg"
      footer={
        <div className="flex justify-end w-full">
          <Button variant="primary" onClick={onClose}>
            Entendido
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2 text-sm text-foreground">
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <ShieldAlert className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Seguridad estricta de credenciales</p>
            <p className="text-xs text-foreground-muted">
              Por norma de seguridad bancaria y contable, las contraseñas nunca pasan por el sistema.
              El alta de cuentas se gestiona desde el panel de autenticación de Supabase.
            </p>
          </div>
        </div>

        <ol className="space-y-3 text-xs sm:text-sm">
          <li className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
              1
            </span>
            <div>
              <p className="font-medium">Crear usuario en Supabase Auth</p>
              <p className="text-foreground-muted text-xs">
                Ingresa al panel de Supabase en <strong>Authentication &gt; Users &gt; Add user</strong> con el correo y contraseña temporal del colaborador (o invítalo por email).
              </p>
            </div>
          </li>

          <li className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
              2
            </span>
            <div>
              <p className="font-medium">Primer inicio de sesión</p>
              <p className="text-foreground-muted text-xs">
                El nuevo colaborador ingresa en la pantalla de inicio de sesión con sus credenciales.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
              3
            </span>
            <div>
              <p className="font-medium">Asignación automática de perfil</p>
              <p className="text-foreground-muted text-xs">
                El sistema crea automáticamente su perfil con rol inicial de <strong>Cajero</strong>.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
              4
            </span>
            <div>
              <p className="font-medium">Gestión desde esta pantalla</p>
              <p className="text-foreground-muted text-xs">
                Aparecerá en tu lista de usuarios inmediatamente. Desde aquí podrás asignarle su nombre completo, cambiar su rol a <strong>Propietario</strong> o desactivarlo cuando sea necesario.
              </p>
            </div>
          </li>
        </ol>
      </div>
    </Dialog>
  );
}
