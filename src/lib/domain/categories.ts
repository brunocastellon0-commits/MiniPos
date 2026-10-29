import type { Category } from "@/lib/repos/types";

export interface CategoryDeletionCheck {
  allowed: boolean;
  reason?: string;
}

export function canDeleteCategory(productCount: number): CategoryDeletionCheck {
  if (!Number.isInteger(productCount) || productCount < 0) {
    throw new RangeError("El número de productos debe ser un entero no negativo.");
  }

  if (productCount > 0) {
    const label = productCount === 1 ? "1 producto asignado" : `${productCount} productos asignados`;
    return {
      allowed: false,
      reason: `No se puede eliminar la categoría: tiene ${label}. Desactívala o reasigna sus productos.`,
    };
  }

  return { allowed: true };
}

export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function nextCategorySortOrder(categories: Pick<Category, "sort_order">[]): number {
  if (categories.length === 0) return 0;
  return Math.max(...categories.map((category) => category.sort_order)) + 1;
}

export function hasDuplicateCategoryName(
  categories: Pick<Category, "id" | "name">[],
  name: string,
  excludeId?: string,
): boolean {
  const normalized = normalizeCategoryName(name).toLocaleLowerCase("es");
  return categories.some(
    (category) =>
      category.id !== excludeId &&
      normalizeCategoryName(category.name).toLocaleLowerCase("es") === normalized,
  );
}

export function sortCategories<T extends Pick<Category, "sort_order" | "name">>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "es"),
  );
}

export function moveCategory<T extends Pick<Category, "id" | "sort_order" | "name">>(
  items: T[],
  id: string,
  direction: "up" | "down",
): T[] {
  const sorted = sortCategories(items);
  const index = sorted.findIndex((category) => category.id === id);
  if (index < 0) return sorted;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= sorted.length) return sorted;

  const reordered = [...sorted];
  const [moved] = reordered.splice(index, 1);
  if (!moved) return sorted;
  reordered.splice(targetIndex, 0, moved);

  return reordered.map((category, position) => ({ ...category, sort_order: position }));
}
