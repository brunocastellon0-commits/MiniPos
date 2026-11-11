import { z } from "zod";
import { USERNAME_PATTERN } from "@/lib/auth/login-identity";

export const loginSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, { message: "Ingresa tu usuario." })
      .regex(USERNAME_PATTERN, {
        message:
          "Usuario no válido: de 3 a 20 caracteres (letras minúsculas, números, punto, guion o guion bajo).",
      }),
    password: z.string().min(1, { message: "Ingresa tu contraseña." }),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export interface LoginResult {
  redirectUrl: string;
}
