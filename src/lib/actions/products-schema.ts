import { z } from "zod";

const name = z
  .string()
  .trim()
  .min(1, { message: "El nombre del producto es obligatorio." })
  .max(120, { message: "El nombre no puede exceder 120 caracteres." });

const amountCents = z
  .number()
  .int({ message: "El monto debe expresarse en centavos enteros." })
  .min(0, { message: "El monto no puede ser negativo." })
  .max(9_999_999_999, { message: "El monto es demasiado alto." });

const optionalCode = z
  .string()
  .trim()
  .max(64, { message: "El código no puede exceder 64 caracteres." })
  .nullable()
  .optional();

const unitLabel = z
  .string()
  .trim()
  .min(1, { message: "La unidad es obligatoria." })
  .max(20, { message: "La unidad no puede exceder 20 caracteres." });

const stockQty = z
  .number()
  .int({ message: "El stock debe ser un entero." })
  .min(0, { message: "El stock no puede ser negativo." })
  .max(1_000_000, { message: "El stock es demasiado alto." });

export const createProductSchema = z
  .object({
    name,
    barcode: optionalCode,
    internalCode: optionalCode,
    categoryId: z.string().min(1).nullable().optional(),
    unitLabel: unitLabel.optional(),
    priceCents: amountCents,
    costCents: amountCents.nullable().optional(),
    stockQty: stockQty.optional(),
    minStock: stockQty.optional(),
    active: z.boolean().optional(),
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    id: z.string().min(1, { message: "ID de producto requerido." }),
    name: name.optional(),
    barcode: optionalCode,
    internalCode: optionalCode,
    categoryId: z.string().min(1).nullable().optional(),
    unitLabel: unitLabel.optional(),
    priceCents: amountCents.optional(),
    costCents: amountCents.nullable().optional(),
    minStock: stockQty.optional(),
    active: z.boolean().optional(),
  })
  .strict();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const setProductActiveSchema = z
  .object({
    id: z.string().min(1, { message: "ID de producto requerido." }),
    active: z.boolean({ message: "Estado de activación requerido." }),
  })
  .strict();

export type SetProductActiveInput = z.infer<typeof setProductActiveSchema>;

export const listProductsSchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    categoryId: z.string().min(1).optional(),
    status: z.enum(["all", "active", "inactive", "low"]).optional(),
    page: z.number().int().min(1).max(100_000).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export type ListProductsInput = z.infer<typeof listProductsSchema>;

export const productNamesSchema = z
  .object({
    ids: z
      .array(z.string().min(1, { message: "ID de producto requerido." }))
      .min(1, { message: "Debe indicar al menos un producto." })
      .max(200, { message: "No se pueden consultar más de 200 productos." }),
  })
  .strict();

export type ProductNamesInput = z.infer<typeof productNamesSchema>;
