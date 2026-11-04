import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepositories, MemoryStore, type UserContext } from "@/lib/repos";
import { buildProfile } from "@/test/factories";
import {
  createGetAuditAlertsAction,
  createListAuditLogAction,
} from "./audit-core";
import type { AuthenticatedUser } from "./secure-action";

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

function makeDeps(user: AuthenticatedUser | null, store: MemoryStore) {
  return {
    currentUserResolver: async () => user,
    auditRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).audit,
    usersRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).users,
    cashRepoFactory: async (ctx: UserContext) => createMemoryRepositories(store, ctx).cash,
  };
}

describe("listAuditLogAction (E11-08)", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it("el dueño lista la bitácora con el nombre del actor y el resumen parseado", async () => {
    store.profiles.set(
      "cashier-1",
      buildProfile({ id: "cashier-1", full_name: "Carlos Mamani", role: "cashier" }),
    );
    const cashierRepos = createMemoryRepositories(store, {
      id: "cashier-1",
      role: "cashier",
      active: true,
    });
    await cashierRepos.audit.write({
      action: "products.update",
      entity: "products",
      entityId: "p-1",
      summary: { changed: ["price_cents"], priceCents: 1500 },
      reason: "Edición de producto por propietario",
    });

    const result = await createListAuditLogAction(makeDeps(owner, store))();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    const entry = result.data[0];
    expect(entry?.action).toBe("products.update");
    expect(entry?.userName).toBe("Carlos Mamani");
    expect(entry?.summary).toEqual({ changed: ["price_cents"], priceCents: 1500 });
    expect(entry?.reason).toBe("Edición de producto por propietario");
  });

  it("el cajero no puede listar la bitácora", async () => {
    const result = await createListAuditLogAction(makeDeps(cashier, store))();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN");
  });

  it("sin sesión autenticada la bitácora no está disponible", async () => {
    const result = await createListAuditLogAction(makeDeps(null, store))();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHENTICATED");
  });

  it("devuelve lista vacía cuando aún no hay actividad", async () => {
    const result = await createListAuditLogAction(makeDeps(owner, store))();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });
});

describe("getAuditAlertsAction (E11-08)", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  async function seedRepeatedPatterns() {
    const ownerRepos = createMemoryRepositories(store, {
      id: "owner-1",
      role: "owner",
      active: true,
    });
    for (const saleId of ["s1", "s2", "s3"]) {
      await ownerRepos.audit.write({
        action: "sales.void",
        entity: "sales",
        entityId: saleId,
        summary: {},
        reason: "Anulación",
      });
    }
    for (let i = 0; i < 2; i += 1) {
      const session = await ownerRepos.cash.openSession(10000);
      await ownerRepos.cash.closeSession(session.id, 9900 + i);
    }
  }

  it("el dueño recibe alertas por anulaciones y diferencias repetidas", async () => {
    await seedRepeatedPatterns();

    const result = await createGetAuditAlertsAction(makeDeps(owner, store))();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((alert) => alert.kind)).toEqual(["voids", "cash_difference"]);
    expect(result.data[0]?.count).toBe(3);
    expect(result.data[1]?.count).toBe(2);
  });

  it("no alerta cuando los patrones son aislados", async () => {
    const ownerRepos = createMemoryRepositories(store, {
      id: "owner-1",
      role: "owner",
      active: true,
    });
    await ownerRepos.audit.write({
      action: "sales.void",
      entity: "sales",
      entityId: "s1",
      summary: {},
    });

    const result = await createGetAuditAlertsAction(makeDeps(owner, store))();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it("el cajero no puede consultar las alertas", async () => {
    const result = await createGetAuditAlertsAction(makeDeps(cashier, store))();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN");
  });
});
