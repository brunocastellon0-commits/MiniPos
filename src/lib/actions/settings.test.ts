import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepositories, MemoryStore } from "@/lib/repos";
import {
  createGetBusinessPublicAction,
  createGetBusinessSettingsAction,
  createUpdateBusinessSettingsAction,
} from "./settings-core";
import type { SettingsActionDeps } from "./settings-core";
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

describe("Configuración del negocio (E10-01/E10-02)", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  function makeDeps(user: AuthenticatedUser | null): SettingsActionDeps {
    return {
      currentUserResolver: async () => user,
      settingsRepoFactory: async (ctx) => createMemoryRepositories(store, ctx).settings,
      auditRepoFactory: async (ctx) => createMemoryRepositories(store, ctx).audit,
    };
  }

  const validUpdate = {
    name: "Minimarket Sol",
    legal_name: "Sol SRL",
    currency_code: "bob",
    currency_symbol: "Bs",
    logo_url: "https://ejemplo.com/logo.png",
    allow_negative_stock: false,
    cashier_can_discount: true,
    low_stock_default: 3,
  };

  it("el dueño lee la configuración completa; cajero y anónimo no", async () => {
    const ok = await createGetBusinessSettingsAction(makeDeps(owner))();
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data.name).toBe("Mi Minimarket");

    const deniedCashier = await createGetBusinessSettingsAction(makeDeps(cashier))();
    expect(deniedCashier.ok).toBe(false);
    if (!deniedCashier.ok) expect(deniedCashier.code).toBe("FORBIDDEN");

    const deniedAnon = await createGetBusinessSettingsAction(makeDeps(null))();
    expect(deniedAnon.ok).toBe(false);
    if (!deniedAnon.ok) expect(deniedAnon.code).toBe("UNAUTHENTICATED");
  });

  it("el dueño actualiza, normaliza moneda y registra auditoría con los cambios", async () => {
    const result = await createUpdateBusinessSettingsAction(makeDeps(owner))(validUpdate);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.name).toBe("Minimarket Sol");
    expect(result.data.legal_name).toBe("Sol SRL");
    expect(result.data.currency_code).toBe("BOB");
    expect(result.data.logo_url).toBe("https://ejemplo.com/logo.png");
    expect(result.data.cashier_can_discount).toBe(true);
    expect(result.data.low_stock_default).toBe(3);

    const logs = Array.from(store.auditLog.values());
    const entry = logs.find((log) => log.action === "settings.update");
    expect(entry).toBeDefined();
    expect(typeof entry!.summary).toBe("string");
    const summary = JSON.parse(entry!.summary as string) as {
      changed: Record<string, { from: unknown; to: unknown }>;
    };
    expect(summary.changed.name).toEqual({ from: "Mi Minimarket", to: "Minimarket Sol" });
    expect(summary.changed.low_stock_default).toEqual({ from: 5, to: 3 });
    expect(summary.changed.allow_negative_stock).toBeUndefined();
  });

  it("convierte logo y razón social vacíos en null", async () => {
    const result = await createUpdateBusinessSettingsAction(makeDeps(owner))({
      ...validUpdate,
      legal_name: "   ",
      logo_url: "",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.legal_name).toBeNull();
    expect(result.data.logo_url).toBeNull();
  });

  it("el cajero no puede modificar la configuración", async () => {
    const result = await createUpdateBusinessSettingsAction(makeDeps(cashier))(validUpdate);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN");
    expect(store.auditLog.size).toBe(0);
  });

  it("rechaza datos inválidos y claves extra (strict)", async () => {
    const action = createUpdateBusinessSettingsAction(makeDeps(owner));

    const shortName = await action({ ...validUpdate, name: "A" });
    expect(shortName.ok).toBe(false);

    const badCurrency = await action({ ...validUpdate, currency_code: "BOBOL" });
    expect(badCurrency.ok).toBe(false);

    const badLogo = await action({ ...validUpdate, logo_url: "javascript:alert(1)" });
    expect(badLogo.ok).toBe(false);

    const badThreshold = await action({ ...validUpdate, low_stock_default: -1 });
    expect(badThreshold.ok).toBe(false);

    const extraKey = await action({ ...validUpdate, role: "owner" } as never);
    expect(extraKey.ok).toBe(false);
  });
});
