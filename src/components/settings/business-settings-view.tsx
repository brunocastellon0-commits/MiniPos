"use client";

import { useState } from "react";
import { updateBusinessSettingsAction } from "@/lib/actions/settings";
import type { BusinessSettings } from "@/lib/repos/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";

export interface BusinessSettingsViewProps {
  initialSettings: BusinessSettings;
  initialError?: string | null;
}

const inputClass = "h-10 w-full";

export function BusinessSettingsView({
  initialSettings,
  initialError = null,
}: BusinessSettingsViewProps) {
  const [name, setName] = useState(initialSettings.name);
  const [legalName, setLegalName] = useState(initialSettings.legal_name ?? "");
  const [currencyCode, setCurrencyCode] = useState(initialSettings.currency_code);
  const [currencySymbol, setCurrencySymbol] = useState(initialSettings.currency_symbol);
  const [logoUrl, setLogoUrl] = useState(initialSettings.logo_url ?? "");
  const [allowNegative, setAllowNegative] = useState(initialSettings.allow_negative_stock);
  const [cashierCanDiscount, setCashierCanDiscount] = useState(
    initialSettings.cashier_can_discount,
  );
  const [lowStockDefault, setLowStockDefault] = useState(
    String(initialSettings.low_stock_default),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  function handleChange() {
    setSaved(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const result = await updateBusinessSettingsAction({
        name,
        legal_name: legalName,
        currency_code: currencyCode,
        currency_symbol: currencySymbol,
        logo_url: logoUrl,
        allow_negative_stock: allowNegative,
        cashier_can_discount: cashierCanDiscount,
        low_stock_default: Number(lowStockDefault),
      });
      if (result.ok) {
        setName(result.data.name);
        setLegalName(result.data.legal_name ?? "");
        setCurrencyCode(result.data.currency_code);
        setCurrencySymbol(result.data.currency_symbol);
        setLogoUrl(result.data.logo_url ?? "");
        setAllowNegative(result.data.allow_negative_stock);
        setCashierCanDiscount(result.data.cashier_can_discount);
        setLowStockDefault(String(result.data.low_stock_default));
        setSaved(true);
      } else {
        setError(result.message);
      }
    } catch {
      setError("No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      {saved ? (
        <Toast tone="success" title="Configuración guardada." data-testid="saved-toast" />
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" aria-label="Datos del negocio">
        <Card>
          <CardHeader>
            <CardTitle>Datos del negocio y marca</CardTitle>
            <CardDescription>
              Se muestra en la cabecera, el inicio de sesión y los comprobantes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="business-name" className="block text-sm font-medium text-foreground">
                Nombre del negocio
              </label>
              <Input
                id="business-name"
                className={inputClass}
                value={name}
                maxLength={80}
                required
                onChange={(event) => {
                  setName(event.target.value);
                  handleChange();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="business-legal-name" className="block text-sm font-medium text-foreground">
                Razón social
              </label>
              <Input
                id="business-legal-name"
                className={inputClass}
                value={legalName}
                maxLength={120}
                onChange={(event) => {
                  setLegalName(event.target.value);
                  handleChange();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="business-currency-code" className="block text-sm font-medium text-foreground">
                Código de moneda
              </label>
              <Input
                id="business-currency-code"
                className={inputClass}
                value={currencyCode}
                maxLength={3}
                required
                onChange={(event) => {
                  setCurrencyCode(event.target.value.toUpperCase());
                  handleChange();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="business-currency-symbol" className="block text-sm font-medium text-foreground">
                Símbolo de moneda
              </label>
              <Input
                id="business-currency-symbol"
                className={inputClass}
                value={currencySymbol}
                maxLength={5}
                required
                onChange={(event) => {
                  setCurrencySymbol(event.target.value);
                  handleChange();
                }}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="business-logo-url" className="block text-sm font-medium text-foreground">
                URL del logo
              </label>
              <Input
                id="business-logo-url"
                className={inputClass}
                value={logoUrl}
                maxLength={300}
                placeholder="https://…  o  /logo.png"
                onChange={(event) => {
                  setLogoUrl(event.target.value);
                  handleChange();
                }}
              />
              {logoUrl.trim().length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Vista previa del logo"
                  className="mt-2 h-12 rounded border border-border bg-surface object-contain p-1"
                />
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferencias de operación</CardTitle>
            <CardDescription>
              Reglas de venta y umbrales de inventario aplicadas por todo el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={allowNegative}
                onChange={(event) => {
                  setAllowNegative(event.target.checked);
                  handleChange();
                }}
                className="mt-0.5 size-4 rounded border-border accent-primary"
              />
              <span>
                Permitir stock negativo
                <span className="mt-1 block text-xs text-muted">
                  Si está desactivado, una venta que supere el stock disponible se rechaza.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={cashierCanDiscount}
                onChange={(event) => {
                  setCashierCanDiscount(event.target.checked);
                  handleChange();
                }}
                className="mt-0.5 size-4 rounded border-border accent-primary"
              />
              <span>
                El cajero puede aplicar descuentos
                <span className="mt-1 block text-xs text-muted">
                  Solo el dueño puede descontar cuando esta opción está apagada.
                </span>
              </span>
            </label>
            <div className="space-y-1.5 sm:max-w-40">
              <label
                htmlFor="business-low-stock-default"
                className="block text-sm font-medium text-foreground"
              >
                Stock bajo por defecto
              </label>
              <Input
                id="business-low-stock-default"
                type="number"
                min={0}
                max={9999}
                className={inputClass}
                value={lowStockDefault}
                onChange={(event) => {
                  setLowStockDefault(event.target.value);
                  handleChange();
                }}
              />
              <p className="text-xs text-muted">
                Umbral mínimo inicial de los productos nuevos (campo «stock mínimo»).
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="submit" variant="primary" loading={saving}>
            Guardar
          </Button>
        </div>
      </form>
    </div>
  );
}
