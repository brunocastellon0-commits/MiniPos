import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { isPathAllowedForRole } from "./nav-items";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/caja",
}));

describe("Navegación y Layout por Rol (E1-03)", () => {
  const cashierUser: AuthenticatedUser = {
    id: "cashier-1",
    email: "cajero@lilamarket.bo",
    name: "Carlos Cajero",
    role: "cashier",
    isActive: true,
  };

  const ownerUser: AuthenticatedUser = {
    id: "owner-1",
    email: "dueno@lilamarket.bo",
    name: "Doña Julia",
    role: "owner",
    isActive: true,
  };

  describe("Sidebar: Restricción de navegación por rol", () => {
    it("el cajero SOLO ve el grupo de Operación (Caja, Turno, Ventas) y no ve módulos administrativos", () => {
      render(<AppSidebar user={cashierUser} />);

      // Debe ver grupo Operación
      expect(screen.getByRole("heading", { name: "Operación" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /caja/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /turno/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /ventas/i })).toBeInTheDocument();

      // NO debe ver grupos reservados para dueño
      expect(screen.queryByRole("heading", { name: "Gestión" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Análisis" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Administración" })).not.toBeInTheDocument();

      // Enlaces prohibidos no deben existir
      expect(screen.queryByRole("link", { name: /productos/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /inventario/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /compras/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /panel/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /reportes/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /configuración/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /usuarios/i })).not.toBeInTheDocument();
    });

    it("el dueño ve todos los grupos (Operación, Gestión, Análisis, Administración) y todas las opciones", () => {
      render(<AppSidebar user={ownerUser} />);

      expect(screen.getByRole("heading", { name: "Operación" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Gestión" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Análisis" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Administración" })).toBeInTheDocument();

      // Enlaces presentes
      expect(screen.getByRole("link", { name: /caja/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /productos/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /inventario/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /compras/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /panel/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /reportes/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /configuración/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /usuarios/i })).toBeInTheDocument();
    });
  });

  describe("Cabecera: Información de negocio, estado de turno y usuario", () => {
    it("muestra el nombre del negocio, usuario, badge de rol y botón de cerrar sesión", () => {
      render(
        <AppHeader
          user={cashierUser}
          businessName="Minimarket San Martín"
          cashSessionOpen={true}
        />,
      );

      expect(screen.getByText("Minimarket San Martín")).toBeInTheDocument();
      expect(screen.getByText("Carlos Cajero")).toBeInTheDocument();
      expect(screen.getByText("Cajero")).toBeInTheDocument();
      expect(screen.getByText("Caja abierta")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cerrar sesión/i })).toBeInTheDocument();
    });

    it("indica 'Caja cerrada' cuando no hay turno activo", () => {
      render(<AppHeader user={ownerUser} businessName="LILA MARKET" cashSessionOpen={false} />);

      expect(screen.getByText("Caja cerrada")).toBeInTheDocument();
      expect(screen.getByText("Dueño")).toBeInTheDocument();
    });
  });

  describe("Helper isPathAllowedForRole", () => {
    it("valida correctamente las rutas según la matriz de roles", () => {
      // Rutas de cajero
      expect(isPathAllowedForRole("/caja", "cashier")).toBe(true);
      expect(isPathAllowedForRole("/turno", "cashier")).toBe(true);
      expect(isPathAllowedForRole("/ventas", "cashier")).toBe(true);

      // Rutas prohibidas para cajero
      expect(isPathAllowedForRole("/productos", "cashier")).toBe(false);
      expect(isPathAllowedForRole("/inventario", "cashier")).toBe(false);
      expect(isPathAllowedForRole("/compras", "cashier")).toBe(false);
      expect(isPathAllowedForRole("/panel", "cashier")).toBe(false);
      expect(isPathAllowedForRole("/reportes", "cashier")).toBe(false);
      expect(isPathAllowedForRole("/configuracion", "cashier")).toBe(false);
      expect(isPathAllowedForRole("/usuarios", "cashier")).toBe(false);

      // El dueño tiene acceso a todo
      expect(isPathAllowedForRole("/caja", "owner")).toBe(true);
      expect(isPathAllowedForRole("/productos", "owner")).toBe(true);
      expect(isPathAllowedForRole("/panel", "owner")).toBe(true);
      expect(isPathAllowedForRole("/usuarios", "owner")).toBe(true);
    });
  });
});
