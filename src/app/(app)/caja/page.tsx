import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart, Wallet } from "lucide-react";
import { PosClient } from "@/components/pos/pos-client";
import { getCashOverviewAction } from "@/lib/actions/cash";
import { listCategoriesAction } from "@/lib/actions/categories";
import { listPosProductsAction } from "@/lib/actions/products-search";
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Caja (POS)",
  description: "Punto de venta: buscar, cobrar y atender clientes.",
};

export default async function CajaPage() {
  await requireUser("/login");

  const overviewResult = await getCashOverviewAction();
  const overview = overviewResult.ok ? overviewResult.data : null;

  if (!overview) {
    return (
      <div className="space-y-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ShoppingCart className="h-6 w-6 text-primary" aria-hidden="true" />
          Caja
        </h1>
        <EmptyState
          icon={<Wallet className="size-10" aria-hidden="true" />}
          title="No hay turno de caja abierto"
          description="Abre un turno con tu saldo inicial antes de registrar ventas."
          action={
            <Link
              href="/turno"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Abrir turno
            </Link>
          }
        />
      </div>
    );
  }

  let initialProducts: Awaited<ReturnType<typeof listPosProductsAction>>;
  let categories: Awaited<ReturnType<typeof listCategoriesAction>>;

  try {
    [initialProducts, categories] = await Promise.all([
      listPosProductsAction(),
      listCategoriesAction(),
    ]);
  } catch {
    initialProducts = { ok: false, code: "INTERNAL_ERROR", message: "No se pudo cargar el catálogo." };
    categories = { ok: false, code: "INTERNAL_ERROR", message: "No se pudieron cargar las categorías." };
  }

  const products = initialProducts.ok ? initialProducts.data : [];
  const categoryList = categories.ok
    ? categories.data.filter((item) => item.active)
    : [];

  if (!initialProducts.ok) {
    return (
      <div className="space-y-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ShoppingCart className="h-6 w-6 text-primary" aria-hidden="true" />
          Caja
        </h1>
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {initialProducts.message || "No se pudo cargar el catálogo."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ShoppingCart className="h-6 w-6 text-primary" aria-hidden="true" />
          Nueva venta
        </h1>
        <p className="mt-1 text-sm text-muted">
          Busca productos, agrega al carrito y cobra. F2 para buscar · F9 para cobrar.
        </p>
      </div>
      <PosClient initialProducts={products} categories={categoryList} overview={overview} />
    </div>
  );
}
