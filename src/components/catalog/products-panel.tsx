"use client";

import { useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Package,
  Pencil,
  Plus,
  Power,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { listProductsAction, setProductActiveAction } from "@/lib/actions/products";
import { formatBs } from "@/lib/money";
import type { Category, Product } from "@/lib/repos/types";
import { ProductFormDialog } from "./product-form-dialog";

type ProductStatus = "all" | "active" | "inactive" | "low";

export interface ProductsPanelProps {
  initialProducts: Product[];
  initialTotal: number;
  initialPage: number;
  initialTotalPages: number;
  categories: Category[];
}

export function ProductsPanel({
  initialProducts,
  initialTotal,
  initialPage,
  initialTotalPages,
  categories,
}: ProductsPanelProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<ProductStatus>("all");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  const load = async (overrides: {
    page?: number;
    search?: string;
    categoryId?: string;
    status?: ProductStatus;
  }) => {
    setLoading(true);
    setErrorMessage(null);

    const result = await listProductsAction({
      search: overrides.search ?? appliedSearch,
      categoryId: (overrides.categoryId ?? categoryId) || undefined,
      status: overrides.status ?? status,
      page: overrides.page ?? page,
      pageSize: 20,
    });

    setLoading(false);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setProducts(result.data.items);
    setTotal(result.data.total);
    setPage(result.data.page);
    setTotalPages(result.data.totalPages);
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setAppliedSearch(search);
    setSuccessMessage(null);
    void load({ search, page: 1 });
  };

  const handleClearFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setCategoryId("");
    setStatus("all");
    setSuccessMessage(null);
    void load({ search: "", categoryId: "", status: "all", page: 1 });
  };

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setSuccessMessage(null);
    void load({ categoryId: value, page: 1 });
  };

  const handleStatusChange = (value: ProductStatus) => {
    setStatus(value);
    setSuccessMessage(null);
    void load({ status: value, page: 1 });
  };

  const handleSaved = async (product: Product) => {
    await load({});
    setSuccessMessage(product.active ? "Producto guardado." : "Producto guardado como inactivo.");
    setProducts((previous) => {
      const exists = previous.some((item) => item.id === product.id);
      return exists
        ? previous.map((item) => (item.id === product.id ? product : item))
        : [product, ...previous];
    });
  };

  const handleToggleActive = async (product: Product) => {
    setPendingId(product.id);
    setErrorMessage(null);
    const result = await setProductActiveAction({ id: product.id, active: !product.active });
    setPendingId(null);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setProducts((previous) =>
      previous.map((item) => (item.id === result.data.id ? result.data : item)),
    );
    setSuccessMessage(result.data.active ? "Producto activado." : "Producto desactivado.");
  };

  const openCreate = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const hasFilters = appliedSearch !== "" || categoryId !== "" || status !== "all";

  return (
    <section className="space-y-4" aria-labelledby="products-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="products-title" className="text-lg font-semibold text-foreground">
            Catálogo
          </h2>
          <p className="text-sm text-foreground-muted">
            {total} {total === 1 ? "producto registrado" : "productos registrados"}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo producto
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, código de barras o código interno..."
            className="pl-9 text-sm"
            aria-label="Buscar productos"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryId}
            onChange={(event) => handleCategoryChange(event.target.value)}
            aria-label="Filtrar por categoría"
            className="h-10 rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => handleStatusChange(event.target.value as ProductStatus)}
            aria-label="Filtrar por estado"
            className="h-10 rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
            <option value="low">Stock bajo</option>
          </select>
          <Button type="submit" variant="secondary" disabled={loading}>
            Buscar
          </Button>
          {hasFilters ? (
            <Button type="button" variant="ghost" onClick={handleClearFilters} disabled={loading}>
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </form>

      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {successMessage ? <Toast tone="success" title={successMessage} /> : null}

      {loading ? (
        <div className="h-40 animate-pulse rounded-card border border-border bg-surface-muted" />
      ) : products.length === 0 ? (
        hasFilters ? (
          <EmptyState
            title="No hay productos que coincidan"
            description="Prueba con otro término de búsqueda o limpia los filtros."
            icon={<Search className="h-8 w-8" />}
            action={
              <Button variant="secondary" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Todavía no hay productos"
            description="Agrega tu primer producto para empezar a vender."
            icon={<Package className="h-8 w-8" />}
            action={
              <Button onClick={openCreate} variant="secondary" className="gap-2">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Crear producto
              </Button>
            }
          />
        )
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted/50 text-xs font-medium text-foreground-muted">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Producto
                </th>
                <th scope="col" className="px-4 py-3">
                  Categoría
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Precio
                </th>
                <th scope="col" className="px-4 py-3">
                  Stock
                </th>
                <th scope="col" className="px-4 py-3">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => {
                const isPending = pendingId === product.id;
                const isOut = product.stock_qty <= 0;
                const isLow = !isOut && product.stock_qty <= product.min_stock;
                return (
                  <tr key={product.id} className="hover:bg-surface-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{product.name}</div>
                      <div className="text-xs text-foreground-muted">
                        {product.barcode
                          ? `Código: ${product.barcode}`
                          : product.internal_code
                            ? `Interno: ${product.internal_code}`
                            : "Sin código"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {product.category_id
                        ? (categoryNames.get(product.category_id) ?? "Categoría eliminada")
                        : "Sin categoría"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                      {formatBs(product.price_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-foreground">{product.stock_qty}</span>
                        {isOut ? (
                          <Badge tone="danger">Agotado</Badge>
                        ) : isLow ? (
                          <Badge tone="warning">Stock bajo</Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-foreground-muted">
                        Mínimo: {product.min_stock}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={product.active ? "success" : "neutral"}>
                        {product.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          aria-label={`Editar ${product.name}`}
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => openEdit(product)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          aria-label={
                            product.active ? `Desactivar ${product.name}` : `Activar ${product.name}`
                          }
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => handleToggleActive(product)}
                        >
                          <Power className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginación de productos">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load({ page: page - 1 })}
            disabled={page <= 1 || loading}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Anterior
          </Button>
          <span className="text-sm text-foreground-muted">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load({ page: page + 1 })}
            disabled={page >= totalPages || loading}
            className="gap-1"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      ) : null}

      <ProductFormDialog
        product={editingProduct}
        categories={categories}
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={handleSaved}
      />
    </section>
  );
}
