import { z } from "zod";

export const heldCartLineSchema = z
  .object({
    productId: z.string().min(1, { message: "Producto requerido." }),
    name: z
      .string()
      .trim()
      .min(1, { message: "Nombre de producto requerido." })
      .max(200, { message: "Nombre demasiado largo." }),
    unitPriceCents: z
      .number()
      .int({ message: "Precio inválido." })
      .min(0, { message: "El precio no puede ser negativo." }),
    quantity: z
      .number()
      .int({ message: "Cantidad inválida." })
      .min(1, { message: "La cantidad debe ser al menos 1." })
      .max(9999, { message: "Cantidad demasiado alta." }),
  })
  .strict();

export const heldCartSchema = z
  .object({
    lines: z
      .array(heldCartLineSchema)
      .min(1, { message: "La venta debe tener al menos un producto." })
      .max(200, { message: "Máximo 200 productos por venta." }),
  })
  .strict();

export type HeldCart = z.infer<typeof heldCartSchema>;

export const saveHeldSaleSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, { message: "La etiqueta es obligatoria." })
      .max(80, { message: "La etiqueta no puede superar 80 caracteres." }),
    cart: heldCartSchema,
  })
  .strict();

export type SaveHeldSaleInput = z.infer<typeof saveHeldSaleSchema>;

export const deleteHeldSaleSchema = z
  .object({
    id: z.string().min(1, { message: "ID de venta pausada requerido." }),
  })
  .strict();

export type DeleteHeldSaleInput = z.infer<typeof deleteHeldSaleSchema>;
