import { describe, expect, it } from "vitest";
import {
  canDeleteCategory,
  hasDuplicateCategoryName,
  moveCategory,
  nextCategorySortOrder,
  normalizeCategoryName,
  sortCategories,
} from "./categories";
import { buildCategory } from "@/test/factories";

describe("dominio de categorías", () => {
  it("permite eliminar una categoría sin productos", () => {
    expect(canDeleteCategory(0)).toEqual({ allowed: true });
  });

  it("bloquea eliminar una categoría con productos asignados", () => {
    const check = canDeleteCategory(3);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("3 productos asignados");
  });

  it("rechaza conteos inválidos", () => {
    expect(() => canDeleteCategory(-1)).toThrow(RangeError);
    expect(() => canDeleteCategory(1.5)).toThrow(RangeError);
  });

  it("normaliza espacios del nombre", () => {
    expect(normalizeCategoryName("  Bebidas   frías  ")).toBe("Bebidas frías");
  });

  it("detecta nombres duplicados sin distinguir mayúsculas", () => {
    const categories = [buildCategory({ id: "cat-1", name: "Bebidas" })];
    expect(hasDuplicateCategoryName(categories, "bebidas")).toBe(true);
    expect(hasDuplicateCategoryName(categories, " Bebidas ", "cat-1")).toBe(false);
    expect(hasDuplicateCategoryName(categories, "Lácteos")).toBe(false);
  });

  it("calcula el siguiente orden disponible", () => {
    expect(nextCategorySortOrder([])).toBe(0);
    expect(
      nextCategorySortOrder([
        buildCategory({ sort_order: 2 }),
        buildCategory({ sort_order: 7 }),
      ]),
    ).toBe(8);
  });

  it("ordena y mueve categorías normalizando el orden", () => {
    const categories = [
      buildCategory({ id: "a", name: "Abarrotes", sort_order: 5 }),
      buildCategory({ id: "b", name: "Bebidas", sort_order: 1 }),
      buildCategory({ id: "c", name: "Lácteos", sort_order: 3 }),
    ];

    expect(sortCategories(categories).map((category) => category.id)).toEqual(["b", "c", "a"]);

    const movedDown = moveCategory(categories, "b", "down");
    expect(movedDown.map((category) => category.id)).toEqual(["c", "b", "a"]);
    expect(movedDown.map((category) => category.sort_order)).toEqual([0, 1, 2]);

    const movedUp = moveCategory(categories, "c", "up");
    expect(movedUp.map((category) => category.id)).toEqual(["c", "b", "a"]);
  });

  it("no mueve fuera de los límites", () => {
    const categories = [
      buildCategory({ id: "a", name: "A", sort_order: 0 }),
      buildCategory({ id: "b", name: "B", sort_order: 1 }),
    ];

    expect(moveCategory(categories, "a", "up").map((category) => category.id)).toEqual(["a", "b"]);
    expect(moveCategory(categories, "b", "down").map((category) => category.id)).toEqual([
      "a",
      "b",
    ]);
    expect(moveCategory(categories, "missing", "down").map((category) => category.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
