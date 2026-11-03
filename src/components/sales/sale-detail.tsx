import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import { formatBs } from "@/lib/money";
import type { Sale, SaleItem } from "@/lib/repos/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VoidSaleButton } from "./void-sale-button";

const METHOD_LABELS: Record<string, string> = { cash: "Efectivo", qr: "QR", card: "Tarjeta" };

const backLinkClasses =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export interface SaleDetailProps {
  sale: Sale;
  items: SaleItem[];
  cashierName: string;
  canVoid?: boolean;
}

export function SaleDetail({ sale, items, cashierName, canVoid = false }: SaleDetailProps) {
  return (
    <div className="space-y-4">
      <Link href="/ventas" className={backLinkClasses}>
        Volver a ventas
      </Link>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Venta #{sale.number}</CardTitle>
          <div className="flex items-center gap-2">
            {canVoid && sale.status === "paid" ? <VoidSaleButton saleId={sale.id} /> : null}
            <Badge tone={sale.status === "voided" ? "danger" : "success"}>
              {sale.status === "voided" ? "Anulada" : "Pagada"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted">Fecha</dt>
              <dd className="font-medium text-foreground">
                {formatDateTime(new Date(sale.created_at))}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Cajero</dt>
              <dd className="font-medium text-foreground">{cashierName}</dd>
            </div>
            <div>
              <dt className="text-muted">Método de pago</dt>
              <dd className="font-medium text-foreground">
                {METHOD_LABELS[sale.payment_method] ?? sale.payment_method}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Efectivo recibido</dt>
              <dd className="font-medium text-foreground">
                {sale.cash_received_cents !== null ? formatBs(sale.cash_received_cents) : "—"}
              </dd>
            </div>
          </dl>

          {sale.status === "voided" ? (
            <div className="space-y-1 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm">
              <p className="font-semibold text-danger">Venta anulada</p>
              <p className="text-foreground">Motivo: {sale.void_reason ?? "—"}</p>
              <p className="text-foreground-muted">
                Anulada el {sale.voided_at ? formatDateTime(new Date(sale.voided_at)) : "—"}
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-card border border-border">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Producto
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Precio unit.
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Cantidad
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-foreground">{item.name_snapshot}</td>
                    <td className="px-4 py-3 text-right text-foreground-muted">
                      {formatBs(item.unit_price_cents)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">{item.quantity}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatBs(item.line_total_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-medium text-foreground">{formatBs(sale.subtotal_cents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Descuento</dt>
              <dd className="font-medium text-foreground">-{formatBs(sale.discount_cents)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt className="text-foreground">Total</dt>
              <dd className="text-foreground">{formatBs(sale.total_cents)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
