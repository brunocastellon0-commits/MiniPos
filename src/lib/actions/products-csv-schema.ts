import { z } from "zod";
import { PRODUCTS_CSV_MAX_BYTES } from "@/lib/domain/products-csv";

export const productsCsvSchema = z
  .object({
    csv: z
      .string()
      .min(1, { message: "El archivo está vacío." })
      .max(PRODUCTS_CSV_MAX_BYTES, {
        message: `El archivo supera el máximo de ${PRODUCTS_CSV_MAX_BYTES / 1_000_000} MB.`,
      }),
  })
  .strict();

export type ProductsCsvInput = z.infer<typeof productsCsvSchema>;
