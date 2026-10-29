import type { Metadata } from "next";
import { Package } from "lucide-react";
import { CatalogClient } from "@/components/catalog/catalog-client";
import { listCategoriesAction } from "@/lib/actions/categories";
import { listProductsAction } from "@/lib/actions/products";
import { requireRole } from "@/lib/auth";
import type { Category, Product } from "@/lib/repos/types";

export const metadata: Metadata = {
  title: "Productos",
  description: "Administración del catálogo de productos y categorías.",
};

export default async function ProductosPage() {
  await requireRole("owner", "/caja");

  let categories: Category[] = [];
  let products: Product[] = [];
  let total = 0;
  let page = 1;
  let totalPages = 1;

  try {
    const [categoriesResult, productsResult] = await Promise.all([
      listCategoriesAction(),
      listProductsAction({ page: 1, pageSize: 20 }),
    ]);

    if (categoriesResult.ok) {
      categories = categoriesResult.data;
    }
    if (productsResult.ok) {
      products = productsResult.data.items;
      total = productsResult.data.total;
      page = productsResult.data.page;
      totalPages = productsResult.data.totalPages;
    }
  } catch {
    categories = [];
    products = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Package className="h-6 w-6 text-primary" aria-hidden="true" />
          Productos
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Gestiona el catálogo, los precios y la organización de tu minimarket.
        </p>
      </div>

      <CatalogClient
        initialCategories={categories}
        initialProducts={products}
        initialTotal={total}
        initialPage={page}
        initialTotalPages={totalPages}
      />
    </div>
  );
}
