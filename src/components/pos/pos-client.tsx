"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Pause, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import type { CashOverview } from "@/lib/actions/cash-core";
import { saveHeldSaleAction } from "@/lib/actions/held-sales";
import { getProductsByIdsAction, searchPosProductsAction } from "@/lib/actions/products-search";
import {
  addProduct,
  calculateDiscount,
  cartSubtotalCents,
  cartTotals,
  cartUnits,
  clearCart,
  createCart,
  productStockState,
  removeLine,
  setQuantity,
  type Cart,
  type CartProductLike,
} from "@/lib/domain/cart";
import { formatBs, toCents } from "@/lib/money";
import type { Category, Product, Sale } from "@/lib/repos/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { HeldSalesDialog, PauseSaleDialog } from "./held-sales";
import { PaymentDialog, SaleConfirmation } from "./payment-dialog";
import { TicketDialog } from "./ticket";

export interface PosClientProps {
  initialProducts: Product[];
  categories: Category[];
  overview: CashOverview;
  canDiscount: boolean;
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

export function PosClient({
  initialProducts,
  categories,
  overview,
  canDiscount,
}: PosClientProps) {
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart>(createCart);
  const [discountCents, setDiscountCents] = useState(0);
  const [discountInput, setDiscountInput] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [showDiscount, setShowDiscount] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<{
    sale: Sale;
    changeCents: number;
  } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const hasQuery = query.trim().length > 0;
  const products = useMemo(
    () => (hasQuery ? (searchResults ?? []) : initialProducts),
    [hasQuery, searchResults, initialProducts],
  );

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!cancelled) setSearching(true);
      try {
        const result = await searchPosProductsAction({ query: query.trim(), limit: 50 });
        if (!cancelled && result.ok) setSearchResults(result.data);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const visibleProducts = useMemo(() => {
    if (!category) return products;
    return products.filter((product) => product.category_id === category);
  }, [products, category]);

  const handleAdd = useCallback(
    (product: Product) => {
      const result = addProduct(cart, toCartProduct(product), cartOptions);
      if (!result.ok) {
        setCartNotice(result.message);
        return;
      }
      setCart(result.cart);
      setCartNotice(null);
    },
    [cart],
  );

  const handleQuantity = useCallback(
    (product: Product, quantity: number) => {
      const result = setQuantity(cart, toCartProduct(product), quantity, cartOptions);
      if (!result.ok) {
        setCartNotice(result.message);
        return;
      }
      setCart(result.cart);
      setCartNotice(null);
    },
    [cart],
  );

  function applyDiscount() {
    setDiscountError(null);
    let discount:
      | { type: "amount"; valueCents: number }
      | { type: "percent"; value: number };

    if (discountType === "amount") {
      let valueCents: number;
      try {
        valueCents = toCents(discountInput || "0");
      } catch {
        setDiscountError("Ingresa un descuento válido.");
        return;
      }
      discount = { type: "amount", valueCents };
    } else {
      const normalized = discountInput.trim().replace(/\s+/g, "").replace(",", ".");
      const value = normalized === "" ? 0 : Number(normalized);
      if (!Number.isFinite(value)) {
        setDiscountError("Ingresa un descuento válido.");
        return;
      }
      discount = { type: "percent", value };
    }

    const result = calculateDiscount(cartSubtotalCents(cart), discount);
    if (!result.ok) {
      setDiscountError(result.message);
      return;
    }
    setDiscountCents(result.discountCents);
    setShowDiscount(false);
    setDiscountInput("");
  }

  const totals = cartTotals(cart, discountCents);

  async function handleSearchEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const code = query.trim();
    if (!code) return;

    const result = await searchPosProductsAction({ query: code, limit: 5 });
    if (!result.ok) {
      setCartNotice("No se pudo validar el código. Intenta de nuevo.");
      return;
    }

    const normalized = code.toLowerCase();
    const match = result.data.find(
      (candidate) =>
        (candidate.barcode !== null && candidate.barcode.toLowerCase() === normalized) ||
        (candidate.internal_code !== null &&
          candidate.internal_code.toLowerCase() === normalized),
    );

    if (!match) {
      setCartNotice(`Código no encontrado: ${code}`);
      searchRef.current?.focus();
      return;
    }

    handleAdd(match);
    setQuery("");
    setSearchResults(null);
    searchRef.current?.focus();
  }

