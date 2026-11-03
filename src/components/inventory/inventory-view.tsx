"use client";

import { AlertTriangle, Check, PackageX, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { productStockState, type StockState } from "@/lib/domain/cart";
import { countLowStock } from "@/lib/domain/inventory";
import { formatDateTime } from "@/lib/dates";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { Product, StockMovement } from "@/lib/repos/types";

type EstadoFilter = "all" | StockState;
type Tab = "stock" | "history";

const KIND_LABELS: Record<string, string> = {
  sale: "Venta",
  purchase: "Compra",
  adjustment: "Ajuste",
  waste: "Merma",
  void_return: "Anulación",
};

const STATE_META: Record<
  StockState,
  { label: string; tone: BadgeTone; Icon: typeof Check }
> = {
  out: { label: "Agotado", tone: "danger", Icon: PackageX },
  low: { label: "Bajo", tone: "warning", Icon: AlertTriangle },
  ok: { label: "OK", tone: "success", Icon: Check },
};

const KIND_TONES: Record<string, BadgeTone> = {
  sale: "info",
  purchase: "accent",
  adjustment: "neutral",
  waste: "danger",
  void_return: "warning",
};

export interface InventoryViewProps {
  initialProducts: Product[];
  initialMovements: StockMovement[];
  userNames: Record<string, string>;
  initialError?: string | null;
}

export function InventoryView({
  initialProducts,
  initialMovements,
  userNames,
  initialError = null,
}: InventoryViewProps) {
  const [tab, setTab] = useState<Tab>("stock");
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<EstadoFilter>("all");

  const products = useMemo(
    () => [...initialProducts].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [initialProducts],
  );

  const productNames = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );

  const lowCount = countLowStock(products.filter((product) => product.active));

  const filteredProducts = products.filter((product) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      product.name.toLowerCase().includes(query) ||
      (product.barcode ?? "").toLowerCase().includes(query) ||
      (product.internal_code ?? "").toLowerCase().includes(query);

    const state = productStockState(product);
    const matchesState = estado === "all" || state === estado;
    return matchesSearch && matchesState;
  });

  return (
    <div className="space-y-4">
      {initialError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {initialError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={tab === "stock" ? "primary" : "ghost"}
          aria-pressed={tab === "stock"}
          onClick={() => setTab("stock")}
        >
          Existencias
        </Button>
        <Button
          type="button"
          variant={tab === "history" ? "primary" : "ghost"}
          aria-pressed={tab === "history"}
          onClick={() => setTab("history")}
        >
          Historial de movimientos
        </Button>
        {lowCount > 0 ? (
          <span className="ms-auto inline-flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-sm font-medium text-warning">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {lowCount} {lowCount === 1 ? "producto requiere" : "productos requieren"} reposición
          </span>
        ) : null}
      </div>

      {tab === "stock" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Buscar producto por nombre o código"
                placeholder="Buscar por nombre o código"
                className="pl-9"
              />
            </div>
            <select
              value={estado}
              onChange={(event) => setEstado(event.target.value as EstadoFilter)}
              aria-label="Filtrar por estado"
              className="h-10 rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Todos los estados</option>
              <option value="out">Agotado</option>
              <option value="low">Bajo</option>
              <option value="ok">OK</option>
            </select>
          </div>

          {products.length === 0 ? (
            <EmptyState
              title="No hay productos en el inventario"
              description="Da de alta productos desde el catálogo para ver sus existencias."
            />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="Prueba con otra búsqueda u otro estado."
            />
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Producto
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Mínimo
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Existencias
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map((product) => {
                    const state = productStockState(product);
                    const meta = STATE_META[state];
                    return (
                      <tr key={product.id}>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{product.name}</span>
                            {!product.active ? <Badge tone="neutral">Inactivo</Badge> : null}
                          </div>
                          {product.barcode || product.internal_code ? (
                            <span className="mt-0.5 block text-xs text-muted">
                              {product.barcode || product.internal_code}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right text-foreground-muted">
                          {product.min_stock}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {product.stock_qty}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={meta.tone}>
                            <meta.Icon className="size-3" aria-hidden="true" />
                            {meta.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : initialMovements.length === 0 ? (
        <EmptyState
          title="Sin movimientos registrados"
          description="Las ventas, compras, anulaciones, ajustes y mermas aparecerán aquí."
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Fecha
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Producto
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Origen
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Cantidad
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Motivo
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Usuario
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {initialMovements.map((movement) => (
                <tr key={movement.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-foreground-muted">
                    {formatDateTime(new Date(movement.created_at))}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {productNames.get(movement.product_id) ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={KIND_TONES[movement.kind] ?? "neutral"}>
                        {KIND_LABELS[movement.kind] ?? movement.kind}
                      </Badge>
                      {movement.ref_type === "sale" && movement.ref_id ? (
                        <Link
                          href={`/ventas/${movement.ref_id}`}
                          className="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Ver venta
                        </Link>
                      ) : null}
                      {movement.ref_type === "purchase" && movement.ref_id ? (
                        <Link
                          href={`/compras/${movement.ref_id}`}
                          className="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Ver compra
                        </Link>
                      ) : null}
                    </div>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      movement.delta > 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">{movement.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground">
                    {userNames[movement.user_id] ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
