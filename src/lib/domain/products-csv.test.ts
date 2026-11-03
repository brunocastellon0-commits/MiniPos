import { describe, expect, it } from "vitest";
import {
  PRODUCTS_CSV_HEADERS,
  buildProductsCsvTemplate,
  escapeCsvField,
  parseDelimitedRecords,
  parseProductsCsv,
  toProductInsert,
} from "./products-csv";
import { buildCategory } from "@/test/factories";

const categories = [
  buildCategory({ id: "cat-1", name: "Bebidas" }),
  buildCategory({ id: "cat-2", name: "Abarrotes" }),
];

const header = PRODUCTS_CSV_HEADERS.join(",");

describe("products-csv", () => {
  it("parsea un CSV válido, resuelve categorías y convierte montos", () => {
    const csv = [
      header,
      "Coca-Cola 2L,7771234567890,,Bebidas,unidad,12.50,8.00,24,6",
      '"Arroz, grano largo",,A-001,abarrotes,kg,8.50,,40,10',
    ].join("\r\n");

    const result = parseProductsCsv(csv, { categories });

    expect(result.errors).toEqual([]);
    expect(result.totalRows).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      name: "Coca-Cola 2L",
      barcode: "7771234567890",
      categoryId: "cat-1",
      priceCents: 1250,
      costCents: 800,
      stockQty: 24,
      minStock: 6,
    });
    expect(result.rows[1]).toMatchObject({
      name: "Arroz, grano largo",
      categoryId: "cat-2",
      unitLabel: "kg",
      costCents: null,
    });
  });

  it("usa defaultMinStock cuando la fila no trae stock_minimo (E10-02)", () => {
    const csv = [header, "Fideos,770,,Abarrotes,unidad,6.00,,10,"].join("\n");

    const withDefault = parseProductsCsv(csv, { categories, defaultMinStock: 3 });
    expect(withDefault.rows[0]?.minStock).toBe(3);

    const fallback = parseProductsCsv(csv, { categories });
    expect(fallback.rows[0]?.minStock).toBe(5);
  });

  it("acepta punto y coma como separador", () => {
    const csv = [header.replace(/,/g, ";"), "Café;123;;Bebidas;unidad;9,00;;5;2"].join("\n");
    const result = parseProductsCsv(csv, { categories });

    expect(result.errors).toEqual([]);
    expect(result.rows[0]?.priceCents).toBe(900);
  });

  it("reporta errores por fila sin descartar las filas válidas", () => {
    const csv = [
      header,
      "Producto válido,,,Bebidas,unidad,5.00,,1,1",
      ",123,,Bebidas,unidad,5.00,,1,1",
      "Sin precio,,,Bebidas,unidad,,,1,1",
      "Categoría mala,,,Congelados,unidad,5.00,,1,1",
    ].join("\n");

    const result = parseProductsCsv(csv, { categories });

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(3);
    expect(result.errors.map((error) => error.line)).toEqual([3, 4, 5]);
    expect(result.errors[0]?.message).toContain("nombre es obligatorio");
    expect(result.errors[1]?.message).toContain("precio es obligatorio");
    expect(result.errors[2]?.message).toContain('categoría "Congelados" no existe');
  });

  it("detecta barcodes duplicados dentro del archivo y contra el catálogo", () => {
    const csv = [
      header,
      "A,111,,Bebidas,unidad,1.00,,0,5",
      "B,111,,Bebidas,unidad,1.00,,0,5",
      "C,222,,Bebidas,unidad,1.00,,0,5",
    ].join("\n");

    const result = parseProductsCsv(csv, {
      categories,
      existingBarcodes: ["222"],
    });

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]?.message).toContain("repetido en el archivo");
    expect(result.errors[1]?.message).toContain("ya existe en el catálogo");
  });

  it("rechaza archivos vacíos, sin columnas obligatorias o con demasiadas filas", () => {
    expect(parseProductsCsv("", { categories }).errors[0]?.message).toBe("El archivo está vacío.");

    const missing = parseProductsCsv("nombre,stock\nA,1", { categories });
    expect(missing.errors[0]?.message).toContain("Faltan columnas obligatorias");

    const rows = Array.from({ length: 3 }, (_, index) => `P${index},, ,Bebidas,unidad,1.00,,0,5`);
    const limited = parseProductsCsv([header, ...rows].join("\n"), { categories, maxRows: 2 });
    expect(limited.errors[0]?.message).toContain("máximo es 2");
  });

  it("soporta comillas escapadas y saltos de línea dentro de un campo", () => {
    const records = parseDelimitedRecords('a,"b""c"\n"d\ne",f', ",");
    expect(records).toEqual([
      ["a", 'b"c'],
      ["d\ne", "f"],
    ]);
  });

  it("convierte filas al insert del repositorio", () => {
    const result = parseProductsCsv(
      [header, "Yogurt,,,Bebidas,unidad,7.50,5.00,10,3"].join("\n"),
      { categories },
    );
    const insert = toProductInsert(result.rows[0]!);

    expect(insert).toMatchObject({
      name: "Yogurt",
      category_id: "cat-1",
      price_cents: 750,
      cost_cents: 500,
      stock_qty: 10,
      min_stock: 3,
      active: true,
    });
  });

  it("neutraliza fórmulas al exportar CSV", () => {
    expect(escapeCsvField("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvField("+123")).toBe("'+123");
    expect(escapeCsvField('Texto, con "comillas"')).toBe('"Texto, con ""comillas"""');
  });

  it("genera una plantilla descargable con encabezados", () => {
    const template = buildProductsCsvTemplate();
    expect(template.split("\r\n")[0]).toBe(header);
  });
});
