import { z } from "zod";

const notes = z
  .string()
  .trim()
  .max(500, { message: "Las notas no pueden exceder 500 caracteres." })
  .optional();

const cents = z
  .number()
  .int({ message: "El monto debe ser un entero en centavos." })
  .min(0, { message: "El monto no puede ser negativo." })
  .max(999_999_999, { message: "El monto es demasiado alto." });

const sessionId = z.string().min(1, { message: "ID de turno requerido." });

export const openCashSessionSchema = z
  .object({
    openingCents: cents,
    notes,
  })
  .strict();

export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;

export const addCashMovementSchema = z
  .object({
    sessionId,
    kind: z.enum(["in", "out"], { message: "Tipo de movimiento inválido." }),
    amountCents: cents.refine((value) => value > 0, {
      message: "El monto debe ser mayor a cero.",
    }),
    reason: z
      .string()
      .trim()
      .min(1, { message: "El motivo es obligatorio." })
      .max(200, { message: "El motivo no puede exceder 200 caracteres." }),
  })
  .strict();

export type AddCashMovementInput = z.infer<typeof addCashMovementSchema>;

export const closeCashSessionSchema = z
  .object({
    sessionId,
    countedCents: cents,
    notes,
  })
  .strict();

export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;

export const listCashSessionsSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export type ListCashSessionsInput = z.infer<typeof listCashSessionsSchema>;
