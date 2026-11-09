"use client";

import { Table, Td, Th } from "@/components/ui/table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/dates";
import { formatBs } from "@/lib/money";
import type { Purchase, PurchaseItem } from "@/lib/repos/types";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableRow } from "@/components/ui/expandable-row";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelPurchaseAction,
  getPurchaseAction,
  getPurchaseTimelineAction,
  registerPurchaseVisitAction,
} from "@/lib/actions/purchases";
import { getProductNamesAction } from "@/lib/actions/products";
import type { PurchaseTimelineEntry } from "@/lib/actions/purchases-core";

const STATUS_META: Record<Purchase["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  ordered: { label: "En pedido", tone: "info" },
  partial: { label: "Parcial", tone: "warning" },
  received: { label: "Recibida", tone: "success" },
  cancelled: { label: "Cancelada", tone: "danger" },
};

type GroupFilter = "all" | "pending" | "partial" | "received" | "cancelled";

const GROUPS: Array<{ value: GroupFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "partial", label: "Parciales" },
  { value: "received", label: "Recibidas" },
  { value: "cancelled", label: "Canceladas" },
];

const TIMELINE_LABELS: Record<string, string> = {
  "purchases.create": "Compra registrada",
  "purchases.receive": "Recepción de mercadería",
  "purchases.cancel": "Compra cancelada",
  "purchases.visit": "Visita de preventista",
};

function matchesGroup(status: Purchase["status"], group: GroupFilter): boolean {
  switch (group) {
    case "all":
      return true;
    case "pending":
      return status === "draft" || status === "ordered";
    case "partial":
      return status === "partial";
    case "received":
      return status === "received";
    case "cancelled":
      return status === "cancelled";
  }
}

function timelineLabel(action: string): string {
  return TIMELINE_LABELS[action] ?? action;
}

function canAct(purchase: Purchase): boolean {
  return purchase.status === "draft" || purchase.status === "ordered" || purchase.status === "partial";
}

interface PurchaseDetailState {
  items: PurchaseItem[];
  productNames: Record<string, string>;
  timeline: PurchaseTimelineEntry[];
  loading: boolean;
  error?: string;
}

export interface PurchasesViewProps {
  initialPurchases: Purchase[];
  supplierNames: Record<string, string>;
  initialError?: string | null;
}

