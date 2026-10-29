"use server";

import {
  createImportProductsCsvAction,
  createPreviewProductsCsvAction,
} from "./products-csv-core";
import type { ProductsCsvInput } from "./products-csv-schema";

const previewProductsCsvInternal = createPreviewProductsCsvAction();
const importProductsCsvInternal = createImportProductsCsvAction();

export async function previewProductsCsvAction(input: ProductsCsvInput) {
  return previewProductsCsvInternal(input);
}

export async function importProductsCsvAction(input: ProductsCsvInput) {
  return importProductsCsvInternal(input);
}
