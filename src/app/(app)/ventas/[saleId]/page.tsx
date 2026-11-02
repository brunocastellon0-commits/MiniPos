import type { Metadata } from "next";
import Link from "next/link";
import { SaleDetail } from "@/components/sales/sale-detail";
import { EmptyState } from "@/components/ui/empty-state";
import { getSaleDetailAction } from "@/lib/actions/sales";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Detalle de venta",
};

const backLinkClasses =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  await requireUser("/login");
  const { saleId } = await params;

  const result = await getSaleDetailAction({ saleId });

  if (!result.ok) {
    return (
      <div className="space-y-4">
        {result.code === "NOT_FOUND" ? (
          <EmptyState
            title="Venta no encontrada"
            description="Puede que la venta no exista o no tengas permiso para verla."
          />
        ) : (
          <div
            role="alert"
            className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          >
            {result.message}
          </div>
        )}
        <Link href="/ventas" className={backLinkClasses}>
          Volver a ventas
        </Link>
      </div>
    );
  }

  return (
    <SaleDetail
      sale={result.data.sale}
      items={result.data.items}
      cashierName={result.data.cashierName}
    />
  );
}
