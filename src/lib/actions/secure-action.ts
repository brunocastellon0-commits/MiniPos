import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
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

// Fuente única de autenticación: delega en getCurrentUser (memoizado por request).
export async function defaultGetCurrentUser(): Promise<AuthenticatedUser | null> {
  return getCurrentUser();
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

// Códigos de error controlados por actions que no usan ActionException (auth/mfa).
// Solo estos mensajes se devuelven al cliente además de ActionException; cualquier
// otro Error (p. ej. un error de Postgres con `code`) queda como INTERNAL_ERROR
// y jamás se filtra su mensaje.
const KNOWN_ACTION_CODES: ReadonlySet<string> = new Set([
  "INVALID_CREDENTIALS",
  "USER_INACTIVE",
  "MFA_ENROLL_FAILED",
  "MFA_UNENROLL_FAILED",
  "INVALID_MFA_CODE",
]);

function isKnownActionError(error: unknown): error is KnownActionError {
  if (!(error instanceof Error)) return false;
  if (!("code" in error) || typeof error.code !== "string") return false;
  if (error instanceof ActionException) return true;
  return KNOWN_ACTION_CODES.has(error.code);
}

export function secureAction<TInput, TOutput>(options: SecureActionOptions<TInput, TOutput>) {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    // 1. Autenticar (las acciones públicas no resuelven usuario: login/MFA no
    // dependen de ctx.user y se ahorran las llamadas a Supabase Auth)
    const userResolver = options.currentUserResolver ?? defaultGetCurrentUser;
    const user = options.isPublic ? null : await userResolver();

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
