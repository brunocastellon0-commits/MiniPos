export interface CartProductLike {
  id: string;
  name: string;
  price_cents: number;
  stock_qty: number;
  min_stock: number;
  active: boolean;
}

export interface CartLine {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export interface Cart {
  lines: CartLine[];
}

export type AddProductErrorCode = "INACTIVE" | "OUT_OF_STOCK" | "EXCEEDS_STOCK";

export type CartResult =
  | { ok: true; cart: Cart }
  | { ok: false; code: "INVALID_QUANTITY" | "NOT_FOUND" | AddProductErrorCode; message: string };

export interface CartOptions {
  allowNegativeStock: boolean;
}

export type StockState = "out" | "low" | "ok";

export function createCart(): Cart {
  return { lines: [] };
}

export function cartUnits(cart: Cart): number {
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartProductCount(cart: Cart): number {
  return cart.lines.length;
}

export function findLine(cart: Cart, productId: string): CartLine | undefined {
  return cart.lines.find((line) => line.productId === productId);
}

export function productStockState(product: Pick<CartProductLike, "stock_qty" | "min_stock">): StockState {
  if (product.stock_qty <= 0) return "out";
  if (product.stock_qty <= product.min_stock) return "low";
  return "ok";
}

function stockError(cart: Cart, product: CartProductLike, amount: number, options: CartOptions): CartResult | null {
  if (!product.active) {
    return { ok: false, code: "INACTIVE", message: "Producto inactivo." };
  }
  if (options.allowNegativeStock) return null;

  const current = findLine(cart, product.id)?.quantity ?? 0;
  const wanted = current + amount;

  if (product.stock_qty <= 0) {
    return { ok: false, code: "OUT_OF_STOCK", message: "Producto agotado." };
  }
  if (wanted > product.stock_qty) {
    return {
      ok: false,
      code: "EXCEEDS_STOCK",
      message: `Solo hay ${product.stock_qty} unidades disponibles.`,
    };
  }
  return null;
}

export function addProduct(
  cart: Cart,
  product: CartProductLike,
  options: CartOptions,
  amount = 1,
): CartResult {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, code: "INVALID_QUANTITY", message: "La cantidad debe ser mayor a cero." };
  }

  const stockErrorResult = stockError(cart, product, amount, options);
  if (stockErrorResult) return stockErrorResult;

  const existing = findLine(cart, product.id);
  if (existing) {
    return {
      ok: true,
      cart: {
        lines: cart.lines.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + amount } : line,
        ),
      },
    };
  }

  return {
    ok: true,
    cart: {
      lines: [
        ...cart.lines,
        {
          productId: product.id,
          name: product.name,
          unitPriceCents: product.price_cents,
          quantity: amount,
        },
      ],
    },
  };
}

export function setQuantity(
  cart: Cart,
  product: CartProductLike,
  quantity: number,
  options: CartOptions,
): CartResult {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    return { ok: false, code: "INVALID_QUANTITY", message: "La cantidad no puede ser negativa." };
  }
  if (quantity === 0) {
    return { ok: true, cart: removeLine(cart, product.id) };
  }

  const existingLine = findLine(cart, product.id);
  if (!existingLine) {
    return { ok: false, code: "NOT_FOUND", message: "El producto no está en el carrito." };
  }

  const delta = quantity - existingLine.quantity;
  if (delta > 0) {
    const stockErrorResult = stockError(cart, product, delta, options);
    if (stockErrorResult) return stockErrorResult;
  }

  return {
    ok: true,
    cart: {
      lines: cart.lines.map((line) =>
        line.productId === product.id ? { ...line, quantity } : line,
      ),
    },
  };
}

export function removeLine(cart: Cart, productId: string): Cart {
  return { lines: cart.lines.filter((line) => line.productId !== productId) };
}

export function clearCart(): Cart {
  return createCart();
}

export function cartSubtotalCents(cart: Cart): number {
  return cart.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
}

export type DiscountResult =
  | { ok: true; discountCents: number }
  | { ok: false; code: "INVALID_DISCOUNT" | "DISCOUNT_EXCEEDS" | "DISCOUNT_INVALID_PERCENT"; message: string };

export function calculateDiscount(
  subtotalCents: number,
  discount: { type: "amount"; valueCents: number } | { type: "percent"; value: number },
): DiscountResult {
  if (discount.type === "amount") {
    if (!Number.isSafeInteger(discount.valueCents) || discount.valueCents < 0) {
      return { ok: false, code: "INVALID_DISCOUNT", message: "Descuento inválido." };
    }
    if (discount.valueCents > subtotalCents) {
      return {
        ok: false,
        code: "DISCOUNT_EXCEEDS",
        message: "El descuento no puede superar el subtotal.",
      };
    }
    return { ok: true, discountCents: discount.valueCents };
  }

  if (!Number.isFinite(discount.value) || discount.value < 0 || discount.value > 100) {
    return {
      ok: false,
      code: "DISCOUNT_INVALID_PERCENT",
      message: "El porcentaje debe estar entre 0 y 100.",
    };
  }

  const discountCents = Math.round((subtotalCents * discount.value) / 100);
  if (discountCents > subtotalCents) {
    return {
      ok: false,
      code: "DISCOUNT_EXCEEDS",
      message: "El descuento no puede superar el subtotal.",
    };
  }
  return { ok: true, discountCents };
}

export interface CartTotals {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

export function cartTotals(cart: Cart, discountCents = 0): CartTotals {
  const subtotalCents = cartSubtotalCents(cart);
  const safeDiscount = Math.min(Math.max(0, discountCents), subtotalCents);
  return {
    subtotalCents,
    discountCents: safeDiscount,
    totalCents: subtotalCents - safeDiscount,
  };
}
