"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { AuthenticatedUser } from "@/lib/auth";
import { cn } from "@/lib/utils/cn";
import { getNavGroupsForRole } from "./nav-items";

export interface AppSidebarProps {
  user: AuthenticatedUser;
  onNavigate?: () => void;
  className?: string;
  lowStockCount?: number;
}

export function AppSidebar({ user, onNavigate, className, lowStockCount = 0 }: AppSidebarProps) {
  const pathname = usePathname();
  const groups = getNavGroupsForRole(user.role);

  return (
    <aside className={cn("flex h-full w-64 flex-col border-r border-border bg-surface", className)}>
      <nav aria-label="Navegación principal" className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {groups.map((group) => (
          <div key={group.name} className="space-y-1">
            <h4 className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted">
              {group.name}
            </h4>
            <div className="space-y-0.5 pt-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-surface-muted",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span>{item.title}</span>
                    {item.href === "/inventario" && lowStockCount > 0 ? (
                      <Badge
                        tone="warning"
                        className="ms-auto"
                        aria-label={`${lowStockCount} productos con stock bajo`}
                      >
                        {lowStockCount}
                      </Badge>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
