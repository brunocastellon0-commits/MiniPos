import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PurchaseReceiveView } from "@/components/purchases/purchase-receive-view";
import { EmptyState } from "@/components/ui/empty-state";
import { getPurchaseAction } from "@/lib/actions/purchases";
import { listPosProductsAction } from "@/lib/actions/products-search";
import { listSuppliersAction } from "@/lib/actions/suppliers";
import { formatDateTime } from "@/lib/dates";
import { requireRole } from "@/lib/auth";
import type { Purchase, PurchaseItem } from "@/lib/repos/types";

export const metadata: Metadata = {
  title: "Detalle de compra",
  description: "Recepción total o parcial de una compra.",
};

interface CompraDetallePageProps {
  params: Promise<{ id: string }>;
}

type ViewState =
  | { kind: "error"; title: string; description: string }
  | {
      kind: "ok";
      purchase: Purchase;
      items: PurchaseItem[];
      productNames: Record<string, string>;
      supplierName: string;
    };

function BackLink() {
  return (
    <Link
      href="/compras"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Volver a compras
    </Link>
  );
}

export default async function CompraDetallePage({ params }: CompraDetallePageProps) {
  await requireRole("owner", "/caja");
  const { id } = await params;

  let state: ViewState;

  try {
    const [purchaseResult, productsResult, suppliersResult] = await Promise.all([
      getPurchaseAction({ id }),
      listPosProductsAction({ limit: 200 }),
      listSuppliersAction(),
    ]);

    if (!purchaseResult.ok) {
      state = {
        kind: "error",
        title: "Compra no encontrada",
        description: purchaseResult.message,
      };
    } else {
      const { purchase, items } = purchaseResult.data;

      const productNames: Record<string, string> = productsResult.ok
        ? Object.fromEntries(productsResult.data.map((product) => [product.id, product.name]))
        : {};
      const supplierName =
        suppliersResult.ok && purchase.supplier_id
          ? (suppliersResult.data.find((supplier) => supplier.id === purchase.supplier_id)?.name ??
            "—")
          : "—";

      state = { kind: "ok", purchase, items, productNames, supplierName };
    }
  } catch {
    state = {
      kind: "error",
      title: "No se pudo cargar la compra",
      description: "Intenta de nuevo en unos segundos.",
    };
  }

  if (state.kind === "error") {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState title={state.title} description={state.description} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Compra a {state.supplierName}
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Registrada el {formatDateTime(new Date(state.purchase.created_at))}
            {state.purchase.notes ? ` · ${state.purchase.notes}` : ""}
          </p>
        </div>
        <BackLink />
      </div>

      <PurchaseReceiveView
        purchase={state.purchase}
        items={state.items}
        productNames={state.productNames}
      />
    </div>
  );
}
