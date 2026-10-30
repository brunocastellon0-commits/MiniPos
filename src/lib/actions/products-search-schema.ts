import { z } from "zod";

export const searchPosProductsSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(1, { message: "Escribe un nombre o código para buscar." })
      .max(120, { message: "La búsqueda no puede exceder 120 caracteres." }),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export type SearchPosProductsInput = z.infer<typeof searchPosProductsSchema>;
