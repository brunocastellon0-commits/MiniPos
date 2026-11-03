import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { InventoryView } from "@/components/inventory/inventory-view";
import { listInventoryProductsAction, listStockMovementsAction } from "@/lib/actions/inventory";
import { listUsersAction } from "@/lib/actions/users";
import { requireRole } from "@/lib/auth";
import type { Product, StockMovement } from "@/lib/repos/types";

export const metadata: Metadata = {
  title: "Inventario",
  description: "Existencias, alertas de stock bajo e historial de movimientos.",
};

export default async function InventarioPage() {
  await requireRole("owner", "/caja");

  let products: Product[] = [];
  let movements: StockMovement[] = [];
  let userNames: Record<string, string> = {};
  let initialError: string | null = null;

  try {
    const [productsResult, movementsResult, usersResult] = await Promise.all([
      listInventoryProductsAction(),
      listStockMovementsAction({ limit: 200 }),
      listUsersAction(),
    ]);

    if (productsResult.ok) {
      products = productsResult.data;
    } else {
      initialError = productsResult.message;
    }
    if (movementsResult.ok) {
      movements = movementsResult.data;
    } else {
      initialError = initialError ?? movementsResult.message;
    }
    if (usersResult.ok) {
      userNames = Object.fromEntries(usersResult.data.map((profile) => [profile.id, profile.full_name]));
    }
  } catch {
    initialError = "No se pudo cargar el inventario.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Boxes className="h-6 w-6 text-primary" aria-hidden="true" />
          Inventario
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Existencias con estado, alertas de reposición e historial de cada movimiento.
        </p>
      </div>

      <InventoryView
        initialProducts={products}
        initialMovements={movements}
        userNames={userNames}
        initialError={initialError}
      />
    </div>
  );
}
