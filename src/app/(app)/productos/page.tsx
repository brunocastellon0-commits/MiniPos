import type { Metadata } from "next";
import { Package } from "lucide-react";
import { CategoriesPanel } from "@/components/catalog/categories-panel";
import { listCategoriesAction } from "@/lib/actions/categories";
import { requireRole } from "@/lib/auth";
import type { Category } from "@/lib/repos/types";

export const metadata: Metadata = {
  title: "Productos",
  description: "Administración del catálogo de productos y categorías.",
};

export default async function ProductosPage() {
  await requireRole("owner", "/caja");

  let categories: Category[] = [];
  try {
    const result = await listCategoriesAction();
    if (result.ok) {
      categories = result.data;
    }
  } catch {
    categories = [];
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

      <CategoriesPanel initialCategories={categories} />
    </div>
  );
}
