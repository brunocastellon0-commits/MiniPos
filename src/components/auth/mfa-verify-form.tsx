"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { verifyLoginMfaAction } from "@/lib/actions/mfa";
import type { VerifyMfaInput } from "@/lib/actions/mfa-core";
import type { ActionResult } from "@/lib/actions/secure-action";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface MfaVerifyFormProps {
  factorId: string;
  onSuccess?: (redirectUrl: string) => void;
  verifyLoginFn?: (input: VerifyMfaInput) => Promise<ActionResult<{ redirectUrl: string }>>;
}

export function MfaVerifyForm({
  factorId,
  onSuccess,
  verifyLoginFn = verifyLoginMfaAction,
}: MfaVerifyFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Ingresa un código válido de 6 dígitos.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await verifyLoginFn({
        factorId,
        code: code.trim(),
      });

      if (!res.ok) {
        setLoading(false);
        setError(res.message);
        return;
      }

      if (onSuccess) {
        onSuccess(res.data.redirectUrl);
      } else {
        router.push(res.data.redirectUrl);
      }
    } catch {
      setLoading(false);
      setError("Ocurrió un error inesperado al verificar el código.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-muted/50 p-4">
      <Card className="w-full max-w-md border-border bg-surface shadow-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            Verificación en dos pasos
          </CardTitle>
          <CardDescription className="text-sm text-muted">
            Ingresa el código de 6 dígitos generado por tu aplicación autenticadora.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="mfa-login-code"
                className="block text-xs font-semibold uppercase tracking-wider text-muted text-center"
              >
                Código de seguridad (TOTP)
              </label>
              <Input
                id="mfa-login-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                placeholder="000000"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
                className="text-center font-mono text-2xl tracking-[0.3em] font-semibold h-12"
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-medium"
              loading={loading}
              disabled={loading || code.length !== 6}
            >
              {loading ? "Verificando código..." : "Confirmar e ingresar"}
              {!loading && <ArrowRight className="size-4" />}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
