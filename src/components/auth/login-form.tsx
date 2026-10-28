"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Lock, Mail, Store } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import { type LoginInput, loginSchema } from "@/lib/actions/auth-schema";
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

export interface LoginFormProps {
  businessName?: string;
  logoUrl?: string | null;
  onSuccess?: (redirectUrl: string) => void;
  loginFn?: (input: LoginInput) => Promise<ActionResult<{ redirectUrl: string }>>;
}

export function LoginForm({
  businessName = "LILA MARKET",
  logoUrl,
  onSuccess,
  loginFn = loginAction,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    // Validación cliente inicial
    const clientValidation = loginSchema.safeParse({ email, password });
    if (!clientValidation.success) {
      const errors: Record<string, string[]> = {};
      for (const [key, msgs] of Object.entries(clientValidation.error.flatten().fieldErrors)) {
        if (msgs && Array.isArray(msgs)) {
          errors[key] = msgs;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const result = await loginFn({ email, password });

      if (!result.ok) {
        setLoading(false);
        if (result.errors) {
          setFieldErrors(result.errors);
        }
        setGeneralError(result.message);
        return;
      }

      if (onSuccess) {
        onSuccess(result.data.redirectUrl);
      } else {
        router.push(result.data.redirectUrl);
      }
    } catch {
      setLoading(false);
      setGeneralError("Ocurrió un error inesperado al intentar iniciar sesión.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-muted/50 p-4">
      <Card className="w-full max-w-md border-border bg-surface shadow-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={businessName}
                width={36}
                height={36}
                className="size-9 rounded-lg object-contain"
              />
            ) : (
              <Store className="size-6" />
            )}
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            {businessName}
          </CardTitle>
          <CardDescription className="text-sm text-muted">
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            {generalError && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{generalError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold uppercase tracking-wider text-muted"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  placeholder="ejemplo@lilamarket.bo"
                  value={email}
                  disabled={loading}
                  invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              </div>
              {fieldErrors.email && (
                <p id="login-email-error" role="alert" className="text-xs text-danger">
                  {fieldErrors.email[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold uppercase tracking-wider text-muted"
              >
                Contraseña
              </label>
              <div className="relative">
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  disabled={loading}
                  invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                />
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              </div>
              {fieldErrors.password && (
                <p id="login-password-error" role="alert" className="text-xs text-danger">
                  {fieldErrors.password[0]}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-medium"
              loading={loading}
              disabled={loading}
            >
              {loading ? "Iniciando sesión..." : "Ingresar a caja"}
              {!loading && <ArrowRight className="size-4" />}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <footer className="mt-8 text-center text-xs text-muted">
        <p>LILA MARKET · Bolivia</p>
      </footer>
    </div>
  );
}
