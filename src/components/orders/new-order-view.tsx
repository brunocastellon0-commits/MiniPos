"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOrderAction } from "@/lib/actions/orders";
import { searchPosProductsAction } from "@/lib/actions/products-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addProduct,
  cartSubtotalCents,
  clearCart,
  createCart,
  productStockState,
  removeLine,
  setQuantity,
  type Cart,
  type CartProductLike,
} from "@/lib/domain/cart";
import { formatBs } from "@/lib/money";
import type { Category, Product } from "@/lib/repos/types";
import { PaymentMethodDialog } from "./payment-method-dialog";

export interface NewOrderViewProps {
  initialProducts: Product[];
  categories: Category[];
  chargeTiming: "on_order" | "on_consumption";
}

const cartOptions = { allowNegativeStock: false };

function toCartProduct(product: Product): CartProductLike {
  return {
    id: product.id,
    name: product.name,
    price_cents: product.price_cents,
    stock_qty: product.stock_qty,
    min_stock: product.min_stock,
    active: product.active,
  };
}

function StockBadge({ product }: { product: Product }) {
  const state = productStockState(product);
  if (state === "out") return <Badge tone="danger">Agotado</Badge>;
  if (state === "low") return <Badge tone="warning">Stock bajo · {product.stock_qty}</Badge>;
  return <Badge tone="success">Disponible · {product.stock_qty}</Badge>;
}

