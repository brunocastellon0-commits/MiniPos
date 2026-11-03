import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NewPurchaseForm } from "@/components/purchases/new-purchase-form";
import { EmptyState } from "@/components/ui/empty-state";
import { listInventoryProductsAction } from "@/lib/actions/inventory";
import { listPosProductsAction } from "@/lib/actions/products-search";
import { listSuppliersAction } from "@/lib/actions/suppliers";
import { requireRole } from "@/lib/auth";
import type { Product, Supplier } from "@/lib/repos/types";

export const metadata: Metadata = {
  title: "Nueva compra",
  description: "Registra un pedido a proveedor con cantidades y costos.",
};

interface NuevaCompraPageProps {
  searchParams: Promise<{ low?: string }>;
}

export default async function NuevaCompraPage({ searchParams }: NuevaCompraPageProps) {
  await requireRole("owner", "/caja");
  const params = await searchParams;

  let suppliers: Supplier[] = [];
  let products: Product[] = [];
  let initialItems: { productId: string; quantity: number }[] = [];
  let loadError: string | null = null;

  try {
    const [suppliersResult, productsResult] = await Promise.all([
      listSuppliersAction({ activeOnly: true }),
      listPosProductsAction({ limit: 200 }),
    ]);

    if (suppliersResult.ok) {
      suppliers = suppliersResult.data;
    } else {
      loadError = suppliersResult.message;
    }
    if (productsResult.ok) {
      products = productsResult.data;
    } else {
      loadError = loadError ?? productsResult.message;
    }

    if (params.low === "1") {
      const inventoryResult = await listInventoryProductsAction();
      if (inventoryResult.ok) {
        initialItems = inventoryResult.data
          .filter((product) => product.active && product.stock_qty <= product.min_stock)
          .map((product) => ({
            productId: product.id,
            quantity: Math.max(product.min_stock - product.stock_qty, 1),
          }));
      }
    }
  } catch {
    loadError = "No se pudo cargar el formulario de compra.";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Nueva compra</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Registra el pedido con cantidades y costos. El stock subirá al confirmar la recepción.
          </p>
        </div>
        <Link
          href="/compras"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a compras
        </Link>
      </div>

      {loadError ? (
        <EmptyState title="No se pudo cargar" description={loadError} />
      ) : (
        <NewPurchaseForm suppliers={suppliers} products={products} initialItems={initialItems} />
      )}
    </div>
  );
}
