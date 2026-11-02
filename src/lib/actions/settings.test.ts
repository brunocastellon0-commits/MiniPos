import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepositories, MemoryStore } from "@/lib/repos";
import { createGetBusinessPublicAction } from "./settings-core";
import type { AuthenticatedUser } from "./secure-action";

const cashier: AuthenticatedUser = {
  id: "cashier-1",
  name: "Carlos Mamani",
  role: "cashier",
  isActive: true,
};

const owner: AuthenticatedUser = {
  id: "owner-1",
  name: "Ana Quispe",
  role: "owner",
  isActive: true,
};

describe("getBusinessPublicAction (E4-07)", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  function makeAction(user: AuthenticatedUser | null) {
    return createGetBusinessPublicAction({
      currentUserResolver: async () => user,
      settingsRepoFactory: async (ctx) =>
        createMemoryRepositories(store, ctx).settings,
    });
  }

  it("devuelve la configuración pública con cashier_can_discount false por defecto", async () => {
    const result = await makeAction(cashier)();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.name).toBe("Mi Minimarket");
    expect(result.data.cashier_can_discount).toBe(false);
  });

  it("refleja el permiso habilitado por el dueño", async () => {
    const ownerRepos = createMemoryRepositories(store, {
      id: "owner-1",
      role: "owner",
      active: true,
    });
    await ownerRepos.settings.updateSettings({ cashier_can_discount: true });

    const result = await makeAction(cashier)();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.cashier_can_discount).toBe(true);
  });

  it("rechaza usuarios no autenticados", async () => {
    const result = await makeAction(null)();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHENTICATED");
  });
});
