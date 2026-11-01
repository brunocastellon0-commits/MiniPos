import { describe, expect, it } from "vitest";
import { buildProduct } from "@/test/factories";
import {
  addProduct,
  calculateDiscount,
  cartProductCount,
  cartTotals,
  cartUnits,
  clearCart,
  createCart,
  findLine,
  productStockState,
  removeLine,
  setQuantity,
  type CartProductLike,
} from "./cart";

function product(overrides: Partial<CartProductLike> = {}): CartProductLike {
  const base = buildProduct({ price_cents: 1250, stock_qty: 10, min_stock: 5 });
  return {
    id: base.id,
    name: base.name,
    price_cents: base.price_cents,
    stock_qty: base.stock_qty,
    min_stock: base.min_stock,
    active: base.active,
    ...overrides,
  };
}

const options = { allowNegativeStock: false };

function mustAdd(cart: ReturnType<typeof createCart>, prod: CartProductLike, amount = 1) {
  const result = addProduct(cart, prod, options, amount);
  if (!result.ok) throw new Error(result.message);
  return result.cart;
}

describe("Dominio del carrito (E4-01)", () => {
  it("agrega productos y suma cantidad si ya existe", () => {
    const prod = product();
    const cart = mustAdd(createCart(), prod, 2);

    expect(cart.lines).toHaveLength(1);
    expect(findLine(cart, prod.id)?.quantity).toBe(2);

    const second = addProduct(cart, prod, options, 3);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.cart.lines).toHaveLength(1);
      expect(findLine(second.cart, prod.id)?.quantity).toBe(5);
    }
    expect(cartUnits(cart)).toBe(2);
    expect(cartProductCount(cart)).toBe(1);
  });

  it("cambia cantidad, elimina con 0 y vacía el carrito", () => {
    const prod = product();
    let cart = mustAdd(createCart(), prod, 2);

    const changed = setQuantity(cart, prod, 4, options);
    expect(changed.ok).toBe(true);
    if (changed.ok) cart = changed.cart;
    expect(findLine(cart, prod.id)?.quantity).toBe(4);

    const zeroed = setQuantity(cart, prod, 0, options);
    expect(zeroed.ok).toBe(true);
    if (zeroed.ok) cart = zeroed.cart;
    expect(cart.lines).toHaveLength(0);

    cart = removeLine(mustAdd(createCart(), prod), prod.id);
    expect(cart.lines).toHaveLength(0);

    const withItems = mustAdd(createCart(), prod);
    expect(withItems.lines).toHaveLength(1);
    expect(clearCart().lines).toHaveLength(0);
  });

  it("rechaza cantidades inválidas y producto no encontrado", () => {
    const prod = product();
    const cart = mustAdd(createCart(), prod);

    expect(addProduct(cart, prod, options, 0).ok).toBe(false);
    expect(addProduct(cart, prod, options, -1).ok).toBe(false);

    const negative = setQuantity(cart, prod, -2, options);
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.code).toBe("INVALID_QUANTITY");

    const missing = setQuantity(createCart(), prod, 3, options);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("NOT_FOUND");
  });

  it("valida stock: agotado no agregable y no supera disponible (D-002)", () => {
    const out = product({ stock_qty: 0 });
    const outResult = addProduct(createCart(), out, options);
    expect(outResult.ok).toBe(false);
    if (!outResult.ok) expect(outResult.code).toBe("OUT_OF_STOCK");

    const low = product({ stock_qty: 3 });
    const tooMany = addProduct(createCart(), low, options, 4);
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.code).toBe("EXCEEDS_STOCK");

    const inactive = product({ active: false });
    const inactiveResult = addProduct(createCart(), inactive, options);
    expect(inactiveResult.ok).toBe(false);
    if (!inactiveResult.ok) expect(inactiveResult.code).toBe("INACTIVE");

    const negativeAllowed = addProduct(createCart(), out, { allowNegativeStock: true }, 2);
    expect(negativeAllowed.ok).toBe(true);
  });

  it("calcula subtotal, descuento por monto/porcentaje y total", () => {
    const prod = product({ price_cents: 1250 });
    const added = addProduct(createCart(), prod, options, 4);
    if (!added.ok) throw new Error("no agregó");
    const cart = added.cart;

    expect(cartTotals(cart).subtotalCents).toBe(5000);

    const amount = calculateDiscount(5000, { type: "amount", valueCents: 1000 });
    expect(amount).toEqual({ ok: true, discountCents: 1000 });
    expect(cartTotals(cart, 1000).totalCents).toBe(4000);

    const percent = calculateDiscount(5000, { type: "percent", value: 10 });
    expect(percent).toEqual({ ok: true, discountCents: 500 });

    const rounding = calculateDiscount(333, { type: "percent", value: 10 });
    expect(rounding).toEqual({ ok: true, discountCents: 33 });
  });

  it("rechaza descuento mayor al subtotal y porcentajes fuera de rango", () => {
    const tooBig = calculateDiscount(5000, { type: "amount", valueCents: 6000 });
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) expect(tooBig.code).toBe("DISCOUNT_EXCEEDS");

    const negative = calculateDiscount(5000, { type: "amount", valueCents: -100 });
    expect(negative.ok).toBe(false);

    const overPercent = calculateDiscount(5000, { type: "percent", value: 150 });
    expect(overPercent.ok).toBe(false);
    if (!overPercent.ok) expect(overPercent.code).toBe("DISCOUNT_INVALID_PERCENT");

    const clamped = cartTotals(createCart(), 500);
    expect(clamped.discountCents).toBe(0);
    expect(clamped.totalCents).toBe(0);
  });

  it("clasifica estado de stock", () => {
    expect(productStockState({ stock_qty: 0, min_stock: 5 })).toBe("out");
    expect(productStockState({ stock_qty: 3, min_stock: 5 })).toBe("low");
    expect(productStockState({ stock_qty: 10, min_stock: 5 })).toBe("ok");
  });
});
