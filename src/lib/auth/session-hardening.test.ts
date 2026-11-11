import { describe, expect, it, vi } from "vitest";
import { type AuthService, createLoginAction } from "@/lib/actions/auth-core";
import { RateLimiter } from "@/lib/actions/rate-limiter";
import { InactivityTracker } from "./inactivity";
import { requireUser, type SessionClientProvider } from "./session";

// Mock de next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

describe("Endurecimiento de Sesión y Login (E1-05)", () => {
  describe("1. Rastreo y Cierre por Inactividad", () => {
    it("emite aviso antes de expirar y ejecuta onTimeout tras superar el tiempo límite", () => {
      const onWarning = vi.fn();
      const onTimeout = vi.fn();

      const tracker = new InactivityTracker({
        timeoutMs: 15 * 60 * 1000, // 15 min
        warningMs: 60 * 1000, // 1 min antes
        onWarning,
        onTimeout,
      });

      const startTime = tracker.getLastActivity();

      // Transcurren 13 minutos (no debe haber aviso ni timeout)
      tracker.tick(startTime + 13 * 60 * 1000);
      expect(onWarning).not.toHaveBeenCalled();
      expect(onTimeout).not.toHaveBeenCalled();

      // Transcurren 14 minutos y 1 segundo (entra en ventana de aviso)
      tracker.tick(startTime + 14 * 60 * 1000 + 1000);
      expect(onWarning).toHaveBeenCalledTimes(1);
      expect(onTimeout).not.toHaveBeenCalled();

      // Transcurren 15 minutos exactos (expira por inactividad)
      tracker.tick(startTime + 15 * 60 * 1000);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it("resetea el contador de inactividad cuando se registra interacción del usuario", () => {
      const onTimeout = vi.fn();

      const tracker = new InactivityTracker({
        timeoutMs: 60 * 1000, // 1 min
        onTimeout,
      });

      const startTime = tracker.getLastActivity();

      // Transcurren 50 segundos
      tracker.tick(startTime + 50 * 1000);
      expect(onTimeout).not.toHaveBeenCalled();

      // El usuario interactúa
      tracker.recordActivity();
      const newActivityTime = tracker.getLastActivity();
      expect(newActivityTime).toBeGreaterThanOrEqual(startTime);

      // Transcurren otros 50 segundos desde la nueva interacción (total 100s desde el inicio)
      tracker.tick(newActivityTime + 50 * 1000);
      expect(onTimeout).not.toHaveBeenCalled();

      // Solo expira cuando pasa el minuto completo sin actividad
      tracker.tick(newActivityTime + 60 * 1000);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe("2. Límite de Intentos y Rate Limiting", () => {
    it("bloquea con RATE_LIMITED cuando se superan los intentos máximos permitidos", async () => {
      const limiter = new RateLimiter(3, 60_000); // 3 intentos máx
      const mockAuthService: AuthService = {
        signInWithPassword: vi.fn().mockResolvedValue({
          user: null,
          error: new Error("Invalid login credentials"),
        }),
        getUserProfile: vi.fn().mockResolvedValue(null),
        signOut: vi.fn().mockResolvedValue(undefined),
      };

      const action = createLoginAction({
        authService: mockAuthService,
        rateLimiter: limiter,
      });

      const credentials = {
        username: "cajero",
        password: "wrong",
      };

      // 3 intentos fallidos permitidos
      const r1 = await action(credentials);
      expect(r1.ok).toBe(false);
      if (!r1.ok) {
        expect(r1.code).toBe("INVALID_CREDENTIALS");
      }

      const r2 = await action(credentials);
      expect(r2.ok).toBe(false);
      if (!r2.ok) {
        expect(r2.code).toBe("INVALID_CREDENTIALS");
      }

      const r3 = await action(credentials);
      expect(r3.ok).toBe(false);
      if (!r3.ok) {
        expect(r3.code).toBe("INVALID_CREDENTIALS");
      }

      // Intento 4 es bloqueado por rate limit
      const r4 = await action(credentials);
      expect(r4.ok).toBe(false);
      if (!r4.ok) {
        expect(r4.code).toBe("RATE_LIMITED");
        expect(r4.message).toContain("Demasiadas solicitudes");
      }
    });
  });

  describe("3. Revocación Inmediata de Usuario Desactivado", () => {
    it("cierra la sesión y rechaza el login si el usuario fue desactivado", async () => {
      const signOutMock = vi.fn().mockResolvedValue(undefined);
      const mockAuthService: AuthService = {
        signInWithPassword: vi.fn().mockResolvedValue({
          user: { id: "usr-disabled", email: "desactivado@lilamarket.bo" },
          error: null,
        }),
        getUserProfile: vi.fn().mockResolvedValue({
          role: "cashier",
          active: false, // Desactivado
        }),
        signOut: signOutMock,
      };

      const action = createLoginAction({ authService: mockAuthService });
      const result = await action({
        username: "desactivado",
        password: "validPassword123",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("USER_INACTIVE");
      }
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });

    it("requireUser expulsa inmediatamente a un usuario autenticado si su perfil está inactivo", async () => {
      const provider: SessionClientProvider = {
        getUser: vi.fn().mockResolvedValue({
          id: "usr-revoked",
          email: "revocado@lilamarket.bo",
        }),
        getProfile: vi.fn().mockResolvedValue({
          id: "usr-revoked",
          full_name: "Usuario Revocado",
          role: "cashier",
          active: false,
        }),
      };

      await expect(requireUser("/login", provider)).rejects.toThrow("NEXT_REDIRECT:/login");
    });
  });

  describe("4. Registro de Auditoría en Autenticación", () => {
    it("registra auth.login_success en la bitácora tras un inicio de sesión válido", async () => {
      const auditMock = vi.fn().mockResolvedValue(undefined);
      const mockAuthService: AuthService = {
        signInWithPassword: vi.fn().mockResolvedValue({
          user: { id: "usr-ok", email: "propietario@lilamarket.bo" },
          error: null,
        }),
        getUserProfile: vi.fn().mockResolvedValue({
          role: "owner",
          active: true,
        }),
        signOut: vi.fn().mockResolvedValue(undefined),
      };

      const action = createLoginAction({
        authService: mockAuthService,
        auditLogger: auditMock,
      });

      const result = await action({
        username: "propietario",
        password: "Password123!",
      });

      expect(result.ok).toBe(true);
      expect(auditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "auth.login_success",
          entity: "auth",
          entityId: "usr-ok",
          summary: expect.objectContaining({
            email: "propietario@lilamarket.bo",
            role: "owner",
          }),
        }),
      );
    });
  });
});
