import type { Metadata } from "next";
import { ShoppingCart } from "lucide-react";
import { PurchasesView } from "@/components/purchases/purchases-view";
import { listPurchasesAction } from "@/lib/actions/purchases";
import { listSuppliersAction } from "@/lib/actions/suppliers";
import { requireRole } from "@/lib/auth";
import type { Purchase, Supplier } from "@/lib/repos/types";

export const metadata: Metadata = {
  title: "Compras",
  description: "Pedidos a proveedores, recepción parcial o total e historial.",
};

export default async function ComprasPage() {
  await requireRole("owner", "/caja");

  let purchases: Purchase[] = [];
  let supplierNames: Record<string, string> = {};
  let initialError: string | null = null;

  try {
    const [purchasesResult, suppliersResult] = await Promise.all([
      listPurchasesAction(),
      listSuppliersAction(),
    ]);

    if (purchasesResult.ok) {
      purchases = purchasesResult.data;
    } else {
      initialError = purchasesResult.message;
    }
    if (suppliersResult.ok) {
      supplierNames = Object.fromEntries(
        suppliersResult.data.map((supplier: Supplier) => [supplier.id, supplier.name]),
      );
    }
  } catch {
    initialError = "No se pudieron cargar las compras.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ShoppingCart className="h-6 w-6 text-primary" aria-hidden="true" />
          Compras
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Pedidos a proveedores y su recepción. El stock sube solo con lo recibido.
        </p>
      </div>

      <PurchasesView
        initialPurchases={purchases}
        supplierNames={supplierNames}
        initialError={initialError}
      />
    </div>
  );
}
