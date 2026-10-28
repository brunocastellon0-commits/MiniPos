import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser, requireRole, requireUser, type SessionClientProvider } from "./session";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

describe("Módulo de Sesión y Verificación de Roles (E1-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProvider = (overrides?: Partial<SessionClientProvider>): SessionClientProvider => ({
    getUser: vi.fn().mockResolvedValue({
      id: "usr-1",
      email: "owner@lilamarket.bo",
      user_metadata: { full_name: "Dueño Principal" },
    }),
    getProfile: vi.fn().mockResolvedValue({
      id: "usr-1",
      full_name: "Dueño Principal",
      role: "owner",
      active: true,
    }),
    ...overrides,
  });

  describe("getCurrentUser", () => {
    it("devuelve null cuando no hay sesión activa", async () => {
      const provider = mockProvider({
        getUser: vi.fn().mockResolvedValue(null),
      });

      const user = await getCurrentUser(provider);
      expect(user).toBeNull();
    });

    it("devuelve los datos completos del usuario con su rol y estado activo", async () => {
      const provider = mockProvider();

      const user = await getCurrentUser(provider);
      expect(user).not.toBeNull();
      expect(user).toEqual({
        id: "usr-1",
        email: "owner@lilamarket.bo",
        name: "Dueño Principal",
        role: "owner",
        isActive: true,
      });
    });

    it("marca isActive en false si el perfil en base de datos está desactivado", async () => {
      const provider = mockProvider({
        getProfile: vi.fn().mockResolvedValue({
          id: "usr-1",
          full_name: "Usuario Inactivo",
          role: "cashier",
          active: false,
        }),
      });

      const user = await getCurrentUser(provider);
      expect(user).not.toBeNull();
      expect(user?.isActive).toBe(false);
      expect(user?.role).toBe("cashier");
    });
  });

  describe("requireUser", () => {
    it("redirige a /login si no hay usuario autenticado", async () => {
      const provider = mockProvider({
        getUser: vi.fn().mockResolvedValue(null),
      });

      await expect(requireUser("/login", provider)).rejects.toThrow("NEXT_REDIRECT:/login");
      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("redirige a /login si el usuario existe pero está desactivado", async () => {
      const provider = mockProvider({
        getProfile: vi.fn().mockResolvedValue({
          id: "usr-1",
          full_name: "Suspendido",
          role: "cashier",
          active: false,
        }),
      });

      await expect(requireUser("/login", provider)).rejects.toThrow("NEXT_REDIRECT:/login");
      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("retorna el usuario activo sin redirigir", async () => {
      const provider = mockProvider();

      const user = await requireUser("/login", provider);
      expect(user.id).toBe("usr-1");
      expect(user.isActive).toBe(true);
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("requireRole", () => {
    it("permite el acceso si el rol del usuario coincide con el rol requerido", async () => {
      const provider = mockProvider(); // owner

      const user = await requireRole("owner", "/caja", provider);
      expect(user.role).toBe("owner");
      expect(redirect).not.toHaveBeenCalled();
    });

    it("permite el acceso si el rol del usuario está dentro de la lista de roles permitidos", async () => {
      const provider = mockProvider({
        getProfile: vi.fn().mockResolvedValue({
          id: "usr-cashier",
          full_name: "Cajero de turno",
          role: "cashier",
          active: true,
        }),
      });

      const user = await requireRole(["cashier", "owner"], "/caja", provider);
      expect(user.role).toBe("cashier");
      expect(redirect).not.toHaveBeenCalled();
    });

    it("bloquea y redirige a la URL de fallback si un cajero intenta acceder a una ruta de dueño", async () => {
      const provider = mockProvider({
        getProfile: vi.fn().mockResolvedValue({
          id: "usr-cashier",
          full_name: "Cajero de turno",
          role: "cashier",
          active: true,
        }),
      });

      await expect(requireRole("owner", "/caja?error=forbidden", provider)).rejects.toThrow(
        "NEXT_REDIRECT:/caja?error=forbidden",
      );

      expect(redirect).toHaveBeenCalledWith("/caja?error=forbidden");
    });
  });
});
