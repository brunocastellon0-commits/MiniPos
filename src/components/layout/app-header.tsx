"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import type { AuthenticatedUser } from "@/lib/auth";
import { LOGO_SRC } from "@/lib/branding";
import { formatTime } from "@/lib/dates";
import type { DashboardNotification } from "@/lib/domain/dashboard";
import type { OpenCashSessionPublic } from "@/lib/repos/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface AppHeaderProps {
  user: AuthenticatedUser;
  businessName?: string;
  cashSession?: OpenCashSessionPublic | null;
  notifications?: DashboardNotification[] | null;
  onToggleMobileNav?: () => void;
  mobileNavOpen?: boolean;
}

export function AppHeader({
  user,
  businessName = "LILA MARKET",
  cashSession = null,
  notifications = null,
  onToggleMobileNav,
  mobileNavOpen = false,
}: AppHeaderProps) {
  const cashSessionOpen = Boolean(cashSession);
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await logoutAction();
      if (res.ok) {
        router.push(res.data.redirectUrl);
      } else {
        router.push("/login");
      }
    } catch {
      router.push("/login");
    }
  };

  const roleLabel = user.role === "owner" ? "Dueño" : "Cajero";
  const roleBadgeTone = user.role === "owner" ? "accent" : "neutral";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-surface px-4 shadow-sm sm:px-6">
      {/* Izquierda: Menú móvil + Marca */}
      <div className="flex items-center gap-3">
        {onToggleMobileNav && (
          <button
            type="button"
            onClick={onToggleMobileNav}
            aria-label={mobileNavOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
            className="flex size-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-surface-muted lg:hidden"
          >
            {mobileNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Image
              src={LOGO_SRC}
              alt={businessName}
              width={28}
              height={28}
              className="size-7 rounded-md object-contain"
            />
          </div>
          <span className="font-bold text-foreground text-sm sm:text-base tracking-tight">
            {businessName}
          </span>
        </div>
      </div>

      {/* Centro / Estado de caja */}
      <div className="hidden sm:flex items-center gap-2">
        <div
          className="flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1 text-xs font-medium"
          aria-live="polite"
        >
          <span
            className={`size-2 rounded-full ${
              cashSessionOpen ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
            aria-hidden="true"
          />
          <span className="text-foreground">
            {cashSession
              ? `Caja abierta · desde ${formatTime(new Date(cashSession.opened_at))} · ${cashSession.opened_by_name}`
              : "Caja cerrada"}
          </span>
        </div>
      </div>

      {/* Derecha: Notificaciones, Usuario y Cerrar sesión */}
      <div className="flex items-center gap-3">
        {notifications ? (
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Notificaciones${notifications.length > 0 ? ` (${notifications.length})` : ""}`}
              aria-expanded={notificationsOpen}
              aria-controls="notifications-panel"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className="relative"
            >
              <Bell className="size-4" aria-hidden="true" />
              {notifications.length > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-danger-foreground">
                  {notifications.length}
                </span>
              ) : null}
            </Button>
            {notificationsOpen ? (
              <div
                id="notifications-panel"
                aria-label="Lista de notificaciones"
                className="absolute right-0 z-40 mt-2 w-72 rounded-card border border-border bg-surface shadow-card"
              >
                {notifications.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {notifications.map((notification) => (
                      <li key={notification.kind}>
                        <Link
                          href={notification.href}
                          onClick={() => setNotificationsOpen(false)}
                          className="block px-4 py-3 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="block text-sm font-semibold text-foreground">
                            {notification.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-foreground-muted">
                            {notification.description}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-3 text-sm text-foreground-muted">Sin notificaciones.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col items-end">
          <span className="text-xs font-semibold text-foreground sm:text-sm leading-tight">
            {user.name}
          </span>
          <Badge tone={roleBadgeTone} className="text-[10px] px-1.5 py-0 mt-0.5">
            {roleLabel}
          </Badge>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          loading={loggingOut}
          disabled={loggingOut}
          aria-label="Cerrar sesión"
          className="text-muted hover:text-danger hover:bg-danger/10"
        >
          <LogOut className="size-4" />
          <span className="hidden md:inline ml-1 text-xs">Cerrar sesión</span>
        </Button>
      </div>
    </header>
  );
}
