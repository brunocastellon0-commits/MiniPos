import type { ElementType } from "react";
import {
  BarChart3,
  Boxes,
  Clock,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import type { UserRole } from "@/lib/auth";

export interface NavItem {
  title: string;
  href: string;
  icon: ElementType;
  roles: UserRole[];
}

export interface NavGroup {
  name: string;
  items: NavItem[];
}

export const ALL_NAV_GROUPS: NavGroup[] = [
  {
    name: "Operación",
    items: [
      {
        title: "Caja",
        href: "/caja",
        icon: ShoppingCart,
        roles: ["cashier", "owner"],
      },
      {
        title: "Turno",
        href: "/turno",
        icon: Clock,
        roles: ["cashier", "owner"],
      },
      {
        title: "Ventas",
        href: "/ventas",
        icon: Receipt,
        roles: ["cashier", "owner"],
      },
    ],
  },
  {
    name: "Gestión",
    items: [
      {
        title: "Productos",
        href: "/productos",
        icon: Package,
        roles: ["owner"],
      },
      {
        title: "Inventario",
        href: "/inventario",
        icon: Boxes,
        roles: ["owner"],
      },
      {
        title: "Compras",
        href: "/compras",
        icon: Truck,
        roles: ["owner"],
      },
    ],
  },
  {
    name: "Análisis",
    items: [
      {
        title: "Panel",
        href: "/panel",
        icon: LayoutDashboard,
        roles: ["owner"],
      },
      {
        title: "Reportes",
        href: "/reportes",
        icon: BarChart3,
        roles: ["owner"],
      },
    ],
  },
  {
    name: "Administración",
    items: [
      {
        title: "Configuración",
        href: "/configuracion",
        icon: Settings,
        roles: ["owner"],
      },
      {
        title: "Usuarios",
        href: "/usuarios",
        icon: Users,
        roles: ["owner"],
      },
    ],
  },
];

export function getNavGroupsForRole(role: UserRole): NavGroup[] {
  return ALL_NAV_GROUPS.map((group) => ({
    name: group.name,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

export function isPathAllowedForRole(pathname: string, role: UserRole): boolean {
  for (const group of ALL_NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item.roles.includes(role);
      }
    }
  }
  return true;
}
