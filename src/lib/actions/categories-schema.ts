import { z } from "zod";

const categoryName = z
  .string()
  .trim()
  .min(1, { message: "El nombre de la categoría es obligatorio." })
  .max(60, { message: "El nombre no puede exceder 60 caracteres." });

const sortOrder = z
  .number()
  .int({ message: "El orden debe ser un número entero." })
  .min(0, { message: "El orden no puede ser negativo." })
  .max(9999, { message: "El orden es demasiado alto." });

export const createCategorySchema = z
  .object({
    name: categoryName,
    sortOrder: sortOrder.optional(),
    active: z.boolean().optional(),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    id: z.string().min(1, { message: "ID de categoría requerido." }),
    name: categoryName.optional(),
    sortOrder: sortOrder.optional(),
    active: z.boolean().optional(),
  })
  .strict();

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const deleteCategorySchema = z
  .object({
    id: z.string().min(1, { message: "ID de categoría requerido." }),
  })
  .strict();

export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;

export const reorderCategoriesSchema = z
  .object({
    ids: z
      .array(z.string().min(1, { message: "Identificador de categoría inválido." }))
      .min(1, { message: "Debes indicar al menos una categoría." })
      .max(200, { message: "No se pueden reordenar más de 200 categorías a la vez." }),
  })
  .strict();

export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
