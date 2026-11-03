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

export const getSaleTicketSchema = z
  .object({
    saleId: z.string().min(1, { message: "ID de venta requerido." }),
  })
  .strict();

export type GetSaleTicketInput = z.infer<typeof getSaleTicketSchema>;

const isoDayPattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDay(value: string): boolean {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = value
    .split("-")
    .map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const listSalesSchema = z
  .object({
    dateFrom: z
      .string()
      .refine((value) => isoDayPattern.test(value) && isValidIsoDay(value), {
        message: "Fecha inválida.",
      })
      .optional(),
    dateTo: z
      .string()
      .refine((value) => isoDayPattern.test(value) && isValidIsoDay(value), {
        message: "Fecha inválida.",
      })
      .optional(),
    paymentMethod: z
      .enum(["cash", "qr", "card"], { message: "Método de pago inválido." })
      .optional(),
    status: z.enum(["paid", "voided"], { message: "Estado inválido." }).optional(),
    cashierId: z.string().min(1, { message: "Cajero requerido." }).optional(),
    limit: z.number().int().min(1).max(1000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "La fecha final debe ser igual o posterior a la inicial.",
      });
    }
  });

export type ListSalesInput = z.infer<typeof listSalesSchema>;

export const getSaleDetailSchema = z
  .object({
    saleId: z.string().min(1, { message: "ID de venta requerido." }),
  })
  .strict();

export type GetSaleDetailInput = z.infer<typeof getSaleDetailSchema>;

export const voidSaleSchema = z
  .object({
    saleId: z.string().min(1, { message: "ID de venta requerido." }),
    reason: z
      .string()
      .trim()
      .min(1, { message: "El motivo de anulación es obligatorio." })
      .max(300, { message: "El motivo no puede superar 300 caracteres." }),
  })
  .strict();

export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
