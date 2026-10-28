import { z } from "zod";

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, { message: "Ingresa tu correo electrónico." })
      .email({ message: "Ingresa un correo electrónico válido." }),
    password: z.string().min(1, { message: "Ingresa tu contraseña." }),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export interface LoginResult {
  redirectUrl: string;
}
