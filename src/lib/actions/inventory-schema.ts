import { z } from "zod";

export const listStockMovementsSchema = z
  .object({
    productId: z.string().min(1, { message: "Producto requerido." }).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .strict();

export type ListStockMovementsInput = z.infer<typeof listStockMovementsSchema>;

export const adjustStockSchema = z
  .object({
    productId: z.string().min(1, { message: "Producto requerido." }),
    delta: z
      .number()
      .int({ message: "El delta debe ser un entero." })
      .min(-1_000_000, { message: "El delta es demasiado grande." })
      .max(1_000_000, { message: "El delta es demasiado grande." })
      .refine((value) => value !== 0, { message: "El delta debe ser distinto de cero." }),
    kind: z.enum(["adjustment", "waste"], {
      message: "Tipo de movimiento inválido (adjustment o waste).",
    }),
    reason: z
      .string()
      .trim()
      .min(1, { message: "El motivo es obligatorio." })
      .max(300, { message: "El motivo no puede superar 300 caracteres." }),
  })
  .strict();

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
