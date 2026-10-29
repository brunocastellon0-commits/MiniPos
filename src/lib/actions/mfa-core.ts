import { z } from "zod";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RateLimiter } from "./rate-limiter";
import { secureAction } from "./secure-action";

export interface MfaEnrollResult {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

export interface MfaFactor {
  id: string;
  friendlyName?: string;
  factorType: string;
  status: "verified" | "unverified";
}

export interface MfaService {
  enroll: () => Promise<{ data: MfaEnrollResult | null; error: Error | null }>;
  challengeAndVerify: (params: {
    factorId: string;
    code: string;
  }) => Promise<{ error: Error | null }>;
  listFactors: () => Promise<{
    all: MfaFactor[];
    totp: MfaFactor[];
  }>;
  unenroll: (params: { factorId: string }) => Promise<{ error: Error | null }>;
  getAssuranceLevel: () => Promise<{
    currentLevel: "aal1" | "aal2";
    nextLevel: "aal1" | "aal2";
  }>;
}

export const defaultMfaService: MfaService = {
  async enroll() {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "LILA MARKET Dueño",
      });

      if (error || !data) {
        return {
          data: null,
          error: error ?? new Error("Fallo al generar factor TOTP"),
        };
      }

      return {
        data: {
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
          uri: data.totp.uri,
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  },

  async challengeAndVerify({ factorId, code }) {
    try {
      const supabase = await createClient();
      const challengeRes = await supabase.auth.mfa.challenge({ factorId });
      if (challengeRes.error || !challengeRes.data) {
        return {
          error: challengeRes.error ?? new Error("Error al desafiar MFA"),
        };
      }

      const verifyRes = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeRes.data.id,
        code,
      });

      return { error: verifyRes.error };
    } catch (err) {
      return { error: err as Error };
    }
  },

  async listFactors() {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data) {
        return { all: [], totp: [] };
      }
      const mapFactor = (f: {
        id: string;
        factor_type?: string;
        status: string;
        friendly_name?: string;
      }): MfaFactor => ({
        id: f.id,
        friendlyName: f.friendly_name,
        factorType: f.factor_type ?? "totp",
        status: f.status as "verified" | "unverified",
      });

      return {
        all: (data.all || []).map(mapFactor),
        totp: (data.totp || []).map(mapFactor),
      };
    } catch {
      return { all: [], totp: [] };
    }
  },

  async unenroll({ factorId }) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  },

  async getAssuranceLevel() {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      return {
        currentLevel: (data?.currentLevel ?? "aal1") as "aal1" | "aal2",
        nextLevel: (data?.nextLevel ?? "aal1") as "aal1" | "aal2",
      };
    } catch {
      return {
        currentLevel: "aal1",
        nextLevel: "aal1",
      };
    }
  },
};

export const verifyMfaSchema = z
  .object({
    factorId: z.string().min(1, { message: "Identificador de factor requerido" }),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, { message: "El código debe ser de 6 dígitos numéricos" }),
  })
  .strict();

export type VerifyMfaInput = z.infer<typeof verifyMfaSchema>;

export interface MfaActionOptions {
  service?: MfaService;
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  rateLimiter?: RateLimiter;
}

export function createEnrollMfaAction(options?: MfaActionOptions) {
  const service = options?.service ?? defaultMfaService;

  return secureAction<void, MfaEnrollResult>({
    roles: ["owner"],
    currentUserResolver: options?.currentUserResolver,
    handler: async () => {
      const { data, error } = await service.enroll();
      if (error || !data) {
        throw new (class extends Error {
          code = "MFA_ENROLL_FAILED";
          constructor() {
            super("No se pudo iniciar la configuración de MFA.");
          }
        })();
      }
      return data;
    },
  });
}

export function createVerifyMfaEnrollmentAction(options?: MfaActionOptions) {
  const service = options?.service ?? defaultMfaService;

  return secureAction<VerifyMfaInput, { verified: boolean }>({
    roles: ["owner"],
    schema: verifyMfaSchema,
    currentUserResolver: options?.currentUserResolver,
    handler: async (input) => {
      const { error } = await service.challengeAndVerify({
        factorId: input.factorId,
        code: input.code,
      });

      if (error) {
        throw new (class extends Error {
          code = "INVALID_MFA_CODE";
          constructor() {
            super("Código de verificación incorrecto o expirado.");
          }
        })();
      }

      return { verified: true };
    },
  });
}

export function createGetMfaStatusAction(options?: MfaActionOptions) {
  const service = options?.service ?? defaultMfaService;

  return secureAction<void, { enabled: boolean; factorId?: string }>({
    roles: ["owner"],
    currentUserResolver: options?.currentUserResolver,
    handler: async () => {
      const { totp } = await service.listFactors();
      const verifiedFactor = totp.find((f) => f.status === "verified");

      return {
        enabled: Boolean(verifiedFactor),
        factorId: verifiedFactor?.id,
      };
    },
  });
}

export function createUnenrollMfaAction(options?: MfaActionOptions) {
  const service = options?.service ?? defaultMfaService;

  return secureAction<{ factorId: string }, { unenrolled: boolean }>({
    roles: ["owner"],
    schema: z.object({ factorId: z.string().min(1) }).strict(),
    currentUserResolver: options?.currentUserResolver,
    handler: async (input) => {
      const { error } = await service.unenroll({ factorId: input.factorId });
      if (error) {
        throw new (class extends Error {
          code = "MFA_UNENROLL_FAILED";
          constructor() {
            super("No se pudo desactivar el factor MFA.");
          }
        })();
      }
      return { unenrolled: true };
    },
  });
}

export function createVerifyLoginMfaAction(options?: MfaActionOptions) {
  const service = options?.service ?? defaultMfaService;

  return secureAction<VerifyMfaInput, { redirectUrl: string }>({
    isPublic: true,
    schema: verifyMfaSchema,
    rateLimiter: options?.rateLimiter,
    rateLimit: {
      keyPrefix: "mfa-login",
      maxRequests: 5,
      windowMs: 60_000,
      getKey: (input) => `mfa:${input.factorId}`,
    },
    handler: async (input) => {
      const { error } = await service.challengeAndVerify({
        factorId: input.factorId,
        code: input.code,
      });

      if (error) {
        throw new (class extends Error {
          code = "INVALID_MFA_CODE";
          constructor() {
            super("Código de autenticación en dos pasos incorrecto.");
          }
        })();
      }

      return {
        redirectUrl: "/panel",
      };
    },
  });
}
