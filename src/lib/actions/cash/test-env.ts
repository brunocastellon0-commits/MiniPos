import { MemoryCashRepo } from "@/lib/repos/memory/cash";
import { MemorySalesRepo } from "@/lib/repos/memory/sales";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import type { Profile, UserContext } from "@/lib/repos/types";
import type { AuthenticatedUser } from "../secure-action";
import type { CashActionDeps } from "../cash-core";

export const ownerUser: AuthenticatedUser = {
  id: "owner-1",
  name: "Doña Elena",
  role: "owner",
  isActive: true,
};

export const cashierUser: AuthenticatedUser = {
  id: "cashier-1",
  name: "Carlos Mamani",
  role: "cashier",
  isActive: true,
};

export const otherCashierUser: AuthenticatedUser = {
  id: "cashier-2",
  name: "María Choque",
  role: "cashier",
  isActive: true,
};

function profile(id: string, fullName: string, role: "owner" | "cashier"): Profile {
  return {
    id,
    full_name: fullName,
    role,
    active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

export interface CashTestEnv {
  store: MemoryStore;
  deps: (user: AuthenticatedUser | null) => CashActionDeps;
}

export function createCashTestEnv(): CashTestEnv {
  const store = new MemoryStore();
  store.profiles.set("owner-1", profile("owner-1", "Doña Elena", "owner"));
  store.profiles.set("cashier-1", profile("cashier-1", "Carlos Mamani", "cashier"));
  store.profiles.set("cashier-2", profile("cashier-2", "María Choque", "cashier"));

  const deps = (user: AuthenticatedUser | null): CashActionDeps => ({
    currentUserResolver: async () => user,
    cashRepoFactory: async (ctx: UserContext) => new MemoryCashRepo(store, ctx),
    salesRepoFactory: async (ctx: UserContext) => new MemorySalesRepo(store, ctx),
  });

  return { store, deps };
}
