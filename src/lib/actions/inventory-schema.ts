import { z } from "zod";

export const listStockMovementsSchema = z
  .object({
    productId: z.string().min(1, { message: "Producto requerido." }).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .strict();

export type ListStockMovementsInput = z.infer<typeof listStockMovementsSchema>;
