"use client";

import { Table, Td, Th } from "@/components/ui/table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/dates";
import { formatBs } from "@/lib/money";
import type { Purchase } from "@/lib/repos/types";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_META: Record<Purchase["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  ordered: { label: "En pedido", tone: "info" },
  partial: { label: "Parcial", tone: "warning" },
  received: { label: "Recibida", tone: "success" },
  cancelled: { label: "Cancelada", tone: "danger" },
};

const STATUS_FILTERS: Array<{ value: Purchase["status"] | "all"; label: string }> = [
  { value: "all", label: "Todos los estados" },
  { value: "ordered", label: "En pedido" },
  { value: "partial", label: "Parcial" },
  { value: "received", label: "Recibida" },
  { value: "draft", label: "Borrador" },
  { value: "cancelled", label: "Cancelada" },
];

export interface PurchasesViewProps {
  initialPurchases: Purchase[];
  supplierNames: Record<string, string>;
  initialError?: string | null;
}

export function PurchasesView({ initialPurchases, supplierNames, initialError = null }: PurchasesViewProps) {
  const [status, setStatus] = useState<Purchase["status"] | "all">("all");

  const filtered = useMemo(
    () =>
      status === "all"
        ? initialPurchases
        : initialPurchases.filter((purchase) => purchase.status === status),
    [initialPurchases, status],
  );

  return (
    <div className="space-y-4">
      {initialError ? (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {initialError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/compras/nueva" className={buttonClasses({ variant: "primary" })}>
          Nueva compra
        </Link>
        <Link href="/proveedores" className={buttonClasses({ variant: "secondary" })}>
          Proveedores
        </Link>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as Purchase["status"] | "all")}
          aria-label="Filtrar por estado"
          className="ml-auto h-10 rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {initialPurchases.length === 0 ? (
        <EmptyState
          title="No hay compras registradas"
          description="Registra un pedido para empezar a recibir mercadería."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Sin resultados" description="No hay compras con ese estado." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <Table className="min-w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <Th scope="col">
                  Fecha
                </Th>
                <Th scope="col">
                  Proveedor
                </Th>
                <Th scope="col" className="text-right">
                  Total
                </Th>
                <Th scope="col">
                  Estado
                </Th>
                <Th scope="col">
                  Detalle
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((purchase) => (
                <tr key={purchase.id}>
                  <Td className="whitespace-nowrap text-foreground-muted">
                    {formatDateTime(new Date(purchase.created_at))}
                  </Td>
                  <Td className="text-foreground">
                    {purchase.supplier_id ? (supplierNames[purchase.supplier_id] ?? "—") : "—"}
                  </Td>
                  <Td className="text-right font-medium text-foreground">
                    {formatBs(purchase.total_cents)}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_META[purchase.status].tone}>
                      {STATUS_META[purchase.status].label}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/compras/${purchase.id}`}
                      className="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Ver compra
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
