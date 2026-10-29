"use client";

import { useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MfaSetupDialog } from "./mfa-setup-dialog";

export interface MfaBannerProps {
  isMfaEnabled?: boolean;
  onMfaChanged?: () => void;
}

export function MfaBanner({ isMfaEnabled = false, onMfaChanged }: MfaBannerProps) {
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);

  if (isMfaEnabled) {
    return (
      <Card className="border-success/30 bg-success/5 shadow-sm">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Autenticación en dos pasos activada (TOTP)
              </h4>
              <p className="text-xs text-muted">
                Tu cuenta de dueño está protegida con código de verificación adicional.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-warning/30 bg-warning/5 shadow-sm">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Recomendación de seguridad: Activa 2FA (TOTP)
              </h4>
              <p className="text-xs text-muted">
                Protege el dinero y los datos de tu negocio añadiendo un código de tu celular al
                iniciar sesión.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSetupDialogOpen(true)}
            className="shrink-0 font-medium"
          >
            Configurar 2FA
          </Button>
        </CardContent>
      </Card>

      <MfaSetupDialog
        open={setupDialogOpen}
        onOpenChange={setSetupDialogOpen}
        onSuccess={() => {
          setSetupDialogOpen(false);
          onMfaChanged?.();
        }}
      />
    </>
  );
}
