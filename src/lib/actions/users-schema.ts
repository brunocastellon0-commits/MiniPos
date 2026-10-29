import { z } from "zod";

export const updateUserNameSchema = z
  .object({
    id: z.string().min(1, { message: "ID de usuario requerido." }),
    fullName: z
      .string()
      .trim()
      .min(1, { message: "El nombre no puede estar vacío." })
      .max(100, { message: "El nombre no puede exceder 100 caracteres." }),
  })
  .strict();

export type UpdateUserNameInput = z.infer<typeof updateUserNameSchema>;

export const updateUserRoleSchema = z
  .object({
    id: z.string().min(1, { message: "ID de usuario requerido." }),
    role: z.enum(["owner", "cashier"], {
      message: "Rol inválido. Debe ser 'owner' o 'cashier'.",
    }),
  })
  .strict();

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const toggleUserActiveSchema = z
  .object({
    id: z.string().min(1, { message: "ID de usuario requerido." }),
    active: z.boolean({ message: "Estado de activación requerido." }),
  })
  .strict();

export type ToggleUserActiveInput = z.infer<typeof toggleUserActiveSchema>;
