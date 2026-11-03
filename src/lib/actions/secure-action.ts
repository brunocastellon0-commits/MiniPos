import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { RateLimiter } from "./rate-limiter";

export type UserRole = "owner" | "cashier";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export type ActionSuccess<T> = {
  ok: true;
  data: T;
};

export type ActionError = {
  ok: false;
  code: string;
  message: string;
  errors?: Record<string, string[]>;
};

export type ActionResult<T> = ActionSuccess<T> | ActionError;

export interface ActionContext {
  user: AuthenticatedUser;
}

export interface SecureActionOptions<TInput, TOutput> {
  roles?: UserRole[];
  schema?: z.ZodType<TInput>;
  isPublic?: boolean;
  rateLimit?: {
    keyPrefix: string;
    maxRequests: number;
    windowMs: number;
    getKey?: (input: TInput, user: AuthenticatedUser | null) => string;
  };
  audit?: (
    input: TInput,
    result: ActionResult<TOutput>,
    ctx: { user: AuthenticatedUser | null },
  ) => Promise<void> | void;
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  rateLimiter?: RateLimiter;
  handler: (input: TInput, ctx: { user: AuthenticatedUser }) => Promise<TOutput>;
}

const limitersMap = new Map<string, RateLimiter>();

function getOrCreateLimiter(keyPrefix: string, maxRequests: number, windowMs: number): RateLimiter {
  const mapKey = `${keyPrefix}:${maxRequests}:${windowMs}`;
  let limiter = limitersMap.get(mapKey);
  if (!limiter) {
    limiter = new RateLimiter(maxRequests, windowMs);
    limitersMap.set(mapKey, limiter);
  }
  return limiter;
}

export async function defaultGetCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return {
        id: user.id,
        email: user.email,
        name: (user.user_metadata?.full_name as string) ?? "Usuario",
        role: "cashier",
        isActive: false,
      };
    }

    return {
      id: profile.id,
      email: user.email,
      name: profile.full_name,
      role: profile.role as UserRole,
      isActive: profile.active,
    };
  } catch {
    return null;
  }
}

export class ActionException extends Error {
  code: string;
  constructor(message: string, code = "BAD_REQUEST") {
    super(message);
    this.name = "ActionException";
    this.code = code;
  }
}

interface KnownActionError extends Error {
  code: string;
}

function isKnownActionError(error: unknown): error is KnownActionError {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as Record<string, unknown>).code === "string"
  );
}

export function secureAction<TInput, TOutput>(options: SecureActionOptions<TInput, TOutput>) {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    // 1. Autenticar
    const userResolver = options.currentUserResolver ?? defaultGetCurrentUser;
    const user = await userResolver();

    if (!options.isPublic) {
      if (!user) {
        return {
          ok: false,
          code: "UNAUTHENTICATED",
          message: "Debes iniciar sesión para realizar esta acción.",
        };
      }

      // 2. Autorizar (rol y estado activo)
      if (!user.isActive) {
        return {
          ok: false,
          code: "USER_INACTIVE",
          message: "Tu usuario se encuentra inactivo. Contacta al administrador.",
        };
      }

      if (options.roles && options.roles.length > 0 && !options.roles.includes(user.role)) {
        return {
          ok: false,
          code: "FORBIDDEN",
          message: "No tienes permisos para realizar esta acción.",
        };
      }
    }

    // 3. Rate limiting
    if (options.rateLimit) {
      const limiter =
        options.rateLimiter ??
        getOrCreateLimiter(
          options.rateLimit.keyPrefix,
          options.rateLimit.maxRequests,
          options.rateLimit.windowMs,
        );

      const rateKey = options.rateLimit.getKey
        ? options.rateLimit.getKey(input, user)
        : `${options.rateLimit.keyPrefix}:${user?.id ?? "anonymous"}`;

      const { allowed } = limiter.check(rateKey);
      if (!allowed) {
        return {
          ok: false,
          code: "RATE_LIMITED",
          message: "Demasiadas solicitudes. Por favor espera unos momentos antes de reintentar.",
        };
      }
    }

    // 4. Validar con Zod .strict()
    let validatedInput = input;
    if (options.schema) {
      let schemaToUse = options.schema;
      const maybeStrict = schemaToUse as unknown as {
        strict?: () => z.ZodType<TInput>;
      };
      if (typeof maybeStrict.strict === "function") {
        schemaToUse = maybeStrict.strict();
      }

      const parseResult = schemaToUse.safeParse(input);
      if (!parseResult.success) {
        const fieldErrors: Record<string, string[]> = {};
        for (const [key, msgs] of Object.entries(parseResult.error.flatten().fieldErrors)) {
          if (msgs && Array.isArray(msgs)) {
            fieldErrors[key] = msgs;
          }
        }

        return {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Los datos proporcionados no son válidos.",
          errors: fieldErrors,
        };
      }
      validatedInput = parseResult.data;
    }

    // 5. Ejecutar handler
    let result: ActionResult<TOutput>;
    try {
      const data = await options.handler(validatedInput, {
        user: user as AuthenticatedUser,
      });
      result = { ok: true, data };
   } catch (error) {
  console.error("[SECURE ACTION ERROR]", {
    error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  if (isKnownActionError(error)) {
    result = {
      ok: false,
      code: error.code,
      message: error.message,
    };
  } else {
    result = {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Ocurrió un error inesperado al procesar la solicitud.",
    };
  }
}

    // 6. Auditar
    if (options.audit) {
      try {
        await options.audit(validatedInput, result, { user });
      } catch {
        // Fallo de auditoría no bloquea respuesta pero no debe silenciarse totalmente
      }
    }

    return result;
  };
}
