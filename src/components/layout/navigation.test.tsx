import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth";
import type { DashboardNotification } from "@/lib/domain/dashboard";
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
      expect(screen.queryByRole("link", { name: /proveedores/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /panel/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /reportes/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /auditoría/i })).not.toBeInTheDocument();
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
      expect(screen.getByRole("link", { name: /proveedores/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /panel/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /reportes/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /auditoría/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /configuración/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /usuarios/i })).toBeInTheDocument();
    });

    it("muestra el contador de stock bajo en el enlace de inventario (E6-04)", () => {
      render(<AppSidebar user={ownerUser} lowStockCount={3} />);

      expect(screen.getByLabelText("3 productos con stock bajo")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /inventario/i })).toBeInTheDocument();
    });

    it("no muestra el contador cuando no hay productos en bajo stock (E6-04)", () => {
      render(<AppSidebar user={ownerUser} />);

      expect(screen.queryByText("3 productos con stock bajo")).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: /inventario/i })).toBeInTheDocument();
    });
  });

  describe("Cabecera: Información de negocio, estado de turno y usuario", () => {
    it("muestra el nombre del negocio, usuario, badge de rol y turno abierto con hora y responsable", () => {
      render(
        <AppHeader
          user={cashierUser}
          businessName="Minimarket San Martín"
          cashSession={{
            id: "s-1",
            opened_at: "2026-10-30T12:02:00.000Z",
            opened_by: "cashier-1",
            opened_by_name: "María Choque",
          }}
        />,
      );

      expect(screen.getByText("Minimarket San Martín")).toBeInTheDocument();
      expect(screen.getByText("Carlos Cajero")).toBeInTheDocument();
      expect(screen.getByText("Cajero")).toBeInTheDocument();
      expect(screen.getByText("Caja abierta")).toBeInTheDocument();
      expect(screen.getByText(/desde 08:02/)).toBeInTheDocument();
      expect(screen.getByText(/María Choque/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cerrar sesión/i })).toBeInTheDocument();
    });

    it("indica 'Caja cerrada' cuando no hay turno activo", () => {
      render(<AppHeader user={ownerUser} businessName="LILA MARKET" cashSession={null} />);

      expect(screen.getByText("Caja cerrada")).toBeInTheDocument();
      expect(screen.getByText("Dueño")).toBeInTheDocument();
    });
  });

  describe("Campana de notificaciones (E8-03)", () => {
    const notifications: DashboardNotification[] = [
      {
        kind: "low_stock",
        title: "Stock bajo",
        description: "3 productos requieren reposición",
        href: "/inventario",
      },
      {
        kind: "cash_difference",
        title: "Diferencia de caja",
        description: "La última caja cerrada quedó en -Bs 1,50",
        href: "/turno",
      },
    ];

    it("muestra la campana con contador y despliega las notificaciones", () => {
      render(<AppHeader user={ownerUser} businessName="LILA MARKET" notifications={notifications} />);

      const bell = screen.getByRole("button", { name: "Notificaciones (2)" });
      expect(bell).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(bell);

      expect(bell).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("link", { name: /Stock bajo/ })).toHaveAttribute(
        "href",
        "/inventario",
      );
      expect(screen.getByRole("link", { name: /Diferencia de caja/ })).toHaveAttribute(
        "href",
        "/turno",
      );
    });

    it("muestra el estado vacío de la campana", () => {
      render(<AppHeader user={ownerUser} businessName="LILA MARKET" notifications={[]} />);

      const bell = screen.getByRole("button", { name: "Notificaciones" });
      fireEvent.click(bell);

      expect(screen.getByText("Sin notificaciones.")).toBeInTheDocument();
    });

    it("no muestra la campana cuando no hay notificaciones (cajero)", () => {
      render(<AppHeader user={cashierUser} businessName="LILA MARKET" />);

      expect(screen.queryByRole("button", { name: /Notificaciones/ })).not.toBeInTheDocument();
    });
  });

  describe("Etiqueta de navegación por modalidad (Fase E)", () => {
    it("muestra Caja en micromarket y Pedidos en restaurante (misma ruta)", () => {
      const { unmount } = render(<AppSidebar user={ownerUser} operatingMode="micromarket" />);
      expect(screen.getByRole("link", { name: "Caja" })).toHaveAttribute("href", "/caja");
      unmount();

      render(<AppSidebar user={ownerUser} operatingMode="restaurant" />);
      expect(screen.getByRole("link", { name: "Pedidos" })).toHaveAttribute("href", "/caja");
      expect(screen.queryByRole("link", { name: "Caja" })).not.toBeInTheDocument();
    });

    it("el cajero también ve Pedidos en restaurante", () => {
      render(<AppSidebar user={cashierUser} operatingMode="restaurant" />);
      expect(screen.getByRole("link", { name: "Pedidos" })).toHaveAttribute("href", "/caja");
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
      expect(isPathAllowedForRole("/proveedores", "cashier")).toBe(false);
      expect(isPathAllowedForRole("/panel", "cashier")).toBe(false);
      expect(isPathAllowedForRole("/reportes", "cashier")).toBe(false);
      expect(isPathAllowedForRole("/auditoria", "cashier")).toBe(false);
      expect(isPathAllowedForRole("/configuracion", "cashier")).toBe(false);
      expect(isPathAllowedForRole("/usuarios", "cashier")).toBe(false);

      // El dueño tiene acceso a todo
      expect(isPathAllowedForRole("/caja", "owner")).toBe(true);
      expect(isPathAllowedForRole("/productos", "owner")).toBe(true);
      expect(isPathAllowedForRole("/proveedores", "owner")).toBe(true);
      expect(isPathAllowedForRole("/panel", "owner")).toBe(true);
      expect(isPathAllowedForRole("/usuarios", "owner")).toBe(true);
      expect(isPathAllowedForRole("/auditoria", "owner")).toBe(true);
    });
  });
});
