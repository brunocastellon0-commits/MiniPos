import type { Product } from "@/lib/repos/types";

export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function scoreProductMatch(
  product: Pick<Product, "name" | "barcode" | "internal_code">,
  query: string,
): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  const barcode = product.barcode ? normalizeSearchText(product.barcode) : "";
  const internalCode = product.internal_code ? normalizeSearchText(product.internal_code) : "";
  const name = normalizeSearchText(product.name);

  if (barcode === normalizedQuery) return 100;
  if (internalCode === normalizedQuery) return 95;
  if (name === normalizedQuery) return 90;
  if (name.startsWith(normalizedQuery)) return 80;
  if (name.split(" ").some((word) => word.startsWith(normalizedQuery))) return 60;
  if (name.includes(normalizedQuery)) return 40;
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => name.includes(token))) return 30;
  if (barcode.includes(normalizedQuery) || internalCode.includes(normalizedQuery)) return 20;
  return 0;
}

export function searchProducts<T extends Pick<Product, "name" | "barcode" | "internal_code">>(
  products: T[],
  query: string,
  limit = 20,
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  return products
    .map((product) => ({ product, score: scoreProductMatch(product, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        normalizeSearchText(a.product.name).localeCompare(normalizeSearchText(b.product.name), "es"),
    )
    .slice(0, limit)
    .map((entry) => entry.product);
}
