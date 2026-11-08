import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShoppingCart, Wallet } from "lucide-react";
import { PosClient } from "@/components/pos/pos-client";
import { OrdersView } from "@/components/orders/orders-view";
import { buttonClasses } from "@/components/ui/button";
import { getCashOverviewAction } from "@/lib/actions/cash";
import { listCategoriesAction } from "@/lib/actions/categories";
import { listOrdersAction } from "@/lib/actions/orders";
import { listPosProductsAction } from "@/lib/actions/products-search";
import { getBusinessPublicAction } from "@/lib/actions/settings";
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Caja",
  description: "Punto de venta y pedidos del negocio.",
};

interface CajaPageProps {
  searchParams: Promise<{ vista?: string }>;
}

export default async function CajaPage({ searchParams }: CajaPageProps) {
  const user = await requireUser("/login");
  const params = await searchParams;

  let overviewResult: Awaited<ReturnType<typeof getCashOverviewAction>>;
  let initialProducts: Awaited<ReturnType<typeof listPosProductsAction>>;
  let categories: Awaited<ReturnType<typeof listCategoriesAction>>;
  let publicSettings: Awaited<ReturnType<typeof getBusinessPublicAction>> | null;

  try {
    [overviewResult, initialProducts, categories, publicSettings] = await Promise.all([
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
    initialProducts = { ok: false, code: "INTERNAL_ERROR", message: "No se pudo cargar el catálogo." };
    categories = { ok: false, code: "INTERNAL_ERROR", message: "No se pudieron cargar las categorías." };
    publicSettings = null;
  }

  const overview = overviewResult.ok ? overviewResult.data : null;
  const settings = publicSettings?.ok ? publicSettings.data : null;
  const isRestaurant = settings?.operating_mode === "restaurant";
  const enableHeldSales = settings?.enable_held_sales ?? true;
  const showPos = !isRestaurant || params.vista === "pos";

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
            <Link href="/turno" className={buttonClasses()}>
              Abrir turno
            </Link>
          }
        />
      </div>
    );
  }

  if (isRestaurant && !showPos) {
    let ordersResult: Awaited<ReturnType<typeof listOrdersAction>>;
    try {
      ordersResult = await listOrdersAction({});
    } catch {
      ordersResult = {
        ok: false,
        code: "INTERNAL_ERROR",
        message: "No se pudieron cargar los pedidos.",
      };
    }

    return (
      <OrdersView
        orders={ordersResult.ok ? ordersResult.data.orders : []}
        items={ordersResult.ok ? ordersResult.data.items : []}
        cashierNames={ordersResult.ok ? ordersResult.data.cashierNames : {}}
        error={ordersResult.ok ? null : ordersResult.message}
      />
    );
  }

  const products = initialProducts.ok ? initialProducts.data : [];
  const categoryList = categories.ok
    ? categories.data.filter((item) => item.active)
    : [];

  let canDiscount = true;
  if (user.role !== "owner") {
    canDiscount = settings !== null && settings.cashier_can_discount;
  }

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

  if (isRestaurant && showPos) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Modo restaurante</p>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
              <ShoppingCart className="h-6 w-6 text-primary" aria-hidden="true" />
              Venta directa
            </h1>
          </div>
          <Link
            href="/caja"
            className={buttonClasses({ variant: "secondary" })}
            data-testid="volver-pedidos-link"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver a pedidos
          </Link>
        </div>
        <PosClient
          initialProducts={products}
          categories={categoryList}
          overview={overview}
          canDiscount={canDiscount}
          enableHeldSales={enableHeldSales}
        />
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
          Busca productos, agrega al carrito y cobra. F2 para buscar — F9 para cobrar.
        </p>
      </div>
      <PosClient
        initialProducts={products}
        categories={categoryList}
        overview={overview}
        canDiscount={canDiscount}
        enableHeldSales={enableHeldSales}
      />
    </div>
  );
}