export function PurchasesView({ initialPurchases, supplierNames, initialError = null }: PurchasesViewProps) {
  const [group, setGroup] = useState<GroupFilter>("all");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Purchase["status"]>>({});
  const [details, setDetails] = useState<Record<string, PurchaseDetailState>>({});
  const [cancelOpenId, setCancelOpenId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [visitNotes, setVisitNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { tone: "success" | "danger"; text: string }>>({});

  const effective = useMemo(
    () =>
      initialPurchases.map((purchase) => ({
        ...purchase,
        status: statusOverrides[purchase.id] ?? purchase.status,
      })),
    [initialPurchases, statusOverrides],
  );

  const counts = useMemo(() => {
    const result: Record<GroupFilter, number> = {
      all: effective.length,
      pending: 0,
      partial: 0,
      received: 0,
      cancelled: 0,
    };
    for (const purchase of effective) {
      if (purchase.status === "draft" || purchase.status === "ordered") result.pending += 1;
      else if (purchase.status === "partial") result.partial += 1;
      else if (purchase.status === "received") result.received += 1;
      else result.cancelled += 1;
    }
    return result;
  }, [effective]);

  const filtered = useMemo(
    () => effective.filter((purchase) => matchesGroup(purchase.status, group)),
    [effective, group],
  );

  function setMessage(purchaseId: string, tone: "success" | "danger", text: string) {
    setMessages((prev) => ({ ...prev, [purchaseId]: { tone, text } }));
  }

  async function handleRowToggle(purchaseId: string, expanded: boolean) {
    if (!expanded) return;
    const existing = details[purchaseId];
    if (existing && !existing.error) return;

    setDetails((prev) => ({
      ...prev,
      [purchaseId]: { items: [], productNames: {}, timeline: [], loading: true },
    }));

    try {
      const detailResult = await getPurchaseAction({ id: purchaseId });
      if (!detailResult.ok) {
        setDetails((prev) => ({
          ...prev,
          [purchaseId]: {
            items: [],
            productNames: {},
            timeline: [],
            loading: false,
            error: detailResult.message,
          },
        }));
        return;
      }

      const items = detailResult.data.items;
      const productIds = [...new Set(items.map((item) => item.product_id))];
      if (productIds.length === 0) {
        setDetails((prev) => ({
          ...prev,
          [purchaseId]: { items, productNames: {}, timeline: [], loading: false },
        }));
        return;
      }

      const [namesResult, timelineResult] = await Promise.all([
        getProductNamesAction({ ids: productIds }),
        getPurchaseTimelineAction({ purchaseId }),
      ]);

      setDetails((prev) => ({
        ...prev,
        [purchaseId]: {
          items,
          productNames: namesResult.ok ? namesResult.data : {},
          timeline: timelineResult.ok ? timelineResult.data : [],
          loading: false,
        },
      }));
    } catch {
      setDetails((prev) => ({
        ...prev,
        [purchaseId]: {
          items: [],
          productNames: {},
          timeline: [],
          loading: false,
          error: "No se pudo cargar el detalle de la compra.",
        },
      }));
    }
  }

  async function refreshTimeline(purchaseId: string) {
    const timelineResult = await getPurchaseTimelineAction({ purchaseId });
    if (!timelineResult.ok) return;
    setDetails((prev) => {
      const current = prev[purchaseId];
      if (!current) return prev;
      return { ...prev, [purchaseId]: { ...current, timeline: timelineResult.data } };
    });
  }

  async function handleCancel(purchaseId: string) {
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setMessage(purchaseId, "danger", "El motivo debe tener al menos 3 caracteres.");
      return;
    }
    setBusyId(purchaseId);
    setMessages((prev) => {
      const next = { ...prev };
      delete next[purchaseId];
      return next;
    });
    try {
      const result = await cancelPurchaseAction({ purchaseId, reason });
      if (!result.ok) {
        setMessage(purchaseId, "danger", result.message);
        return;
      }
      setStatusOverrides((prev) => ({ ...prev, [purchaseId]: "cancelled" }));
      setCancelOpenId(null);
      setCancelReason("");
      setMessage(purchaseId, "success", "Compra cancelada. El stock no se modifica.");
      await refreshTimeline(purchaseId);
    } catch {
      setMessage(purchaseId, "danger", "No se pudo cancelar la compra.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRegisterVisit(purchaseId: string) {
    setBusyId(purchaseId);
    setMessages((prev) => {
      const next = { ...prev };
      delete next[purchaseId];
      return next;
    });
    try {
      const notes = visitNotes[purchaseId]?.trim();
      const result = await registerPurchaseVisitAction(
        notes ? { purchaseId, notes } : { purchaseId },
      );
      if (!result.ok) {
        setMessage(purchaseId, "danger", result.message);
        return;
      }
      setVisitNotes((prev) => ({ ...prev, [purchaseId]: "" }));
      setMessage(purchaseId, "success", "Visita del preventista registrada.");
      await refreshTimeline(purchaseId);
    } catch {
      setMessage(purchaseId, "danger", "No se pudo registrar la visita.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {initialError ? (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {initialError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
          {GROUPS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={group === option.value}
              onClick={() => setGroup(option.value)}
              className={
                group === option.value
                  ? buttonClasses({ variant: "primary", size: "sm" })
                  : buttonClasses({ variant: "secondary", size: "sm" })
              }
            >
              {option.label} ({counts[option.value]})
            </button>
          ))}
        </div>
        <Link href="/compras/nueva" className={buttonClasses({ variant: "primary" })}>
          Nueva compra
        </Link>
      </div>

      {initialPurchases.length === 0 ? (
        <EmptyState
          title="No hay compras registradas"
          description="Registra un pedido para empezar a recibir mercadería."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Sin resultados" description="No hay compras en este estado." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <Table className="min-w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <Th scope="col">
                  <span className="sr-only">Expandir</span>
                </Th>
                <Th scope="col">Fecha</Th>
                <Th scope="col">Proveedor</Th>
                <Th scope="col" className="text-right">
                  Total
                </Th>
                <Th scope="col">Estado</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((purchase) => {
                const detail = details[purchase.id];
                const message = messages[purchase.id];
                const busy = busyId === purchase.id;
                return (
                  <ExpandableRow
                    key={purchase.id}
                    colSpan={4}
                    onToggle={(expanded) => void handleRowToggle(purchase.id, expanded)}
                    summary={
                      <>
                        <Td className="whitespace-nowrap text-muted">
                          {formatDateTime(new Date(purchase.created_at))}
                        </Td>
                        <Td className="text-foreground">
                          {purchase.supplier_id ? (supplierNames[purchase.supplier_id] ?? "—") : "—"}
                        </Td>
                        <Td className="whitespace-nowrap text-right font-medium text-foreground tabular-nums">
                          {formatBs(purchase.total_cents)}
                        </Td>
                        <Td>
                          <Badge tone={STATUS_META[purchase.status].tone}>
                            {STATUS_META[purchase.status].label}
                          </Badge>
                        </Td>
                      </>
                    }
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                          Detalle de la compra
                        </h4>
                        <Link
                          href={`/compras/${purchase.id}`}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Ver página completa →
                        </Link>
                      </div>

                      {detail?.loading ? (
                        <div className="space-y-2 py-1" aria-live="polite">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      ) : detail?.error ? (
                        <p className="text-xs text-danger">{detail.error}</p>
                      ) : detail ? (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="border-b border-border text-muted">
                                <tr>
                                  <th scope="col" className="py-1.5 pr-3 font-medium">
                                    Producto
                                  </th>
                                  <th scope="col" className="py-1.5 pr-3 font-medium">
                                    Ordenado
                                  </th>
                                  <th scope="col" className="py-1.5 pr-3 font-medium">
                                    Recibido
                                  </th>
                                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                                    Costo unit.
                                  </th>
                                  <th scope="col" className="py-1.5 text-right font-medium">
                                    Subtotal
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {detail.items.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="py-2 text-muted">
                                      Esta compra no tiene ítems registrados.
                                    </td>
                                  </tr>
                                ) : (
                                  detail.items.map((item) => (
                                    <tr key={item.product_id}>
                                      <td className="py-1.5 pr-3 text-foreground">
                                        {detail.productNames[item.product_id] ?? "—"}
                                      </td>
                                      <td className="py-1.5 pr-3 tabular-nums text-foreground-muted">
                                        {item.qty_ordered}
                                      </td>
                                      <td className="py-1.5 pr-3 tabular-nums text-foreground-muted">
                                        {item.qty_received}
                                      </td>
                                      <td className="py-1.5 pr-3 text-right tabular-nums text-foreground-muted">
                                        {formatBs(item.unit_cost_cents)}
                                      </td>
                                      <td className="py-1.5 text-right tabular-nums text-foreground">
                                        {formatBs(item.qty_ordered * item.unit_cost_cents)}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                              {detail.items.length > 0 ? (
                                <tfoot>
                                  <tr className="border-t border-border font-medium text-foreground">
                                    <td colSpan={4} className="py-1.5 pr-3 text-right">
                                      Total
                                    </td>
                                    <td className="py-1.5 text-right tabular-nums">
                                      {formatBs(
                                        detail.items.reduce(
                                          (sum, item) => sum + item.qty_ordered * item.unit_cost_cents,
                                          0,
                                        ),
                                      )}
                                    </td>
                                  </tr>
                                </tfoot>
                              ) : null}
                            </table>
                          </div>

                          {purchase.notes ? (
                            <p className="text-xs text-muted">
                              <span className="font-semibold text-foreground-muted">Notas:</span>{" "}
                              {purchase.notes}
                            </p>
                          ) : null}

                          <div className="flex flex-wrap items-end gap-2">
                            {canAct(purchase) ? (
                              <Link
                                href={`/compras/${purchase.id}`}
                                className={buttonClasses({ variant: "primary", size: "sm" })}
                              >
                                Recibir mercadería
                              </Link>
                            ) : null}

                            {purchase.status !== "cancelled" ? (
                              <div className="flex items-end gap-2">
                                <label className="flex flex-col gap-1">
                                  <span className="text-xs text-muted">Nota de visita (opcional)</span>
                                  <input
                                    type="text"
                                    value={visitNotes[purchase.id] ?? ""}
                                    onChange={(event) =>
                                      setVisitNotes((prev) => ({
                                        ...prev,
                                        [purchase.id]: event.target.value,
                                      }))
                                    }
                                    maxLength={300}
                                    placeholder="Dejó muestras, pidió catálogo..."
                                    className="h-9 w-56 rounded-md border border-border bg-surface px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  />
                                </label>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => void handleRegisterVisit(purchase.id)}
                                >
                                  Registrar visita
                                </Button>
                              </div>
                            ) : null}

                            {canAct(purchase) ? (
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                disabled={busy}
                                onClick={() => {
                                  setCancelOpenId((current) =>
                                    current === purchase.id ? null : purchase.id,
                                  );
                                  setCancelReason("");
                                }}
                              >
                                Cancelar compra
                              </Button>
                            ) : null}
                          </div>

                          {cancelOpenId === purchase.id ? (
                            <div className="space-y-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
                              <label
                                htmlFor={`cancel-reason-${purchase.id}`}
                                className="block text-xs font-semibold text-foreground"
                              >
                                Motivo de la cancelación (obligatorio)
                              </label>
                              <Textarea
                                id={`cancel-reason-${purchase.id}`}
                                rows={2}
                                value={cancelReason}
                                maxLength={300}
                                onChange={(event) => setCancelReason(event.target.value)}
                                placeholder="Ej: el proveedor no tiene la mercadería"
                              />
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => void handleCancel(purchase.id)}
                                >
                                  {busy ? "Cancelando..." : "Confirmar cancelación"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => {
                                    setCancelOpenId(null);
                                    setCancelReason("");
                                  }}
                                >
                                  Volver
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {message ? (
                            <p
                              role={message.tone === "danger" ? "alert" : "status"}
                              className={
                                message.tone === "danger"
                                  ? "text-xs font-medium text-danger"
                                  : "text-xs font-medium text-success"
                              }
                            >
                              {message.text}
                            </p>
                          ) : null}

                          <div>
                            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted">
                              Historial de la compra
                            </h5>
                            {detail.timeline.length === 0 ? (
                              <p className="mt-1 text-xs text-muted">
                                Sin movimientos registrados todavía.
                              </p>
                            ) : (
                              <ol className="mt-1.5 space-y-1.5">
                                {detail.timeline.map((entry) => (
                                  <li key={entry.id} className="flex flex-wrap gap-x-2 text-xs">
                                    <span className="whitespace-nowrap text-muted tabular-nums">
                                      {formatDateTime(new Date(entry.at))}
                                    </span>
                                    <span className="font-medium text-foreground">
                                      {timelineLabel(entry.action)}
                                    </span>
                                    {entry.userName ? (
                                      <span className="text-foreground-muted">· {entry.userName}</span>
                                    ) : null}
                                    {entry.reason ? (
                                      <span className="text-muted">({entry.reason})</span>
                                    ) : null}
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </ExpandableRow>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      <section
        aria-label="Proveedores"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground">Proveedores</h2>
          <p className="mt-0.5 text-xs text-muted">
            Administra el directorio de proveedores por separado del registro de compras.
          </p>
        </div>
        <Link href="/proveedores" className={buttonClasses({ variant: "secondary" })}>
          Administrar proveedores
        </Link>
      </section>
    </div>
  );
}
