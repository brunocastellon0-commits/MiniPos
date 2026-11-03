import { describe, expect, it } from "vitest";
import { countLowStock, isLowStock } from "./inventory";

describe("alertas de stock bajo (E6-04)", () => {
  it("marca bajo cuando el stock es menor o igual al mínimo", () => {
    expect(isLowStock({ stock_qty: 3, min_stock: 5 })).toBe(true);
    expect(isLowStock({ stock_qty: 5, min_stock: 5 })).toBe(true);
    expect(isLowStock({ stock_qty: 6, min_stock: 5 })).toBe(false);
    expect(isLowStock({ stock_qty: 0, min_stock: 0 })).toBe(true);
  });

  it("cuenta los productos que requieren reposición", () => {
    const products = [
      { stock_qty: 0, min_stock: 5 },
      { stock_qty: 3, min_stock: 5 },
      { stock_qty: 10, min_stock: 5 },
      { stock_qty: 1, min_stock: 1 },
    ];
    expect(countLowStock(products)).toBe(3);
    expect(countLowStock([])).toBe(0);
  });
});
