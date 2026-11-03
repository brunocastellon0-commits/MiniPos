export interface StockThresholds {
  stock_qty: number;
  min_stock: number;
}

export function isLowStock(product: StockThresholds): boolean {
  return product.stock_qty <= product.min_stock;
}

export function countLowStock(products: StockThresholds[]): number {
  return products.filter(isLowStock).length;
}
