import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "./secure-action";
import { ActionException, secureAction } from "./secure-action";

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
      throw Object.assign(new Error("Correo electrónico o contraseña incorrectos."), {
        code: "INVALID_CREDENTIALS",
      });
    });

    const result = await action(undefined);

    expect(result).toEqual({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Correo electrónico o contraseña incorrectos.",
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
