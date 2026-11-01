import { z } from "zod";

export const confirmSaleSchema = z
  .object({
    sessionId: z.string().min(1, { message: "ID de turno requerido." }),
    paymentMethod: z.enum(["cash", "qr", "card"], { message: "Método de pago inválido." }),
    clientRequestId: z
      .string()
      .trim()
      .min(1, { message: "Identificador de venta requerido." })
      .max(100, { message: "Identificador demasiado largo." }),
    items: z
      .array(
        z
          .object({
            productId: z.string().min(1, { message: "Producto requerido." }),
            quantity: z
              .number()
              .int({ message: "Cantidad inválida." })
              .min(1, { message: "La cantidad debe ser al menos 1." })
              .max(9999, { message: "Cantidad demasiado alta." }),
          })
          .strict(),
      )
      .min(1, { message: "La venta debe tener al menos un producto." })
      .max(200, { message: "Máximo 200 productos por venta." }),
    discountCents: z
      .number()
      .int({ message: "Descuento inválido." })
      .min(0, { message: "El descuento no puede ser negativo." })
      .optional(),
    cashReceivedCents: z
      .number()
      .int({ message: "Monto recibido inválido." })
      .min(0, { message: "El monto recibido no puede ser negativo." })
      .optional(),
  })
  .strict();

export type ConfirmSaleInput = z.infer<typeof confirmSaleSchema>;
