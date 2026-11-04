"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { openCashSessionAction } from "@/lib/actions/cash";
import { createCategoryAction } from "@/lib/actions/categories";
import { importProductsCsvAction } from "@/lib/actions/products-csv";
import { updateBusinessSettingsAction } from "@/lib/actions/settings";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BusinessSettings } from "@/lib/repos/types";
import { toCents } from "@/lib/money";

export interface OnboardingWizardProps {
  initialSettings: BusinessSettings;
}

const STEPS = ["Negocio", "Categorías", "Productos", "Caja"] as const;

const inputClass = "h-10 w-full";

export function OnboardingWizard({ initialSettings }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const [name, setName] = useState(initialSettings.name);
  const [legalName, setLegalName] = useState(initialSettings.legal_name ?? "");
  const [currencyCode, setCurrencyCode] = useState(initialSettings.currency_code);
  const [currencySymbol, setCurrencySymbol] = useState(initialSettings.currency_symbol);
  const [logoUrl, setLogoUrl] = useState(initialSettings.logo_url ?? "");

  const [categoryName, setCategoryName] = useState("");
  const [createdCategories, setCreatedCategories] = useState<string[]>([]);

  const [csv, setCsv] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const [opening, setOpening] = useState("");
  const [notes, setNotes] = useState("");

  function goNext() {
    setError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  async function saveBusiness() {
    setBusy(true);
    setError(null);
    try {
      const result = await updateBusinessSettingsAction({
        name,
        legal_name: legalName,
        currency_code: currencyCode,
        currency_symbol: currencySymbol,
        logo_url: logoUrl,
        allow_negative_stock: initialSettings.allow_negative_stock,
        cashier_can_discount: initialSettings.cashier_can_discount,
        cashier_max_discount_cents: initialSettings.cashier_max_discount_cents,
        low_stock_default: initialSettings.low_stock_default,
      });
      if (result.ok) {
        goNext();
      } else {
        setError(result.message);
      }
    } catch {
      setError("No se pudieron guardar los datos del negocio.");
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    const trimmed = categoryName.trim();
    if (trimmed.length === 0) {
      setError("Escribe el nombre de la categoría.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createCategoryAction({ name: trimmed });
      if (result.ok) {
        setCreatedCategories((current) => [...current, trimmed]);
        setCategoryName("");
      } else {
        setError(result.message);
      }
    } catch {
      setError("No se pudo crear la categoría.");
    } finally {
      setBusy(false);
    }
  }

  async function importCsv() {
    setBusy(true);
    setError(null);
    try {
      const result = await importProductsCsvAction({ csv });
      if (result.ok) {
        if (result.data.errors.length > 0) {
          setImportedCount(null);
          setCsvErrors(result.data.errors.map((item) => item.message));
        } else {
          setImportedCount(result.data.imported);
          setCsvErrors([]);
        }
      } else {
        setError(result.message);
      }
    } catch {
      setError("No se pudo importar el archivo.");
    } finally {
      setBusy(false);
    }
  }

  async function openCash() {
    setBusy(true);
    setError(null);
    let openingCents: number;
    try {
      openingCents = toCents(opening);
    } catch {
      setError("El saldo inicial no es un monto válido.");
      setBusy(false);
      return;
    }
    try {
      const input =
        notes.trim().length > 0
          ? { openingCents, notes: notes.trim() }
          : { openingCents };
      const result = await openCashSessionAction(input);
      if (result.ok) {
        setFinished(true);
      } else {
        setError(result.message);
      }
    } catch {
      setError("No se pudo abrir la caja.");
    } finally {
      setBusy(false);
    }
  }

  if (finished) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-success" aria-hidden="true" />
            Configuración inicial lista
          </CardTitle>
          <CardDescription>
            Tu negocio ya está preparado. Puedes ajustar cualquier detalle después desde
            Configuración.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/caja" className={buttonClasses({ variant: "primary" })}>
            Ir a la caja
          </Link>
          <Link href="/panel" className={buttonClasses({ variant: "secondary" })}>
            Ir al panel
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ol aria-label="Pasos del asistente" className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={
              index === step
                ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
                : index < step
                  ? "rounded-full border border-border bg-surface px-3 py-1 text-sm text-foreground"
                  : "rounded-full border border-border bg-surface px-3 py-1 text-sm text-muted"
            }
          >
            <span className="flex items-center gap-1">
              {index < step ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              {index + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {error ? (
        <div
          role="alert"
          className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Tu negocio</CardTitle>
            <CardDescription>
              Se muestra en la cabecera, la pantalla de inicio y los comprobantes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="wiz-name" className="block text-sm font-medium text-foreground">
                Nombre del negocio
              </label>
              <Input
                id="wiz-name"
                className={inputClass}
                value={name}
                maxLength={80}
                required
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="wiz-legal" className="block text-sm font-medium text-foreground">
                Razón social
              </label>
              <Input
                id="wiz-legal"
                className={inputClass}
                value={legalName}
                maxLength={120}
                onChange={(event) => setLegalName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="wiz-code" className="block text-sm font-medium text-foreground">
                Código de moneda
              </label>
              <Input
                id="wiz-code"
                className={inputClass}
                value={currencyCode}
                maxLength={3}
                required
                onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="wiz-symbol" className="block text-sm font-medium text-foreground">
                Símbolo de moneda
              </label>
              <Input
                id="wiz-symbol"
                className={inputClass}
                value={currencySymbol}
                maxLength={5}
                required
                onChange={(event) => setCurrencySymbol(event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="wiz-logo" className="block text-sm font-medium text-foreground">
                URL del logo (opcional)
              </label>
              <Input
                id="wiz-logo"
                className={inputClass}
                value={logoUrl}
                maxLength={300}
                placeholder="https://…  o  /logo.png"
                onChange={(event) => setLogoUrl(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="primary" loading={busy} onClick={saveBusiness}>
                Guardar y continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Categorías</CardTitle>
            <CardDescription>
              Crea al menos una categoría para organizar tus productos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-56 flex-1 space-y-1.5">
                <label
                  htmlFor="wiz-category"
                  className="block text-sm font-medium text-foreground"
                >
                  Nombre de la categoría
                </label>
                <Input
                  id="wiz-category"
                  className={inputClass}
                  value={categoryName}
                  maxLength={60}
                  placeholder="Ej. Bebidas"
                  onChange={(event) => setCategoryName(event.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" loading={busy} onClick={addCategory}>
                Agregar
              </Button>
            </div>

            {createdCategories.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label="Categorías creadas">
                {createdCategories.map((category) => (
                  <li
                    key={category}
                    className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-foreground"
                  >
                    {category}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted" role="status">
                Todavía no agregaste categorías.
              </p>
            )}

            <div className="flex justify-between gap-2">
              <Button type="button" variant="secondary" onClick={goBack}>
                Atrás
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={createdCategories.length === 0}
                onClick={goNext}
              >
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Productos (CSV)</CardTitle>
            <CardDescription>
              Pega un CSV con tus productos (columnas: nombre, precio, costo, stock, stock_minimo).
              Este paso es opcional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="wiz-csv" className="block text-sm font-medium text-foreground">
                Contenido del CSV
              </label>
              <textarea
                id="wiz-csv"
                className="min-h-40 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={csv}
                onChange={(event) => {
                  setCsv(event.target.value);
                  setImportedCount(null);
                  setCsvErrors([]);
                }}
                placeholder={"nombre,precio,costo,stock,stock_minimo\nCoca-Cola 2L,12.50,8.00,24,6"}
              />
            </div>

            {csvErrors.length > 0 ? (
              <div role="alert" className="rounded-card border border-danger/30 bg-danger/10 p-3">
                <p className="text-sm font-semibold text-danger">
                  El archivo tiene errores y no se importó:
                </p>
                <ul className="mt-1 list-inside list-disc text-sm text-danger">
                  {csvErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {importedCount !== null ? (
              <p role="status" className="text-sm text-success">
                Se importaron {importedCount} productos.
              </p>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="secondary" onClick={goBack}>
                Atrás
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={csv.trim().length === 0}
                  loading={busy}
                  onClick={importCsv}
                >
                  Importar productos
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={goNext}
                >
                  Continuar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle>Saldo inicial de caja</CardTitle>
            <CardDescription>
              Abre la caja del día con el efectivo con el que empiezas. También puedes omitirlo y
              abrir la caja luego desde Caja.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="wiz-opening" className="block text-sm font-medium text-foreground">
                  Saldo inicial ({initialSettings.currency_symbol})
                </label>
                <Input
                  id="wiz-opening"
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={opening}
                  onChange={(event) => setOpening(event.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="wiz-notes" className="block text-sm font-medium text-foreground">
                  Notas (opcional)
                </label>
                <Input
                  id="wiz-notes"
                  className={inputClass}
                  value={notes}
                  maxLength={500}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="secondary" onClick={goBack}>
                Atrás
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setFinished(true)}>
                  Omitir
                </Button>
                <Button type="button" variant="primary" loading={busy} onClick={openCash}>
                  Abrir caja y finalizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
