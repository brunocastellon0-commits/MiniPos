import { describe, expect, it, vi } from "vitest";
import { type AuthService, createLoginAction } from "./auth-core";
import { RateLimiter } from "./rate-limiter";

describe("loginAction (Acción segura de inicio de sesión)", () => {
  const createMockAuthService = (overrides?: Partial<AuthService>): AuthService => ({
    signInWithPassword: vi.fn().mockResolvedValue({
      user: { id: "user-1", email: "dueno@lila.market" },
      error: null,
    }),
    getUserProfile: vi.fn().mockResolvedValue({
      role: "owner",
      active: true,
    }),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it("inicia sesión correctamente para un usuario activo y devuelve la URL de redirección", async () => {
    const authService = createMockAuthService();
    const action = createLoginAction({ authService });

    const result = await action({
      username: "dueno",
      password: "Password123!",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectUrl).toBe("/caja");
    }
    // E1-07: el usuario escribe solo su usuario; el servidor arma el correo sintético
    expect(authService.signInWithPassword).toHaveBeenCalledWith({
      email: "dueno@lila.market",
      password: "Password123!",
    });
  });

  it("normaliza el usuario a minúsculas antes de autenticar", async () => {
    const authService = createMockAuthService();
    const action = createLoginAction({ authService });

    const result = await action({
      username: "  DUENO.Numeros  ",
      password: "Password123!",
    });

    expect(result.ok).toBe(true);
    expect(authService.signInWithPassword).toHaveBeenCalledWith({
      email: "dueno.numeros@lila.market",
      password: "Password123!",
    });
  });

  it("falla con mensaje genérico y sin enumerar usuarios si las credenciales son incorrectas", async () => {
    const authService = createMockAuthService({
      signInWithPassword: vi.fn().mockResolvedValue({
        user: null,
        error: new Error("Invalid login credentials"),
      }),
    });
    const action = createLoginAction({ authService });

    const result = await action({
      username: "desconocido",
      password: "wrong-password",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_CREDENTIALS");
      expect(result.message).toBe("Usuario o contraseña incorrectos.");
      // Comprobar que no revela si el usuario existía o no
      expect(result.message).not.toContain("no existe");
      expect(result.message).not.toContain("contraseña incorrecta");
    }
  });

  it("rechaza el ingreso y cierra la sesión si el perfil está desactivado", async () => {
    const signOutMock = vi.fn().mockResolvedValue(undefined);
    const authService = createMockAuthService({
      getUserProfile: vi.fn().mockResolvedValue({
        role: "cashier",
        active: false,
      }),
      signOut: signOutMock,
    });
    const action = createLoginAction({ authService });

    const result = await action({
      username: "inactivo",
      password: "Password123!",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("USER_INACTIVE");
      expect(result.message).toContain("Tu usuario se encuentra inactivo");
    }
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it("bloquea con RATE_LIMITED tras exceder el límite de intentos", async () => {
    const limiter = new RateLimiter(2, 60_000);
    const authService = createMockAuthService();
    const action = createLoginAction({ authService, rateLimiter: limiter });

    const payload = {
      username: "cajero",
      password: "Password123!",
    };

    // Intentos 1 y 2 permitidos
    const r1 = await action(payload);
    expect(r1.ok).toBe(true);

    const r2 = await action(payload);
    expect(r2.ok).toBe(true);

    // Intento 3 bloqueado por rate limit
    const r3 = await action(payload);
    expect(r3.ok).toBe(false);
    if (!r3.ok) {
      expect(r3.code).toBe("RATE_LIMITED");
      expect(r3.message).toContain("Demasiadas solicitudes");
    }
  });

  it("rechaza entradas que no cumplan con el formato de usuario", async () => {
    const authService = createMockAuthService();
    const action = createLoginAction({ authService });

    const result = await action({
      username: "a@b",
      password: "Password123!",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.errors?.username).toBeDefined();
    }
  });
});
