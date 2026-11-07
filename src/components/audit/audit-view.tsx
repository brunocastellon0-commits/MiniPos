import { Table, Td, Th } from "@/components/ui/table";
import { AlertTriangle, ScrollText, ShieldCheck } from "lucide-react";
import type { AuditAlert } from "@/lib/domain/audit-alerts";
import { formatDateTime } from "@/lib/dates";
import { formatBs } from "@/lib/money";
import { EmptyState } from "@/components/ui/empty-state";
import type { AuditEntryView } from "@/lib/actions/audit-core";

const ACTION_LABELS: Record<string, string> = {
  "sales.confirm": "Cobro de venta",
  "sales.void": "Anulación de venta",
  "cash.open": "Apertura de caja",
  "cash.close": "Cierre de caja",
  "cash.movement": "Movimiento de caja",
  "inventory.adjust": "Ajuste de inventario",
  "purchases.create": "Compra registrada",
  "purchases.cancel": "Compra cancelada",
  "purchases.visit": "Visita de preventista",
  "purchases.receive": "Recepción de compra",
  "products.create": "Producto creado",
  "products.update": "Producto actualizado",
  "products.set_active": "Producto activado o desactivado",
  "products.import_csv": "Importación de productos (CSV)",
  "categories.create": "Categoría creada",
  "categories.update": "Categoría actualizada",
  "categories.delete": "Categoría eliminada",
  "categories.reorder": "Categorías reordenadas",
  "settings.update": "Configuración actualizada",
  "users.update_role": "Rol de usuario actualizado",
  "users.toggle_active": "Estado de usuario actualizado",
  "users.update_name": "Nombre de usuario actualizado",
  "auth.login_success": "Inicio de sesión",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function describeSummary(entry: AuditEntryView): string {
  const summary = entry.summary;
  if (typeof summary.totalCents === "number") {
    const parts = [`Total ${formatBs(summary.totalCents)}`];
    if (typeof summary.discountCents === "number" && summary.discountCents > 0) {
      parts.push(`Descuento ${formatBs(summary.discountCents)}`);
    }
    if (typeof summary.paymentMethod === "string") {
      parts.push(summary.paymentMethod.toUpperCase());
    }
    return parts.join(" · ");
  }

  const changed = summary.changed;
  if (Array.isArray(changed) && changed.every((key) => typeof key === "string")) {
    if (changed.length > 0) return `Campos: ${changed.join(", ")}`;
  } else if (changed && typeof changed === "object") {
    const fields = Object.keys(changed as Record<string, unknown>);
    if (fields.length > 0) return `Campos: ${fields.join(", ")}`;
  }

  if (entry.reason) return entry.reason;
  if (Object.keys(summary).length > 0) return JSON.stringify(summary);
  return "—";
}

export interface AuditViewProps {
  entries: AuditEntryView[];
  alerts: AuditAlert[];
}

export function AuditView({ entries, alerts }: AuditViewProps) {
  return (
    <div className="space-y-6">
      <section aria-label="Alertas de auditoría">
        <h2 className="text-lg font-semibold text-foreground">Alertas de las últimas 24 horas</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sin alertas en las últimas 24 horas.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {alerts.map((alert) => (
              <li
                key={alert.kind}
                role="alert"
                className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning/10 p-4"
              >
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
                <div>
                  <p className="font-medium text-foreground">{alert.title}</p>
                  <p className="text-sm text-muted">{alert.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Bitácora de auditoría">
        <h2 className="text-lg font-semibold text-foreground">Bitácora de auditoría</h2>
        {entries.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon={<ScrollText className="size-8" aria-hidden="true" />}
            title="Sin actividad registrada"
            description="Las acciones sensibles del sistema aparecerán aquí."
          />
        ) : (
          <div className="mt-3 overflow-x-auto rounded-card border border-border bg-surface">
            <Table className="min-w-full text-sm">
              <caption className="sr-only">Registro de acciones sensibles del sistema</caption>
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <Th scope="col">
                    Fecha
                  </Th>
                  <Th scope="col">
                    Usuario
                  </Th>
                  <Th scope="col">
                    Acción
                  </Th>
                  <Th scope="col">
                    Detalle
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <Td className="whitespace-nowrap text-foreground">
                      {formatDateTime(new Date(entry.at))}
                    </Td>
                    <Td className="whitespace-nowrap text-foreground">
                      {entry.userName ?? "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-foreground">
                      {actionLabel(entry.action)}
                    </Td>
                    <Td className="text-foreground-muted">{describeSummary(entry)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted">
        <ShieldCheck className="size-4" aria-hidden="true" />
        La bitácora es de solo consulta y no se puede editar ni eliminar.
      </p>
    </div>
  );
}
