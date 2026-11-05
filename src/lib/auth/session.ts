import { redirect } from "next/navigation";
import { cache } from "react";
import type { AuthenticatedUser, UserRole } from "@/lib/actions/secure-action";
import { createClient } from "@/lib/supabase/server";

export type { AuthenticatedUser, UserRole };

export interface SessionClientProvider {
  getUser: () => Promise<{
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null>;
  getProfile: (userId: string) => Promise<{
    id: string;
    full_name: string;
    role: string;
    active: boolean;
  } | null>;
}

export const defaultSessionClientProvider: SessionClientProvider = {
  async getUser() {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) return null;
      return {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      };
    } catch {
      return null;
    }
  },

  async getProfile(userId: string) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, active")
        .eq("id", userId)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    } catch {
      return null;
    }
  },
};

// Carga sin caché (fuente única de verdad). React cache() solo memoiza dentro
// del ámbito RSC de Next; fuera de él delega sin efecto.
async function loadCurrentUser(
  provider: SessionClientProvider,
): Promise<AuthenticatedUser | null> {
  const user = await provider.getUser();
  if (!user) return null;

  const profile = await provider.getProfile(user.id);
  if (!profile) {
    return {
      id: user.id,
      email: user.email,
      name: (user.user_metadata?.full_name as string) ?? "Usuario",
      role: "cashier",
      isActive: false,
    };
  }

  return {
    id: profile.id,
    email: user.email,
    name: profile.full_name,
    role: profile.role as UserRole,
    isActive: profile.active,
  };
}

const cachedCurrentUser = cache(loadCurrentUser);

export async function getCurrentUser(
  provider: SessionClientProvider = defaultSessionClientProvider,
): Promise<AuthenticatedUser | null> {
  return cachedCurrentUser(provider);
}

export async function requireUser(
  redirectTo = "/login",
  provider: SessionClientProvider = defaultSessionClientProvider,
): Promise<AuthenticatedUser> {
  const user = await getCurrentUser(provider);

  if (!user || !user.isActive) {
    redirect(redirectTo);
  }

  return user;
}

export async function requireRole(
  allowedRoles: UserRole | UserRole[],
  fallbackUrl = "/caja?error=forbidden",
  provider: SessionClientProvider = defaultSessionClientProvider,
): Promise<AuthenticatedUser> {
  const user = await requireUser("/login", provider);
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(user.role)) {
    redirect(fallbackUrl);
  }

  return user;
}
