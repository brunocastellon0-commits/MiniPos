import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ShoppingCart, Wallet } from "lucide-react";
import { NewOrderView } from "@/components/orders/new-order-view";
import { buttonClasses } from "@/components/ui/button-classes";
import { EmptyState } from "@/components/ui/empty-state";
import { getCashOverviewAction } from "@/lib/actions/cash";
import { listCategoriesAction } from "@/lib/actions/categories";
import { listPosProductsAction } from "@/lib/actions/products-search";
import { getBusinessPublicAction } from "@/lib/actions/settings";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Nuevo pedido",
  description: "Crea un pedido con catálogo, cantidades y notas.",
};

export default async function NewOrderPage() {
  await requireUser("/login");

  let overviewResult: Awaited<ReturnType<typeof getCashOverviewAction>>;
  let productsResult: Awaited<ReturnType<typeof listPosProductsAction>>;
  let categoriesResult: Awaited<ReturnType<typeof listCategoriesAction>>;
  let publicSettings: Awaited<ReturnType<typeof getBusinessPublicAction>> | null;

  try {
    [overviewResult, productsResult, categoriesResult, publicSettings] = await Promise.all([
      getCashOverviewAction(),
      listPosProductsAction(),
      listCategoriesAction(),
      getBusinessPublicAction(),
    ]);
  } catch {
    overviewResult = {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "No se pudo cargar la caja.",
    };
    productsResult = { ok: false, code: "INTERNAL_ERROR", message: "No se pudo cargar el catálogo." };
    categoriesResult = { ok: false, code: "INTERNAL_ERROR", message: "No se pudieron cargar las categorías." };
    publicSettings = null;
  }

  const overview = overviewResult.ok ? overviewResult.data : null;
  const settings = publicSettings?.ok ? publicSettings.data : null;

  const header = (
    <nav aria-label="Miga de pan" className="flex items-center gap-2 text-sm text-muted">
      <Link href="/caja" className="text-primary underline-offset-2 hover:underline">
        Pedidos
      </Link>
      <span aria-hidden="true">/</span>
      <span className="font-medium text-foreground">Nuevo pedido</span>
    </nav>
  );

  if (!overview) {
    return (
      <div className="space-y-4">
        {header}
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Plus className="h-6 w-6 text-primary" aria-hidden="true" />
          Nuevo pedido
        </h1>
        <EmptyState
          icon={<Wallet className="size-10" aria-hidden="true" />}
          title="No hay turno de caja abierto"
          description="Abre un turno con tu saldo inicial antes de crear pedidos."
          action={
            <Link href="/turno" className={buttonClasses()}>
              Abrir turno
            </Link>
          }
        />
      </div>
    );
  }

  if (!productsResult.ok) {
    return (
      <div className="space-y-4">
        {header}
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
        >
          {productsResult.message || "No se pudo cargar el catálogo."}
        </div>
      </div>
    );
  }

  const categories = categoriesResult.ok
    ? categoriesResult.data.filter((item) => item.active)
    : [];

  return (
    <div className="space-y-4">
      {header}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ShoppingCart className="h-6 w-6 text-primary" aria-hidden="true" />
          Nuevo pedido
        </h1>
        <p className="mt-1 text-sm text-muted">
          Busca productos, ajusta cantidades y agrega notas. El total se calcula con los precios
          del catálogo.
        </p>
      </div>
      <NewOrderView
        initialProducts={productsResult.data}
        categories={categories}
        chargeTiming={settings?.order_charge_timing ?? "on_order"}
      />
    </div>
  );
}
