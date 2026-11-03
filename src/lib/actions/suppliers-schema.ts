import { z } from "zod";

const name = z
  .string()
  .trim()
  .min(2, { message: "El nombre del proveedor es obligatorio (mínimo 2 caracteres)." })
  .max(120, { message: "El nombre no puede exceder 120 caracteres." });

const phone = z
  .string()
  .trim()
  .max(40, { message: "El teléfono no puede exceder 40 caracteres." })
  .nullable()
  .optional();

const notes = z
  .string()
  .trim()
  .max(300, { message: "Las notas no pueden exceder 300 caracteres." })
  .nullable()
  .optional();

export const listSuppliersSchema = z
  .object({
    activeOnly: z.boolean().optional(),
  })
  .strict();

export type ListSuppliersInput = z.infer<typeof listSuppliersSchema>;

export const createSupplierSchema = z
  .object({
    name,
    phone,
    notes,
    active: z.boolean().optional(),
  })
  .strict();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = z
  .object({
    id: z.string().min(1, { message: "ID de proveedor requerido." }),
    name: name.optional(),
    phone,
    notes,
    active: z.boolean().optional(),
  })
  .strict();

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const deleteSupplierSchema = z
  .object({
    id: z.string().min(1, { message: "ID de proveedor requerido." }),
  })
  .strict();

export type DeleteSupplierInput = z.infer<typeof deleteSupplierSchema>;
