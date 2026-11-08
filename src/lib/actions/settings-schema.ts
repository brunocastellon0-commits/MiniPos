import { z } from "zod";

const legalNameSchema = z
  .string()
  .trim()
  .max(120, { message: "La razón social no puede superar 120 caracteres." })
  .nullable()
  .transform((value) => (value === "" ? null : value));

export const updateBusinessSettingsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { message: "El nombre debe tener al menos 2 caracteres." })
      .max(80, { message: "El nombre no puede superar 80 caracteres." }),
    legal_name: legalNameSchema,
    currency_code: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, { message: "El código de moneda debe ser de 3 letras (ej. BOB)." })
      .transform((value) => value.toUpperCase()),
    currency_symbol: z
      .string()
      .trim()
      .min(1, { message: "El símbolo de moneda es obligatorio." })
      .max(5, { message: "El símbolo de moneda no puede superar 5 caracteres." }),
    allow_negative_stock: z.boolean(),
    cashier_can_discount: z.boolean(),
    cashier_max_discount_cents: z
      .number()
      .int({ message: "El máximo de descuento del cajero debe ser un número entero." })
      .min(0, { message: "El máximo de descuento del cajero no puede ser negativo." })
      .max(10_000_000, { message: "El máximo de descuento del cajero es demasiado alto." }),
    low_stock_default: z
      .number()
      .int({ message: "El umbral de stock bajo debe ser un nǧmero entero." })
      .min(0, { message: "El umbral de stock bajo no puede ser negativo." })
      .max(9999, { message: "El umbral de stock bajo es demasiado alto." }),
    operating_mode: z.enum(["micromarket", "restaurant"], {
      message: "La modalidad debe ser micromarket o restaurante.",
    }),
    enable_held_sales: z.boolean(),
    order_charge_timing: z.enum(["on_order", "on_consumption"], {
      message: "El momento de cobro debe ser al crear o al finalizar el consumo.",
    }),
  })
  .strict();

export type UpdateBusinessSettingsInput = z.infer<typeof updateBusinessSettingsSchema>;
