import { describe, expect, it, vi } from "vitest";
import {
  createEnrollMfaAction,
  createGetMfaStatusAction,
  createUnenrollMfaAction,
  createVerifyLoginMfaAction,
  createVerifyMfaEnrollmentAction,
  type MfaService,
} from "@/lib/actions/mfa-core";
import { RateLimiter } from "@/lib/actions/rate-limiter";
import type { AuthenticatedUser } from "./session";

describe("MFA (TOTP) para el Dueño (E1-06)", () => {
  const ownerUser: AuthenticatedUser = {
    id: "usr-owner",
    email: "dueno@lilamarket.bo",
    name: "Doña Elena",
    role: "owner",
    isActive: true,
  };

  const cashierUser: AuthenticatedUser = {
    id: "usr-cashier",
    email: "cajero@lilamarket.bo",
    name: "Carlos",
    role: "cashier",
    isActive: true,
  };

  const createMockMfaService = (overrides?: Partial<MfaService>): MfaService => ({
    enroll: vi.fn().mockResolvedValue({
      data: {
        factorId: "factor-123",
        qrCode: "data:image/svg+xml;base64,mockqr",
        secret: "JBSWY3DPEHPK3PXP",
        uri: "otpauth://totp/LilaMarket:dueno?secret=JBSWY3DPEHPK3PXP",
      },
      error: null,
    }),
    challengeAndVerify: vi.fn().mockResolvedValue({ error: null }),
    listFactors: vi.fn().mockResolvedValue({
      all: [{ id: "factor-123", factorType: "totp", status: "verified" }],
      totp: [{ id: "factor-123", factorType: "totp", status: "verified" }],
    }),
    unenroll: vi.fn().mockResolvedValue({ error: null }),
    getAssuranceLevel: vi.fn().mockResolvedValue({
      currentLevel: "aal1",
      nextLevel: "aal2",
    }),
    ...overrides,
  });

  describe("1. Inscripción (Enrollment)", () => {
    it("permite al dueño iniciar la inscripción de TOTP y devuelve QR y secret", async () => {
      const service = createMockMfaService();
      const enrollAction = createEnrollMfaAction({
        service,
        currentUserResolver: async () => ownerUser,
      });

      const result = await enrollAction();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.factorId).toBe("factor-123");
        expect(result.data.secret).toBe("JBSWY3DPEHPK3PXP");
        expect(result.data.qrCode).toContain("data:image");
      }
    });

    it("rechaza la inscripción si el usuario es cajero (FORBIDDEN)", async () => {
      const service = createMockMfaService();
      const enrollAction = createEnrollMfaAction({
        service,
        currentUserResolver: async () => cashierUser,
      });

      const result = await enrollAction();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("FORBIDDEN");
      }
    });

    it("falla con MFA_ENROLL_FAILED si el servicio de Supabase Auth falla", async () => {
      const service = createMockMfaService({
        enroll: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("Auth service unavailable"),
        }),
      });

      const enrollAction = createEnrollMfaAction({
        service,
        currentUserResolver: async () => ownerUser,
      });

      const result = await enrollAction();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("MFA_ENROLL_FAILED");
      }
    });
  });

  describe("2. Verificación de Inscripción", () => {
    it("valida el código de 6 dígitos numéricos y activa el factor", async () => {
      const service = createMockMfaService();
      const verifyAction = createVerifyMfaEnrollmentAction({
        service,
        currentUserResolver: async () => ownerUser,
      });

      const result = await verifyAction({
        factorId: "factor-123",
        code: "123456",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.verified).toBe(true);
      }
      expect(service.challengeAndVerify).toHaveBeenCalledWith({
        factorId: "factor-123",
        code: "123456",
      });
    });

    it("rechaza códigos que no tengan 6 dígitos o contengan letras", async () => {
      const service = createMockMfaService();
      const verifyAction = createVerifyMfaEnrollmentAction({
        service,
        currentUserResolver: async () => ownerUser,
      });

      const rShort = await verifyAction({
        factorId: "factor-123",
        code: "1234",
      });
      expect(rShort.ok).toBe(false);
      if (!rShort.ok) {
        expect(rShort.code).toBe("VALIDATION_ERROR");
      }

      const rLetters = await verifyAction({
        factorId: "factor-123",
        code: "abcdef",
      });
      expect(rLetters.ok).toBe(false);
      if (!rLetters.ok) {
        expect(rLetters.code).toBe("VALIDATION_ERROR");
      }
    });

    it("devuelve INVALID_MFA_CODE si el código es incorrecto", async () => {
      const service = createMockMfaService({
        challengeAndVerify: vi.fn().mockResolvedValue({ error: new Error("Invalid TOTP code") }),
      });

      const verifyAction = createVerifyMfaEnrollmentAction({
        service,
        currentUserResolver: async () => ownerUser,
      });

      const result = await verifyAction({
        factorId: "factor-123",
        code: "999999",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_MFA_CODE");
        expect(result.message).toContain("incorrecto o expirado");
      }
    });
  });

  describe("3. Estado y Desinscripción", () => {
    it("informa si el dueño tiene MFA activado y su factorId", async () => {
      const service = createMockMfaService();
      const getStatusAction = createGetMfaStatusAction({
        service,
        currentUserResolver: async () => ownerUser,
      });

      const result = await getStatusAction();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.factorId).toBe("factor-123");
      }
    });

    it("permite desinscribir un factor TOTP existente", async () => {
      const service = createMockMfaService();
      const unenrollAction = createUnenrollMfaAction({
        service,
        currentUserResolver: async () => ownerUser,
      });

      const result = await unenrollAction({ factorId: "factor-123" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.unenrolled).toBe(true);
      }
      expect(service.unenroll).toHaveBeenCalledWith({ factorId: "factor-123" });
    });
  });

  describe("4. Verificación durante el Login con Rate Limiting", () => {
    it("autentica el segundo factor durante el login y redirige a /panel", async () => {
      const service = createMockMfaService();
      const verifyLoginAction = createVerifyLoginMfaAction({ service });

      const result = await verifyLoginAction({
        factorId: "factor-123",
        code: "654321",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.redirectUrl).toBe("/panel");
      }
    });

    it("bloquea con RATE_LIMITED tras exceder el límite de intentos en login 2FA", async () => {
      const limiter = new RateLimiter(2, 60_000);
      const service = createMockMfaService({
        challengeAndVerify: vi.fn().mockResolvedValue({ error: new Error("Code invalid") }),
      });

      const verifyLoginAction = createVerifyLoginMfaAction({
        service,
        rateLimiter: limiter,
      });

      const payload = { factorId: "factor-rate-test", code: "111111" };

      // Intentos 1 y 2
      await verifyLoginAction(payload);
      await verifyLoginAction(payload);

      // Intento 3 bloqueado
      const r3 = await verifyLoginAction(payload);
      expect(r3.ok).toBe(false);
      if (!r3.ok) {
        expect(r3.code).toBe("RATE_LIMITED");
        expect(r3.message).toContain("Demasiadas solicitudes");
      }
    });
  });
});
