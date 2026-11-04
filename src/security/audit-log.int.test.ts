import { beforeEach, describe, expect, it } from "vitest";
import { createListAuditLogAction } from "@/lib/actions/audit-core";
import type { AuthenticatedUser } from "@/lib/actions/secure-action";
import { createUpdateProductAction } from "@/lib/actions/products-core";
import { createUpdateBusinessSettingsAction } from "@/lib/actions/settings-core";
import { createUpdateUserRoleAction } from "@/lib/actions/users-core";
import { createMemoryRepositories, MemoryStore, type UserContext } from "@/lib/repos";
import { buildBusinessSettings, buildProfile } from "@/test/factories";

const owner: AuthenticatedUser = {
  id: "owner-1",
  name: "Ana Quispe",
  role: "owner",
  isActive: true,
};

const cashier: AuthenticatedUser = {
  id: "cashier-1",
  name: "Carlos Mamani",
  role: "cashier",
  isActive: true,
};

describe("Bitácora de auditoría (E11-08)", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
    store.profiles.set("owner-1", buildProfile({ id: "owner-1", full_name: "Ana Quispe", role: "owner" }));
    store.profiles.set(
      "cashier-1",
      buildProfile({ id: "cashier-1", full_name: "Carlos Mamani", role: "cashier" }),
    );
  });

  function repos(user: UserContext) {
    return createMemoryRepositories(store, user);
  }

  const ownerContext: UserContext = { id: "owner-1", role: "owner", active: true };

  function auditEntries() {
    return Array.from(store.auditLog.values());
  }

  it("products.update deja auditoría con los cambios de precio y costo", async () => {
    const product = await repos(ownerContext).products.create({
      name: "Arroz 1kg",
      price_cents: 1500,
      cost_cents: 1000,
      stock_qty: 10,
    });

    const action = createUpdateProductAction({
      currentUserResolver: async () => owner,
      productsRepoFactory: async (ctx) => repos(ctx).products,
      auditRepoFactory: async (ctx) => repos(ctx).audit,
      settingsRepoFactory: async (ctx) => repos(ctx).settings,
    });
    const result = await action({
      id: product.id,
      priceCents: 1800,
      costCents: 1100,
    });
    expect(result.ok).toBe(true);

    const entry = auditEntries().find((log) => log.action === "products.update");
    expect(entry).toBeDefined();
    expect(entry?.entity).toBe("products");
    expect(entry?.entity_id).toBe(product.id);
    expect(entry?.user_id).toBe("owner-1");
    const summary = JSON.parse(entry!.summary as string) as {
      changed: string[];
      priceCents: number;
    };
    expect(summary.changed).toEqual(["priceCents", "costCents"]);
    expect(summary.priceCents).toBe(1800);
  });

  it("settings.update deja auditoría con los campos cambiados", async () => {
    const initial = buildBusinessSettings();
    const action = createUpdateBusinessSettingsAction({
      currentUserResolver: async () => owner,
      settingsRepoFactory: async (ctx) => repos(ctx).settings,
      auditRepoFactory: async (ctx) => repos(ctx).audit,
    });
    const result = await action({
      name: "Otro Minimarket",
      legal_name: initial.legal_name,
      currency_code: "BOB",
      currency_symbol: "Bs",
      allow_negative_stock: initial.allow_negative_stock,
      cashier_can_discount: initial.cashier_can_discount,
      cashier_max_discount_cents: initial.cashier_max_discount_cents,
      low_stock_default: initial.low_stock_default,
    });
    expect(result.ok).toBe(true);

    const entry = auditEntries().find((log) => log.action === "settings.update");
    expect(entry).toBeDefined();
    expect(entry?.entity).toBe("business_settings");
    const summary = JSON.parse(entry!.summary as string) as {
      changed: Record<string, { from: unknown; to: unknown }>;
    };
    expect(summary.changed.name).toEqual({ from: "Mi Minimarket", to: "Otro Minimarket" });
  });

  it("users.update_role deja auditoría con el nuevo rol", async () => {
    const action = createUpdateUserRoleAction({
      currentUserResolver: async () => owner,
      usersRepoFactory: async (ctx) => repos(ctx).users,
      auditRepoFactory: async (ctx) => repos(ctx).audit,
    });
    const result = await action({ id: "cashier-1", role: "owner" });
    expect(result.ok).toBe(true);

    const entry = auditEntries().find((log) => log.action === "users.update_role");
    expect(entry).toBeDefined();
    expect(entry?.entity).toBe("profiles");
    expect(entry?.entity_id).toBe("cashier-1");
    const summary = JSON.parse(entry!.summary as string) as { newRole: string };
    expect(summary.newRole).toBe("owner");
    expect(entry?.reason).toBe("Cambio de rol por propietario");
  });

  it("la acción de listado de la bitácora está reservada al dueño", async () => {
    const denied = await createListAuditLogAction({
      currentUserResolver: async () => cashier,
      auditRepoFactory: async (ctx) => repos(ctx).audit,
      usersRepoFactory: async (ctx) => repos(ctx).users,
    })();
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("FORBIDDEN");

    const anonymous = await createListAuditLogAction({
      currentUserResolver: async () => null,
      auditRepoFactory: async (ctx) => repos(ctx).audit,
      usersRepoFactory: async (ctx) => repos(ctx).users,
    })();
    expect(anonymous.ok).toBe(false);
    if (!anonymous.ok) expect(anonymous.code).toBe("UNAUTHENTICATED");
  });

  it("la anulación escrita por la RPC (sales.void) se lee desde la vista del dueño", async () => {
    await repos(ownerContext).audit.write({
      action: "sales.void",
      entity: "sales",
      entityId: "sale-1",
      summary: { reason: "Cobro equivocado" },
    });

    const result = await createListAuditLogAction({
      currentUserResolver: async () => owner,
      auditRepoFactory: async (ctx) => repos(ctx).audit,
      usersRepoFactory: async (ctx) => repos(ctx).users,
    })();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.action).toBe("sales.void");
    expect(result.data[0]?.summary).toEqual({ reason: "Cobro equivocado" });
  });

  describe("reglas del repositorio de memoria (espejo de RLS owner-only)", () => {
    it("solo el dueño puede leer la bitácora", async () => {
      await expect(repos(ownerContext).audit.list()).resolves.toBeInstanceOf(Array);
      await expect(
        repos({ id: "cashier-1", role: "cashier", active: true }).audit.list(),
      ).rejects.toThrow(/propietario/);
    });

    it("rechaza escrituras de usuarios inactivos", async () => {
      const inactive = createMemoryRepositories(
        store,
        { id: "cashier-1", role: "cashier", active: false },
      ).audit;
      await expect(
        inactive.write({ action: "sales.void", entity: "sales" }),
      ).rejects.toThrow();
    });

    it("rechaza escrituras sin acción o sin entidad", async () => {
      const audit = repos(ownerContext).audit;
      await expect(audit.write({ action: "   ", entity: "sales" })).rejects.toThrow();
      await expect(audit.write({ action: "sales.void", entity: "  " })).rejects.toThrow();
    });
  });
});
