import { createClient } from "@/lib/supabase/server";
import { toLoginEmail } from "@/lib/auth/login-identity";
import { type LoginInput, type LoginResult, loginSchema } from "./auth-schema";
import { RateLimiter } from "./rate-limiter";
import { secureAction } from "./secure-action";

export * from "./auth-schema";

export interface AuthService {
  signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
    user: { id: string; email?: string } | null;
    error: Error | null;
  }>;
  getUserProfile: (userId: string) => Promise<{
    role: "owner" | "cashier";
    active: boolean;
  } | null>;
  signOut: () => Promise<void>;
}

export const defaultAuthService: AuthService = {
  async signInWithPassword({ email, password }) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      return { user: null, error: error ?? new Error("Invalid credentials") };
    }
    return {
      user: { id: data.user.id, email: data.user.email },
      error: null,
    };
  },

  async getUserProfile(userId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      role: data.role as "owner" | "cashier",
      active: data.active,
    };
  },

  async signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
  },
};

export function createLoginAction(options?: {
  authService?: AuthService;
  rateLimiter?: RateLimiter;
  auditLogger?: (entry: {
    action: string;
    entity: string;
    entityId?: string | null;
    summary?: Record<string, unknown>;
  }) => Promise<void>;
}) {
  const service = options?.authService ?? defaultAuthService;

  return secureAction<LoginInput, LoginResult>({
    isPublic: true,
    schema: loginSchema,
    rateLimiter: options?.rateLimiter,
    rateLimit: {
      keyPrefix: "login",
      maxRequests: 5,
      windowMs: 60_000,
      getKey: (input) => `login:${input.username}`,
    },
    handler: async (input) => {
      const { user, error } = await service.signInWithPassword({
        email: toLoginEmail(input.username),
        password: input.password,
      });

      // Seguridad: sin enumerar usuarios (mensaje idéntico ante fallo)
      if (error || !user) {
        throw new (class extends Error {
          code = "INVALID_CREDENTIALS";
          constructor() {
            super("Usuario o contraseña incorrectos.");
          }
        })();
      }

      // Validar si el usuario está activo (revocación inmediata)
      const profile = await service.getUserProfile(user.id);
      if (profile && !profile.active) {
        await service.signOut();
        throw new (class extends Error {
          code = "USER_INACTIVE";
          constructor() {
            super("Tu usuario se encuentra inactivo. Contacta al administrador.");
          }
        })();
      }

      // Auditoría: inicio de sesión exitoso
      if (options?.auditLogger) {
        try {
          await options.auditLogger({
            action: "auth.login_success",
            entity: "auth",
            entityId: user.id,
            summary: { email: user.email, role: profile?.role },
          });
        } catch {
          // Fallo de auditoría no bloquea login
        }
      }

      return {
        redirectUrl: "/caja",
      };
    },
  });
}
