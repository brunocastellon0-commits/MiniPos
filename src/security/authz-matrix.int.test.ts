import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { RateLimiter } from "@/lib/actions/rate-limiter";
import { type AuthenticatedUser, secureAction } from "@/lib/actions/secure-action";

describe("Matriz de Autorización y Flujo Seguro (authz-matrix)", () => {
  const activeOwner: AuthenticatedUser = {
    id: "owner-01",
    email: "owner@lilamarket.bo",
    name: "Dueño Principal",
    role: "owner",
    isActive: true,
  };

  const activeCashier: AuthenticatedUser = {
    id: "cashier-01",
    email: "cashier@lilamarket.bo",
    name: "Cajero Turno Tarde",
    role: "cashier",
    isActive: true,
  };

  const inactiveCashier: AuthenticatedUser = {
    id: "cashier-inactive",
    email: "inactive@lilamarket.bo",
    name: "Cajero Desactivado",
    role: "cashier",
    isActive: false,
  };

  const inactiveOwner: AuthenticatedUser = {
    id: "owner-inactive",
    email: "owner-inactive@lilamarket.bo",
    name: "Dueño Suspendido",
    role: "owner",
    isActive: false,
  };

  describe("1. Autenticación requerida", () => {
    it("falla con UNAUTHENTICATED si no hay usuario en sesión", async () => {
      const ownerAction = secureAction({
        roles: ["owner"],
        currentUserResolver: async () => null,
        handler: async () => ({ secret: "top-secret" }),
      });

      const result = await ownerAction({});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHENTICATED");
        expect(result.message).toContain("Debes iniciar sesión");
      }
    });
  });

  describe("2. Verificación de usuario activo", () => {
    it("falla con USER_INACTIVE si un cajero está inactivo", async () => {
      const cashierAction = secureAction({
        roles: ["cashier", "owner"],
        currentUserResolver: async () => inactiveCashier,
        handler: async () => ({ status: "processed" }),
      });

      const result = await cashierAction({});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("USER_INACTIVE");
        expect(result.message).toContain("inactivo");
      }
    });

    it("falla con USER_INACTIVE si un dueño está inactivo", async () => {
      const ownerAction = secureAction({
        roles: ["owner"],
        currentUserResolver: async () => inactiveOwner,
        handler: async () => ({ ok: true }),
      });

      const result = await ownerAction({});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("USER_INACTIVE");
      }
    });
  });

  describe("3. Matriz de roles (owner vs cashier)", () => {
    const ownerOnlyAction = (user: AuthenticatedUser) =>
      secureAction({
        roles: ["owner"],
        currentUserResolver: async () => user,
        handler: async () => ({ access: "granted-to-owner" }),
      });

    const sharedAction = (user: AuthenticatedUser) =>
      secureAction({
        roles: ["cashier", "owner"],
        currentUserResolver: async () => user,
        handler: async () => ({ access: "granted-to-both" }),
      });

    it("rechaza a un cajero activo que intenta ejecutar una acción solo para dueños (FORBIDDEN)", async () => {
      const action = ownerOnlyAction(activeCashier);
      const result = await action({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("FORBIDDEN");
        expect(result.message).toContain("No tienes permisos");
      }
    });

    it("permite a un dueño activo ejecutar una acción solo para dueños", async () => {
      const action = ownerOnlyAction(activeOwner);
      const result = await action({});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ access: "granted-to-owner" });
      }
    });

    it("permite tanto a cajero como a dueño ejecutar acciones compartidas", async () => {
      const cashierResult = await sharedAction(activeCashier)({});
      expect(cashierResult.ok).toBe(true);

      const ownerResult = await sharedAction(activeOwner)({});
      expect(ownerResult.ok).toBe(true);
    });
  });

  describe("4. Rate limiting", () => {
    it("bloquea con RATE_LIMITED cuando se supera el umbral configurado", async () => {
      const limiter = new RateLimiter(2, 5000); // máx 2 llamadas
      const rateLimitedAction = secureAction({
        roles: ["cashier", "owner"],
        currentUserResolver: async () => activeCashier,
        rateLimiter: limiter,
        rateLimit: {
          keyPrefix: "test-rate",
          maxRequests: 2,
          windowMs: 5000,
        },
        handler: async () => ({ value: 1 }),
      });

      // Llamada 1: ok
      const r1 = await rateLimitedAction({});
      expect(r1.ok).toBe(true);

      // Llamada 2: ok
      const r2 = await rateLimitedAction({});
      expect(r2.ok).toBe(true);

      // Llamada 3: bloqueada
      const r3 = await rateLimitedAction({});
      expect(r3.ok).toBe(false);
      if (!r3.ok) {
        expect(r3.code).toBe("RATE_LIMITED");
        expect(r3.message).toContain("Demasiadas solicitudes");
      }
    });
  });

  describe("5. Auditoría integrada", () => {
    it("invoca el callback de auditoría con input, resultado y usuario autenticado", async () => {
      const auditMock = vi.fn();
      const schema = z.object({
        sale_id: z.string().uuid(),
      });

      const action = secureAction({
        roles: ["cashier", "owner"],
        currentUserResolver: async () => activeCashier,
        schema,
        audit: auditMock,
        handler: async (input) => ({ processedId: input.sale_id }),
      });

      const validId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      const result = await action({ sale_id: validId });

      expect(result.ok).toBe(true);
      expect(auditMock).toHaveBeenCalledTimes(1);
      expect(auditMock).toHaveBeenCalledWith(
        { sale_id: validId },
        result,
        expect.objectContaining({
          user: expect.objectContaining({ id: "cashier-01", role: "cashier" }),
        }),
      );
    });
  });

  describe("6. Resiliencia y manejo seguro de errores", () => {
    it("enmascara excepciones inesperadas como INTERNAL_ERROR sin filtrar información del servidor", async () => {
      const failingAction = secureAction({
        roles: ["owner"],
        currentUserResolver: async () => activeOwner,
        handler: async () => {
          throw new Error("PostgreSQL connection lost: password leaked xyz");
        },
      });

      const result = await failingAction({});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INTERNAL_ERROR");
        expect(result.message).toBe("Ocurrió un error inesperado al procesar la solicitud.");
        expect(result.message).not.toContain("PostgreSQL");
        expect(result.message).not.toContain("password");
      }
    });

    it("preserva errores de dominio controlados con código de negocio", async () => {
      class DomainError extends Error {
        code = "STOCK_INSUFFICIENT";
        constructor(message: string) {
          super(message);
          this.name = "DomainError";
        }
      }

      const domainErrorAction = secureAction({
        roles: ["cashier"],
        currentUserResolver: async () => activeCashier,
        handler: async () => {
          throw new DomainError("No hay stock disponible para completar la venta.");
        },
      });

      const result = await domainErrorAction({});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("STOCK_INSUFFICIENT");
        expect(result.message).toBe("No hay stock disponible para completar la venta.");
      }
    });
  });
});
