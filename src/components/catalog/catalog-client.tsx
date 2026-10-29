"use client";

import { useState } from "react";
import { FolderTree, Package } from "lucide-react";
import type { Category, Product } from "@/lib/repos/types";
import { CategoriesPanel } from "./categories-panel";
import { ProductsPanel } from "./products-panel";

type CatalogTab = "productos" | "categorias";

export interface CatalogClientProps {
  initialCategories: Category[];
  initialProducts: Product[];
  initialTotal: number;
  initialPage: number;
  initialTotalPages: number;
}

export function CatalogClient({
  initialCategories,
  initialProducts,
  initialTotal,
  initialPage,
  initialTotalPages,
}: CatalogClientProps) {
  const [tab, setTab] = useState<CatalogTab>("productos");
  const [categories, setCategories] = useState<Category[]>(initialCategories);

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Secciones del catálogo" className="flex gap-1 border-b border-border">
        <TabButton
          active={tab === "productos"}
          onClick={() => setTab("productos")}
          icon={<Package className="h-4 w-4" aria-hidden="true" />}
        >
          Productos
        </TabButton>
        <TabButton
          active={tab === "categorias"}
          onClick={() => setTab("categorias")}
          icon={<FolderTree className="h-4 w-4" aria-hidden="true" />}
        >
          Categorías
        </TabButton>
      </div>

      {tab === "productos" ? (
        <ProductsPanel
          initialProducts={initialProducts}
          initialTotal={initialTotal}
          initialPage={initialPage}
          initialTotalPages={initialTotalPages}
          categories={categories}
        />
      ) : (
        <CategoriesPanel initialCategories={categories} onCategoriesChange={setCategories} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "flex items-center gap-2 border-b-2 border-primary px-4 py-2.5 text-sm font-medium text-primary"
          : "flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-foreground-muted hover:text-foreground"
      }
    >
      {icon}
      {children}
    </button>
  );
}
