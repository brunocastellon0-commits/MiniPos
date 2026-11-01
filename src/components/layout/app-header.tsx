"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Store, X } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import type { AuthenticatedUser } from "@/lib/auth";
import { formatTime } from "@/lib/dates";
import type { OpenCashSessionPublic } from "@/lib/repos/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface AppHeaderProps {
  user: AuthenticatedUser;
  businessName?: string;
  logoUrl?: string | null;
  cashSession?: OpenCashSessionPublic | null;
  onToggleMobileNav?: () => void;
  mobileNavOpen?: boolean;
}

export function AppHeader({
  user,
  businessName = "LILA MARKET",
  logoUrl,
  cashSession = null,
  onToggleMobileNav,
  mobileNavOpen = false,
}: AppHeaderProps) {
  const cashSessionOpen = Boolean(cashSession);
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

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
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={businessName}
                width={28}
                height={28}
                className="size-7 rounded-md object-contain"
              />
            ) : (
              <Store className="size-5" />
            )}
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

      {/* Derecha: Usuario y Cerrar sesión */}
      <div className="flex items-center gap-3">
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
