import type { Category, ProductInsert } from "@/lib/repos/types";
import { toCents } from "@/lib/money";
import { normalizeSearchText } from "./search";

export const PRODUCTS_CSV_MAX_ROWS = 1000;
export const PRODUCTS_CSV_MAX_BYTES = 1_000_000;

export const PRODUCTS_CSV_HEADERS = [
  "nombre",
  "codigo_barras",
  "codigo_interno",
  "categoria",
  "unidad",
  "precio",
  "costo",
  "stock",
  "stock_minimo",
] as const;

export interface ProductsCsvRow {
  line: number;
  name: string;
  barcode: string | null;
  internalCode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unitLabel: string;
  priceCents: number;
  costCents: number | null;
  stockQty: number;
  minStock: number;
}

export interface ProductsCsvError {
  line: number;
  message: string;
}

export interface ParsedProductsCsv {
  rows: ProductsCsvRow[];
  errors: ProductsCsvError[];
  totalRows: number;
}

export interface ParseProductsCsvOptions {
  categories: Pick<Category, "id" | "name">[];
  existingBarcodes?: Iterable<string>;
  maxRows?: number;
}

function normalizeHeader(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "_");
}

function detectDelimiter(line: string): "," | ";" {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;

  for (const character of line) {
    if (character === '"') inQuotes = !inQuotes;
    else if (!inQuotes && character === ",") commas += 1;
    else if (!inQuotes && character === ";") semicolons += 1;
  }

  return semicolons > commas ? ";" : ",";
}

export function parseDelimitedRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === delimiter) {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (character === "\r") {
      if (text[index + 1] === "\n") index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records.filter((row) => row.some((value) => value.trim() !== ""));
}

function parseOptionalMoney(value: string, label: string, errors: string[]): number | null {
  if (value.trim() === "") return null;
  try {
    const cents = toCents(value);
    if (cents < 0) {
      errors.push(`${label} no puede ser negativo.`);
      return null;
    }
    return cents;
  } catch {
    errors.push(`${label} no es un monto válido.`);
    return null;
  }
}

function parseInteger(
  value: string,
  label: string,
  fallback: number,
  errors: string[],
): number {
  if (value.trim() === "") return fallback;
  if (!/^\d+$/.test(value.trim())) {
    errors.push(`${label} debe ser un número entero mayor o igual a cero.`);
    return fallback;
  }
  return Number(value.trim());
}

export function parseProductsCsv(
  text: string,
  options: ParseProductsCsvOptions,
): ParsedProductsCsv {
  const maxRows = options.maxRows ?? PRODUCTS_CSV_MAX_ROWS;
  const cleaned = text.replace(/^\uFEFF/, "");

  if (cleaned.trim() === "") {
    return {
      rows: [],
      errors: [{ line: 0, message: "El archivo está vacío." }],
      totalRows: 0,
    };
  }

  const firstLine = cleaned.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const records = parseDelimitedRecords(cleaned, delimiter);
  const header = records[0]?.map(normalizeHeader) ?? [];

  const requiredHeaders = ["nombre", "precio"];
  const missing = requiredHeaders.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message: `Faltan columnas obligatorias: ${missing.join(", ")}.`,
        },
      ],
      totalRows: Math.max(0, records.length - 1),
    };
  }

  const indexOf = (name: string) => header.indexOf(name);
  const dataRecords = records.slice(1);
  if (dataRecords.length > maxRows) {
    return {
      rows: [],
      errors: [
        {
          line: 0,
          message: `El archivo tiene ${dataRecords.length} filas y el máximo es ${maxRows}. Divide la importación en varios archivos.`,
        },
      ],
      totalRows: dataRecords.length,
    };
  }

  const categoriesByName = new Map(
    options.categories.map((category) => [normalizeSearchText(category.name), category]),
  );
  const existingBarcodes = new Set(options.existingBarcodes ?? []);
  const seenBarcodes = new Set<string>();
  const rows: ProductsCsvRow[] = [];
  const errors: ProductsCsvError[] = [];

  dataRecords.forEach((record, index) => {
    const line = index + 2;
    const cell = (name: string): string => {
      const column = indexOf(name);
      return column >= 0 ? (record[column] ?? "").trim() : "";
    };
    const rowErrors: string[] = [];

    const name = cell("nombre");
    if (name === "") rowErrors.push("El nombre es obligatorio.");
    if (name.length > 120) rowErrors.push("El nombre no puede exceder 120 caracteres.");

    const barcode = cell("codigo_barras") || null;
    if (barcode) {
      if (existingBarcodes.has(barcode)) {
        rowErrors.push(`El código de barras ${barcode} ya existe en el catálogo.`);
      } else if (seenBarcodes.has(barcode)) {
        rowErrors.push(`El código de barras ${barcode} está repetido en el archivo.`);
      } else {
        seenBarcodes.add(barcode);
      }
    }

    const internalCode = cell("codigo_interno") || null;
    const unitLabel = cell("unidad") || "unidad";
    if (unitLabel.length > 20) rowErrors.push("La unidad no puede exceder 20 caracteres.");

    const priceCents = parseOptionalMoney(cell("precio"), "El precio", rowErrors);
    if (priceCents === null) rowErrors.push("El precio es obligatorio.");
    const costCents = parseOptionalMoney(cell("costo"), "El costo", rowErrors);

    const stockQty = parseInteger(cell("stock"), "El stock", 0, rowErrors);
    const minStock = parseInteger(cell("stock_minimo"), "El stock mínimo", 5, rowErrors);

    const categoryName = cell("categoria");
    let categoryId: string | null = null;
    if (categoryName) {
      const category = categoriesByName.get(normalizeSearchText(categoryName));
      if (!category) {
        rowErrors.push(`La categoría "${categoryName}" no existe.`);
      } else {
        categoryId = category.id;
      }
    }

    if (rowErrors.length > 0 || priceCents === null) {
      errors.push({ line, message: rowErrors.join(" ") });
      return;
    }

    rows.push({
      line,
      name,
      barcode,
      internalCode,
      categoryId,
      categoryName: categoryName || null,
      unitLabel,
      priceCents,
      costCents,
      stockQty,
      minStock,
    });
  });

  return { rows, errors, totalRows: dataRecords.length };
}

export function toProductInsert(row: ProductsCsvRow): ProductInsert {
  return {
    name: row.name,
    barcode: row.barcode,
    internal_code: row.internalCode,
    category_id: row.categoryId,
    unit_label: row.unitLabel,
    price_cents: row.priceCents,
    cost_cents: row.costCents,
    stock_qty: row.stockQty,
    min_stock: row.minStock,
    active: true,
  };
}

export function buildProductsCsvTemplate(): string {
  return [
    PRODUCTS_CSV_HEADERS.join(","),
    "Coca-Cola 2L,7771234567890,,Bebidas,unidad,12.50,8.00,24,6",
    "Arroz 1kg,,A-001,Abarrotes,unidad,8.50,6.20,40,10",
  ].join("\r\n");
}

export function escapeCsvField(value: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\r\n;]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}
