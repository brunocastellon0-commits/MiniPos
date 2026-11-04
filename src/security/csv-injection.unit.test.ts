import { describe, expect, it } from "vitest";
import { productsCsvSchema } from "@/lib/actions/products-csv-schema";
import {
  PRODUCTS_CSV_MAX_BYTES,
  PRODUCTS_CSV_MAX_ROWS,
  escapeCsvField,
  parseProductsCsv,
} from "@/lib/domain/products-csv";
import { salesDailyReportCsv, type DailyReportRow } from "@/lib/domain/reports";

const HOSTILE_FORMULAS = ["=1+1", "+123", "-2+3", "@SUM(A1)", "\tx", "\rx", "=cmd|'/C calc'!A0"];

describe("Neutralización de fórmulas CSV en la exportación (E11-09)", () => {
  it("prefija comilla simple a todo valor que comienza con carácter de fórmula", () => {
    for (const formula of HOSTILE_FORMULAS) {
      const escaped = escapeCsvField(formula);
      const unquoted =
        escaped.startsWith('"') && escaped.endsWith('"') ? escaped.slice(1, -1) : escaped;
      expect(unquoted.startsWith("'"), `debe neutralizar ${JSON.stringify(formula)}`).toBe(true);
    }
  });

  it("no altera textos ni montos normales", () => {
    expect(escapeCsvField("Coca-Cola 2L")).toBe("Coca-Cola 2L");
    expect(escapeCsvField("Arroz 1kg")).toBe("Arroz 1kg");
    expect(escapeCsvField("12.50")).toBe("12.50");
    expect(escapeCsvField("2026-11-03")).toBe("2026-11-03");
    expect(escapeCsvField("Oferta +10%")).toBe("Oferta +10%");
  });

  it("entre comillas el valor neutralizado sigue protegido (fórmula + coma)", () => {
    const escaped = escapeCsvField("=a,b");
    expect(escaped).toBe(`"'=a,b"`);
    expect(escaped).toContain("'=");
  });

  it("escapa comillas dobles duplicándolas dentro del campo entrecomillado", () => {
    expect(escapeCsvField('Texto, con "comillas"')).toBe('"Texto, con ""comillas"""');
  });

  it("el CSV de reporte de ventas neutraliza cada celda de cada fila", () => {
    const row: DailyReportRow = {
      dayKey: "=2+2",
      transactionCount: 3,
      grossCents: 1800,
      discountCents: 0,
      collectedCents: 1800,
      voidedCount: 1,
      voidedCents: 500,
    };
    const csv = salesDailyReportCsv([row]);
    const lines = csv.trim().split("\r\n");

    expect(lines[0]).toBe(
      "fecha,transacciones,bruto_bs,descuento_bs,cobrado_bs,anuladas,monto_anulado_bs",
    );
    expect(lines[1]).toBe("'=2+2,3,18.00,0.00,18.00,1,5.00");
    for (const line of lines.slice(1)) {
      expect(line.startsWith("'"), `la fila debe empezar neutralizada: ${line}`).toBe(true);
    }
  });
});

describe("Límites y validación de la importación CSV (E11-09)", () => {
  const header = "nombre,precio";

  it("rechaza archivos con más filas que el máximo permitido", () => {
    const rows = Array.from(
      { length: PRODUCTS_CSV_MAX_ROWS + 1 },
      (_, index) => `Producto ${index},10.00`,
    );
    const parsed = parseProductsCsv([header, ...rows].join("\n"), { categories: [] });

    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors[0]?.message).toContain(String(PRODUCTS_CSV_MAX_ROWS));
  });

  it("acepta archivos dentro del máximo de filas", () => {
    const rows = Array.from(
      { length: PRODUCTS_CSV_MAX_ROWS },
      (_, index) => `Producto ${index},10.00`,
    );
    const parsed = parseProductsCsv([header, ...rows].join("\n"), { categories: [] });

    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(PRODUCTS_CSV_MAX_ROWS);
  });

  it("el esquema del servidor limita el tamaño en bytes del CSV", () => {
    const tooBig = "a".repeat(PRODUCTS_CSV_MAX_BYTES + 1);
    const result = productsCsvSchema.safeParse({ csv: tooBig });
    expect(result.success).toBe(false);

    const empty = productsCsvSchema.safeParse({ csv: "" });
    expect(empty.success).toBe(false);
  });

  it("exige las cabeceras mínimas (nombre y precio)", () => {
    const parsed = parseProductsCsv("codigo,descripcion\n1,Texto", { categories: [] });
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors[0]?.message).toMatch(/nombre|precio/i);
  });

  it("una fila con valor de fórmula no rompe el análisis (se almacena como texto)", () => {
    const parsed = parseProductsCsv([header, "=cmd,10.00"].join("\n"), { categories: [] });
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows[0]?.name).toBe("=cmd");
  });
});
