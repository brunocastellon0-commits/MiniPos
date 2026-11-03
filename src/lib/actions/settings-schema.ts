import { z } from "zod";

const logoUrlSchema = z
  .string()
  .trim()
  .max(300, { message: "La URL del logo no puede superar 300 caracteres." })
  .nullable()
  .refine(
    (value) =>
      value === null ||
      value === "" ||
      value.startsWith("https://") ||
      value.startsWith("http://") ||
      value.startsWith("/"),
    { message: "La URL del logo debe ser https://, http:// o una ruta /ruta/." },
  )
  .transform((value) => (value === "" ? null : value));

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
    logo_url: logoUrlSchema,
    allow_negative_stock: z.boolean(),
    cashier_can_discount: z.boolean(),
    low_stock_default: z
      .number()
      .int({ message: "El umbral de stock bajo debe ser un número entero." })
      .min(0, { message: "El umbral de stock bajo no puede ser negativo." })
      .max(9999, { message: "El umbral de stock bajo es demasiado alto." }),
  })
  .strict();

export type UpdateBusinessSettingsInput = z.infer<typeof updateBusinessSettingsSchema>;
