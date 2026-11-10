"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { enrollMfaAction, verifyMfaEnrollmentAction } from "@/lib/actions/mfa";
import type { MfaEnrollResult } from "@/lib/actions/mfa-core";
import type { ActionResult } from "@/lib/actions/secure-action";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export interface MfaSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  enrollFn?: () => Promise<ActionResult<MfaEnrollResult>>;
  verifyFn?: (input: {
    factorId: string;
    code: string;
  }) => Promise<ActionResult<{ verified: boolean }>>;
}

export function MfaSetupDialog({
  open,
  onOpenChange,
  onSuccess,
  enrollFn = enrollMfaAction,
  verifyFn = verifyMfaEnrollmentAction,
}: MfaSetupDialogProps) {
  const [loading, setLoading] = useState(false);
  const [enrollData, setEnrollData] = useState<MfaEnrollResult | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    setEnrollData(null);
    setCode("");
    setError(null);
    setSuccess(false);
    setCopied(false);
    onOpenChange(false);
  };

  const isInitialLoading = open && !enrollData && !error;

  useEffect(() => {
    if (!open) return;

    let isMounted = true;

    enrollFn()
      .then((res) => {
        if (!isMounted) return;
        if (res.ok) {
          setEnrollData(res.data);
        } else {
          setError(res.message);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError("No se pudo iniciar la configuración de MFA.");
      });

    return () => {
      isMounted = false;
    };
  }, [open, enrollFn]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData) return;

    if (!/^\d{6}$/.test(code.trim())) {
      setError("El código debe tener exactamente 6 dígitos numéricos.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await verifyFn({
        factorId: enrollData.factorId,
        code: code.trim(),
      });

      setLoading(false);
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      } else {
        setError(res.message);
      }
    } catch {
      setLoading(false);
      setError("Error al verificar el código. Inténtalo de nuevo.");
    }
  };

  const handleCopySecret = () => {
    if (enrollData?.secret) {
      navigator.clipboard.writeText(enrollData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Configurar Autenticación en Dos Pasos (TOTP)"
      description="Escanea el código QR con Google Authenticator, Authy o tu aplicación TOTP favorita."
    >
      {isInitialLoading && (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
          <Spinner className="size-8 text-primary" />
          <p className="text-sm text-muted">Generando clave de seguridad...</p>
        </div>
      )}

      {error && !enrollData && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
        >
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">No se pudo iniciar la configuración</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        </div>
      )}

      {enrollData && !success && (
        <form onSubmit={handleVerify} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
            >
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* QR Code */}
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-muted/50 p-4">
            {enrollData.qrCode ? (
              <Image
                src={
                  enrollData.qrCode.startsWith("<svg")
                    ? `data:image/svg+xml;utf8,${encodeURIComponent(enrollData.qrCode)}`
                    : enrollData.qrCode
                }
                alt="Código QR para autenticación"
                width={180}
                height={180}
                unoptimized
                className="size-44 rounded-md border border-border bg-white p-2 object-contain"
              />
            ) : (
              <div className="size-44 rounded-md border border-border bg-white p-2 flex items-center justify-center text-center text-xs text-muted">
                Código QR disponible para escaneo
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 text-xs text-muted">
              <span>O ingresa esta clave manual:</span>
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono font-semibold text-foreground border border-border">
                {enrollData.secret}
              </code>
              <button
                type="button"
                onClick={handleCopySecret}
                aria-label="Copiar clave manual"
                className="text-primary hover:text-primary-hover p-1"
              >
                <Copy className="size-3.5" />
              </button>
              {copied && <span className="text-[11px] text-success">¡Copiado!</span>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="mfa-verify-code"
              className="block text-xs font-semibold uppercase tracking-wider text-muted"
            >
              Código de 6 dígitos
            </label>
            <Input
              id="mfa-verify-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={loading}
              className="text-center font-mono text-lg tracking-widest"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading || code.length !== 6}
            >
              Verificar y activar
            </Button>
          </div>
        </form>
      )}

      {success && (
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-success/20 text-success">
            <CheckCircle2 className="size-7" />
          </div>
          <h4 className="text-base font-bold text-foreground">¡2FA activado con éxito!</h4>
          <p className="text-xs text-muted max-w-xs">
            A partir de ahora se te solicitará un código de 6 dígitos cada vez que inicies sesión.
          </p>
        </div>
      )}
    </Dialog>
  );
}