export function NewOrderView({ initialProducts, categories, chargeTiming }: NewOrderViewProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart>(createCart);
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialProducts;
    return initialProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.internal_code && p.internal_code.toLowerCase().includes(q)),
    );
  }, [query, initialProducts]);

  const visibleProducts = useMemo(() => {
    if (!category) return products;
    return products.filter((product) => product.category_id === category);
  }, [products, category]);

  const totalCents = cartSubtotalCents(cart);
  const canCreate = cart.lines.length > 0 && !submitting;

  function handleAdd(product: Product) {
    const result = addProduct(cart, toCartProduct(product), cartOptions);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setCart(result.cart);
    setNotice(null);
  }

  function handleQuantity(product: Product, quantity: number) {
    const result = setQuantity(cart, toCartProduct(product), quantity, cartOptions);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setCart(result.cart);
    setNotice(null);
  }

  async function handleSearchEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const code = query.trim();
    if (!code) return;
    const result = await searchPosProductsAction({ query: code, limit: 5 });
    if (result.ok) {
      const exact = result.data.find((p) => p.barcode === code || p.internal_code === code);
      const target = exact ?? result.data[0];
      if (target) handleAdd(target);
      else setNotice("No se encontró un producto con ese código.");
    }
  }

  function buildItems() {
    return cart.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
    }));
  }

  async function submitOrder(payment?: {
    paymentMethod: "cash" | "qr" | "card";
    cashReceivedCents?: number;
    clientRequestId: string;
  }): Promise<{ ok: boolean; message?: string }> {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createOrderAction({
        items: buildItems(),
        notes: notes.trim() ? notes.trim() : null,
        paymentMethod: payment?.paymentMethod,
        cashReceivedCents: payment?.cashReceivedCents,
        clientRequestId: payment?.clientRequestId,
      });
      if (!result.ok) {
        setError(result.message);
        return { ok: false, message: result.message };
      }
      router.push(`/caja/pedido/${result.data.order.id}`);
      router.refresh();
      return { ok: true };
    } catch {
      const message = "No se pudo crear el pedido. Tus productos siguen aquí; intenta de nuevo.";
      setError(message);
      return { ok: false, message };
    } finally {
      setSubmitting(false);
    }
  }

  function handleCreate() {
    if (!canCreate) return;
    if (chargeTiming === "on_order") {
      setPaymentOpen(true);
      return;
    }
    void submitOrder();
  }

  return (
    <div className="space-y-4">
      <Link
        href="/caja"
        className={buttonClasses({ variant: "secondary" })}
        data-testid="new-order-back-link"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a pedidos
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section aria-label="Catálogo de productos" className="space-y-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchEnter}
              placeholder="Buscar por nombre o código (Enter para código de barras)"
              aria-label="Buscar productos"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Categorías">
            <Button
              size="sm"
              variant={category === null ? "primary" : "secondary"}
              onClick={() => setCategory(null)}
            >
              Todas
            </Button>
            {categories.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={category === item.id ? "primary" : "secondary"}
                onClick={() => setCategory(item.id)}
              >
                {item.name}
              </Button>
            ))}
          </div>

          {visibleProducts.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="Prueba con otro nombre o código de barras."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((product) => {
                const out = productStockState(product) === "out" || !product.active;
                return (
                  <Card key={product.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{product.name}</CardTitle>
                      <p className="text-lg font-bold text-primary tabular-nums">
                        {formatBs(product.price_cents)}
                      </p>
                    </CardHeader>
                    <CardContent className="mt-auto flex items-center justify-between gap-2 pt-0">
                      <StockBadge product={product} />
                      <Button
                        size="sm"
                        onClick={() => handleAdd(product)}
                        disabled={out || !product.active}
                      >
                        Agregar
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <aside id="pedido" aria-label="Pedido" className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="size-5 text-primary" aria-hidden="true" />
                Pedido
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCart(clearCart())}
                disabled={cart.lines.length === 0}
              >
                Vaciar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.lines.length === 0 ? (
                <EmptyState
                  title="Pedido vacío"
                  description="Agrega productos para comenzar el pedido."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {cart.lines.map((line) => (
                    <li
                      key={line.productId}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {line.name}
                        </p>
                        <p className="text-xs text-muted tabular-nums">
                          {formatBs(line.unitPriceCents)} c/u
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Quitar unidad de ${line.name}`}
                          onClick={() => {
                            const product = products.find((p) => p.id === line.productId);
                            if (product) handleQuantity(product, line.quantity - 1);
                          }}
                        >
                          <Minus className="size-4" aria-hidden="true" />
                        </Button>
                        <span
                          className="w-8 text-center text-sm font-semibold tabular-nums"
                          aria-label={`Cantidad de ${line.name}`}
                        >
                          {line.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Agregar unidad de ${line.name}`}
                          onClick={() => {
                            const product = products.find((p) => p.id === line.productId);
                            if (product) handleQuantity(product, line.quantity + 1);
                          }}
                        >
                          <Plus className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Eliminar ${line.name} del pedido`}
                          onClick={() => setCart(removeLine(cart, line.productId))}
                        >
                          <Trash2 className="size-4 text-danger" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {notice ? (
                <p role="alert" className="text-sm text-danger">
                  {notice}
                </p>
              ) : null}

              <div className="space-y-1.5 border-t border-border pt-3">
                <label htmlFor="order-notes" className="text-sm font-medium text-foreground">
                  Notas del pedido
                </label>
                <Textarea
                  id="order-notes"
                  value={notes}
                  maxLength={500}
                  rows={2}
                  placeholder="Ej. sin cebolla, extra ají…"
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <dl className="space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Productos</dt>
                  <dd className="font-medium text-foreground tabular-nums">
                    {cart.lines.reduce((sum, line) => sum + line.quantity, 0)}
                  </dd>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <dt className="text-foreground">Total</dt>
                  <dd className="text-foreground tabular-nums">{formatBs(totalCents)}</dd>
                </div>
              </dl>

              {error ? (
                <p role="alert" className="text-sm text-danger" data-testid="create-order-error">
                  {error}
                </p>
              ) : null}

              <Button
                className="w-full"
                size="lg"
                onClick={handleCreate}
                disabled={!canCreate}
                loading={submitting}
                data-testid="create-order-button"
              >
                {chargeTiming === "on_order" ? "Crear pedido y cobrar" : "Crear pedido"}
              </Button>
              <p className="text-center text-xs text-muted">
                {chargeTiming === "on_order"
                  ? "El cobro y el stock se registran al crear el pedido."
                  : "El cobro se registra al finalizar el consumo."}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      {paymentOpen ? (
        <PaymentMethodDialog
          open
          title="Cobrar pedido"
          totalCents={totalCents}
          onClose={() => setPaymentOpen(false)}
          onConfirm={async (input) => submitOrder(input)}
          successLabel="Pedido cobrado"
        />
      ) : null}
    </div>
  );
}
