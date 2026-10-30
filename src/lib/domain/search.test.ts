import { describe, expect, it } from "vitest";
import { buildProduct } from "@/test/factories";
import { normalizeSearchText, scoreProductMatch, searchProducts } from "./search";

describe("búsqueda de productos (E2-04)", () => {
  it("normaliza mayúsculas, acentos y espacios", () => {
    expect(normalizeSearchText("  Café   MOLIDO  ")).toBe("cafe molido");
    expect(normalizeSearchText("Lácteos")).toBe("lacteos");
  });

  it("prioriza código exacto, luego nombre y luego coincidencias parciales", () => {
    const products = [
      buildProduct({ id: "1", name: "Cafetera eléctrica" }),
      buildProduct({ id: "2", name: "Café molido", barcode: "123" }),
      buildProduct({ id: "3", name: "Leche en polvo" }),
      buildProduct({ id: "4", name: "Café", internal_code: "CAF-1" }),
    ];

    expect(scoreProductMatch(products[1]!, "123")).toBe(100);
    expect(scoreProductMatch(products[3]!, "CAF-1")).toBe(95);
    expect(scoreProductMatch(products[3]!, "cafe")).toBe(90);
    expect(scoreProductMatch(products[0]!, "cafe")).toBe(80);

    expect(searchProducts(products, "cafe").map((product) => product.id)).toEqual([
      "4",
      "2",
      "1",
    ]);
  });

  it("busca por palabra parcial sin acentos y respeta el límite", () => {
    const products = [
      buildProduct({ id: "1", name: "Yogurt natural" }),
      buildProduct({ id: "2", name: "Galletas de avena" }),
      buildProduct({ id: "3", name: "Avena integral" }),
    ];

    expect(searchProducts(products, "avena", 1).map((product) => product.id)).toEqual(["3"]);
    expect(searchProducts(products, "AVENA").map((product) => product.id)).toEqual(["3", "2"]);
    expect(searchProducts(products, "   ")).toEqual([]);
  });

  it("mantiene resultados correctos con 5.000 productos", () => {
    const products = Array.from({ length: 5000 }, (_, index) =>
      buildProduct({ id: `prod-${index}`, name: `Producto genérico ${index}` }),
    );
    products.push(buildProduct({ id: "objetivo", name: "Café de los Yungas", barcode: "CAFE-777" }));

    const results = searchProducts(products, "cafe yungas", 20);

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("objetivo");
  });
});
