import { z } from "zod";

const purchaseStatus = z.enum(["draft", "ordered", "partial", "received", "cancelled"]);

const purchaseItem = z
  .object({
    productId: z.string().min(1, { message: "Producto requerido." }),
    quantity: z
      .number()
      .int({ message: "La cantidad debe ser un entero." })
      .min(1, { message: "La cantidad debe ser mayor a 0." })
      .max(1_000_000, { message: "La cantidad es demasiado alta." }),
    unitCostCents: z
      .number()
      .int({ message: "El costo debe expresarse en centavos enteros." })
      .min(0, { message: "El costo no puede ser negativo." })
      .max(9_999_999_999, { message: "El costo es demasiado alto." }),
  })
  .strict();

function ensureUniqueProducts(
  items: { productId: string }[],
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.productId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "productId"],
        message: "El producto está repetido en la compra.",
      });
    }
    seen.add(item.productId);
  });
}

export const createPurchaseSchema = z
  .object({
    supplierId: z.string().min(1, { message: "Proveedor requerido." }),
    notes: z
      .string()
      .trim()
      .max(300, { message: "Las notas no pueden exceder 300 caracteres." })
      .nullable()
      .optional(),
    items: z
      .array(purchaseItem)
      .min(1, { message: "Debe agregar al menos un producto." })
      .max(200, { message: "La compra no puede superar 200 productos." }),
  })
  .strict()
  .superRefine((value, ctx) => {
    ensureUniqueProducts(value.items, ctx);
  });

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export const listPurchasesSchema = z
  .object({
    status: purchaseStatus.optional(),
    supplierId: z.string().min(1).optional(),
  })
  .strict();

export type ListPurchasesInput = z.infer<typeof listPurchasesSchema>;

export const getPurchaseSchema = z
  .object({
    id: z.string().min(1, { message: "ID de compra requerido." }),
  })
  .strict();

export type GetPurchaseInput = z.infer<typeof getPurchaseSchema>;

export const receivePurchaseSchema = z
  .object({
    purchaseId: z.string().min(1, { message: "ID de compra requerido." }),
    items: z
      .array(
        z
          .object({
            productId: z.string().min(1, { message: "Producto requerido." }),
            qtyReceived: z
              .number()
              .int({ message: "La cantidad recibida debe ser un entero." })
              .min(0, { message: "La cantidad recibida no puede ser negativa." })
              .max(1_000_000, { message: "La cantidad recibida es demasiado alta." }),
          })
          .strict(),
      )
      .min(1, { message: "Debe indicar las cantidades recibidas." })
      .max(200, { message: "La recepción no puede superar 200 productos." }),
    updateCost: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    ensureUniqueProducts(value.items, ctx);
  });

export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;
