import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/lib/auth/session";
import type { AuthenticatedUser } from "./secure-action";
import { ActionException, defaultGetCurrentUser, secureAction } from "./secure-action";

vi.mock("@/lib/auth/session");

const owner: AuthenticatedUser = {
  id: "owner-1",
  name: "Doña Elena",
  role: "owner",
  isActive: true,
};

function actionWith(handler: () => Promise<string>) {
  return secureAction<void, string>({
    roles: ["owner"],
    currentUserResolver: async () => owner,
    handler,
  });
}

describe("secureAction - resolución de usuario (rendimiento)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("defaultGetCurrentUser delega en getCurrentUser (fuente única de autenticación)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(owner);

    const user = await defaultGetCurrentUser();

    expect(getCurrentUser).toHaveBeenCalledTimes(1);
    expect(user).toEqual(owner);
  });

  it("las acciones isPublic no resuelven usuario ni tocan Supabase Auth", async () => {
    let seenUser: unknown = "sin-llamar";

    const action = secureAction<void, string>({
      isPublic: true,
      handler: async (_input, ctx) => {
        seenUser = ctx.user;
        return "ok";
      },
    });

    const result = await action(undefined);

    expect(result).toEqual({ ok: true, data: "ok" });
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(seenUser).toBeNull();
  });

  it("las acciones privadas sí resuelven usuario y exigen sesión", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const action = secureAction<void, string>({
      roles: ["owner"],
      handler: async () => "nunca-debe-ejecutarse",
    });

    const result = await action(undefined);

    expect(getCurrentUser).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHENTICATED");
  });
});

describe("secureAction - manejo de errores (E11-07)", () => {
  it("ActionException conserva su mensaje y código ante el cliente", async () => {
    const action = actionWith(async () => {
      throw new ActionException("No hay stock suficiente.", "CONFLICT");
    });

    const result = await action(undefined);

    expect(result).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "No hay stock suficiente.",
    });
  });

  it("los códigos controlados de auth/mfa sí devuelven su mensaje", async () => {
    const action = actionWith(async () => {
      throw Object.assign(new Error("Usuario o contraseña incorrectos."), {
        code: "INVALID_CREDENTIALS",
      });
    });

    const result = await action(undefined);

    expect(result).toEqual({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Usuario o contraseña incorrectos.",
    });
  });

  it("un error desconocido con código (p. ej. de Postgres) jamás filtra su mensaje", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const action = actionWith(async () => {
        throw Object.assign(new Error('columna "cost_cents" no existe en relation "products"'), {
          code: "42703",
        });
      });

      const result = await action(undefined);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INTERNAL_ERROR");
        expect(result.message).toBe("Ocurrió un error inesperado al procesar la solicitud.");
        expect(result.message).not.toContain("cost_cents");
        expect(result.message).not.toContain("42703");
      }
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("un error sin código desconocido tampoco expone su mensaje", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const action = actionWith(async () => {
        throw new Error("connect ECONNREFUSED 10.0.0.1:5432");
      });

      const result = await action(undefined);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INTERNAL_ERROR");
        expect(result.message).not.toContain("ECONNREFUSED");
      }
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