  async function handlePauseSave(label: string): Promise<string | null> {
    const result = await saveHeldSaleAction({
      label,
      cart: { lines: cart.lines },
    });
    if (!result.ok) return result.message;
    setCart(createCart());
    setDiscountCents(0);
    setCartNotice(`Venta pausada: ${label}`);
    return null;
  }

  async function handleRecover(
    label: string,
    lines: Array<{ productId: string; quantity: number }>,
  ) {
    const idsResult = await getProductsByIdsAction({ ids: lines.map((line) => line.productId) });
    if (!idsResult.ok) {
      setCartNotice("No se pudo verificar el stock para recuperar la venta.");
      return;
    }

    const byId = new Map(idsResult.data.map((product) => [product.id, product]));
    let recovered: Cart = createCart();
    let skipped = 0;

    for (const line of lines) {
      const product = byId.get(line.productId);
      if (!product) {
        skipped += 1;
        continue;
      }
      const result = addProduct(recovered, toCartProduct(product), cartOptions, line.quantity);
      if (!result.ok) {
        skipped += 1;
        continue;
      }
      recovered = result.cart;
    }

    if (recovered.lines.length === 0) {
      setCartNotice("Ningún producto de la venta pausada está disponible.");
      setHeldOpen(false);
      return;
    }

    setCart(recovered);
    setDiscountCents(0);
    setHeldOpen(false);
    setCartNotice(
      skipped > 0
        ? `Venta "${label}" recuperada. ${skipped} producto(s) no disponibles.`
        : `Venta "${label}" recuperada.`,
    );
    searchRef.current?.focus();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "F9") {
        event.preventDefault();
        if (cart.lines.length > 0 && !paymentOpen) setPaymentOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.lines.length, paymentOpen]);

  return (
    <div className="space-y-4">
      {completedSale ? (
        <SaleConfirmation
          sale={completedSale.sale}
          changeCents={completedSale.changeCents}
          onPrint={() => setTicketOpen(true)}
          onNewSale={() => {
            setCompletedSale(null);
            setTicketOpen(false);
            setCart(createCart());
            setDiscountCents(0);
            searchRef.current?.focus();
          }}
        />
      ) : (
        <>
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
                placeholder="Buscar por nombre o código (F2)"
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

            {searching ? (
              <p className="text-sm text-muted" role="status">
                Buscando productos…
              </p>
            ) : null}

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
                        <p className="text-lg font-bold text-primary">
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

          <aside id="carrito" aria-label="Carrito" className="lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5 text-primary" aria-hidden="true" />
                  Carrito
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCart(clearCart());
                    setDiscountCents(0);
                  }}
                  disabled={cart.lines.length === 0}
                >
                  Vaciar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setPauseOpen(true)}
                    disabled={cart.lines.length === 0}
                  >
                    <Pause className="size-4" aria-hidden="true" />
                    Pausar venta
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setHeldOpen(true)}
                  >
                    Pausadas
                  </Button>
                </div>
                {cart.lines.length === 0 ? (
                  <EmptyState
                    title="Carrito vacío"
                    description="Agrega productos para comenzar la venta."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {cart.lines.map((line) => (
                      <li key={line.productId} className="flex items-center justify-between gap-2 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{line.name}</p>
                          <p className="text-xs text-muted">
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
                          <span className="w-8 text-center text-sm font-semibold" aria-label={`Cantidad de ${line.name}`}>
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
                            aria-label={`Eliminar ${line.name} del carrito`}
                            onClick={() => setCart(removeLine(cart, line.productId))}
                          >
                            <Trash2 className="size-4 text-danger" aria-hidden="true" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {cartNotice ? (
                  <p role="alert" className="text-sm text-danger">
                    {cartNotice}
                  </p>
                ) : null}

                <dl className="space-y-1 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Subtotal</dt>
                    <dd className="font-medium text-foreground">{formatBs(totals.subtotalCents)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Descuento</dt>
                    <dd className="font-medium text-foreground">-{formatBs(totals.discountCents)}</dd>
                  </div>
                </dl>

                {canDiscount ? (
                  showDiscount ? (
                    <div className="space-y-2">
                      <div className="flex gap-2" role="group" aria-label="Tipo de descuento">
                        <Button
                          size="sm"
                          variant={discountType === "amount" ? "primary" : "secondary"}
                          aria-pressed={discountType === "amount"}
                          onClick={() => {
                            setDiscountType("amount");
                            setDiscountInput("");
                            setDiscountError(null);
                          }}
                        >
                          Monto (Bs)
                        </Button>
                        <Button
                          size="sm"
                          variant={discountType === "percent" ? "primary" : "secondary"}
                          aria-pressed={discountType === "percent"}
                          onClick={() => {
                            setDiscountType("percent");
                            setDiscountInput("");
                            setDiscountError(null);
                          }}
                        >
                          Porcentaje (%)
                        </Button>
                      </div>
                      <Input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={discountInput}
                        aria-label={
                          discountType === "amount"
                            ? "Monto del descuento"
                            : "Porcentaje del descuento"
                        }
                        onChange={(event) => setDiscountInput(event.target.value)}
                      />
                      {discountError ? (
                        <p role="alert" className="text-sm text-danger">
                          {discountError}
                        </p>
                      ) : null}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={applyDiscount}>
                          Aplicar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowDiscount(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowDiscount(true)}
                      disabled={cart.lines.length === 0}
                    >
                      Agregar descuento
                    </Button>
                  )
                ) : null}

                <div
                  className="flex items-center justify-between border-t border-border pt-3"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="text-sm font-medium text-muted">Total</span>
                  <span className="text-2xl font-bold text-foreground">{formatBs(totals.totalCents)}</span>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setPaymentOpen(true)}
                  disabled={cart.lines.length === 0}
                >
                  Cobrar (F9)
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>

        <div
          className="sticky bottom-0 z-30 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 shadow-raised sm:-mx-6 sm:px-6 lg:hidden"
          role="region"
          aria-label="Resumen del carrito"
        >
          <div>
            <p className="text-xs text-muted">
              {cartUnits(cart)} {cartUnits(cart) === 1 ? "producto" : "productos"}
            </p>
            <p className="text-lg font-bold text-foreground">{formatBs(totals.totalCents)}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              document
                .getElementById("carrito")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Ver carrito
          </Button>
        </div>
        </>
      )}

      {paymentOpen ? (
        <PaymentDialog
          open
          overview={overview}
          totalCents={totals.totalCents}
          discountCents={totals.discountCents}
          items={cart.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          }))}
          onClose={() => setPaymentOpen(false)}
          onConfirmed={({ sale, changeCents }) => {
            setPaymentOpen(false);
            setCompletedSale({ sale, changeCents });
            setCart(createCart());
            setDiscountCents(0);
          }}
        />
      ) : null}

      {pauseOpen ? (
        <PauseSaleDialog
          onClose={() => setPauseOpen(false)}
          onPaused={() => setPauseOpen(false)}
          onSave={handlePauseSave}
        />
      ) : null}

      {heldOpen ? (
        <HeldSalesDialog
          onClose={() => setHeldOpen(false)}
          onRecovered={handleRecover}
        />
      ) : null}

      {completedSale && ticketOpen ? (
        <TicketDialog saleId={completedSale.sale.id} onClose={() => setTicketOpen(false)} />
      ) : null}
    </div>
  );
}
