import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { SalesHistory } from "@/components/sales/sales-history";
import { listSalesAction } from "@/lib/actions/sales";
import { requireUser } from "@/lib/auth";
import type { Sale } from "@/lib/repos/types";

export const metadata: Metadata = {
  title: "Ventas",
  description: "Historial de ventas con filtros y detalle de cada venta.",
};

export default async function VentasPage() {
  const user = await requireUser("/login");

  let initialSales: Sale[] = [];
  let initialCashierNames: Record<string, string> = {};
  let initialError: string | null = null;
  let initialHasMore = false;

  try {
    const result = await listSalesAction({});
    if (result.ok) {
      initialSales = result.data.sales;
      initialCashierNames = result.data.cashierNames;
      initialHasMore = result.data.hasMore;
    } else {
      initialError = result.message;
    }
  } catch {
    initialError = "No se pudieron cargar las ventas.";
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Receipt className="h-6 w-6 text-primary" aria-hidden="true" />
          Ventas
        </h1>
        <p className="mt-1 text-sm text-muted">
          Historial de ventas: filtra por fecha, método, cajero y estado. N.º para ver el detalle.
        </p>
      </div>
      <SalesHistory
        initialSales={initialSales}
        initialCashierNames={initialCashierNames}
        isOwner={user.role === "owner"}
        initialError={initialError}
        initialHasMore={initialHasMore}
      />
    </div>
  );
}
