"use client";

import { useState } from "react";
import { InactivityWatcher } from "@/components/auth/inactivity-watcher";
import type { AuthenticatedUser } from "@/lib/auth";
import type { OpenCashSessionPublic } from "@/lib/repos/types";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export interface AppLayoutClientProps {
  user: AuthenticatedUser;
  businessName?: string;
  logoUrl?: string | null;
  cashSession?: OpenCashSessionPublic | null;
  children: React.ReactNode;
}

export function AppLayoutClient({
  user,
  businessName,
  logoUrl,
  cashSession,
  children,
}: AppLayoutClientProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted/30">
      <AppHeader
        user={user}
        businessName={businessName}
        logoUrl={logoUrl}
        cashSession={cashSession}
        onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
        mobileNavOpen={mobileNavOpen}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar escritorio */}
        <div className="hidden lg:block lg:shrink-0">
          <AppSidebar user={user} className="h-[calc(100vh-4rem)]" />
        </div>

        {/* Drawer móvil con overlay accesible */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl">
              <AppSidebar
                user={user}
                onNavigate={() => setMobileNavOpen(false)}
                className="w-full border-r-0 pt-4"
              />
            </div>
          </div>
        )}

        {/* Contenido principal de la página */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <InactivityWatcher />
    </div>
  );
}
