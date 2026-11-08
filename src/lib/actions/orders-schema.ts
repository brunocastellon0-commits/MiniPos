import { z } from "zod";

const orderStatus = z.enum(
  ["pendiente", "en_preparacion", "listo", "entregado", "cancelado"],
  { message: "Estado de pedido inválido." },
);

const paymentMethod = z.enum(["cash", "qr", "card"], {
  message: "Método de pago inválido.",
});

const orderIdSchema = z.string().min(1, { message: "ID de pedido requerido." });

export const createOrderSchema = z
  .object({
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
      .min(1, { message: "El pedido debe tener al menos un producto." })
      .max(200, { message: "Máximo 200 productos por pedido." }),
    notes: z
      .string()
      .trim()
      .max(500, { message: "Las notas no pueden superar 500 caracteres." })
      .nullable()
      .optional(),
    paymentMethod: paymentMethod.optional(),
    cashReceivedCents: z
      .number()
      .int({ message: "Monto recibido inválido." })
      .min(0, { message: "El monto recibido no puede ser negativo." })
      .optional(),
    clientRequestId: z
      .string()
      .trim()
      .min(1, { message: "Identificador de pedido requerido." })
      .max(100, { message: "Identificador demasiado largo." })
      .optional(),
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const listOrdersSchema = z
  .object({
    status: orderStatus.optional(),
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict();

export type ListOrdersInput = z.infer<typeof listOrdersSchema>;

export const getOrderSchema = z
  .object({
    orderId: orderIdSchema,
  })
  .strict();

export type GetOrderInput = z.infer<typeof getOrderSchema>;

export const updateOrderStatusSchema = z
  .object({
    orderId: orderIdSchema,
    status: orderStatus,
    reason: z
      .string()
      .trim()
      .max(300, { message: "El motivo no puede superar 300 caracteres." })
      .optional(),
  })
  .strict();

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const chargeOrderSchema = z
  .object({
    orderId: orderIdSchema,
    paymentMethod,
    cashReceivedCents: z
      .number()
      .int({ message: "Monto recibido inválido." })
      .min(0, { message: "El monto recibido no puede ser negativo." })
      .optional(),
    clientRequestId: z
      .string()
      .trim()
      .min(1, { message: "Identificador de cobro requerido." })
      .max(100, { message: "Identificador demasiado largo." }),
  })
  .strict();

export type ChargeOrderInput = z.infer<typeof chargeOrderSchema>;
