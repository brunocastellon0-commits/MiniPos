import { describe, expect, it } from "vitest";
import { MemoryAuditRepo } from "@/lib/repos/memory/audit";
import { MemoryStore } from "@/lib/repos/memory/memory-store";
import { MemoryUsersRepo } from "@/lib/repos/memory/users";
import type { Profile, UserContext } from "@/lib/repos/types";
import {
  type AuthenticatedUser,
  type UsersActionDeps,
  createListUsersAction,
  createToggleUserActiveAction,
  createUpdateUserNameAction,
  createUpdateUserRoleAction,
} from "./users-core";

describe("Gestión de Usuarios - Server Actions (E1-04)", () => {
  const setupTestEnv = () => {
    const store = new MemoryStore();

    const ownerProfile: Profile = {
      id: "owner-1",
      full_name: "Doña Elena",
      role: "owner",
      active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const cashierProfile: Profile = {
      id: "cashier-1",
      full_name: "Carlos Mamani",
      role: "cashier",
      active: true,
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    };

    store.profiles.set(ownerProfile.id, ownerProfile);
    store.profiles.set(cashierProfile.id, cashierProfile);

    const makeDeps = (user: AuthenticatedUser | null): UsersActionDeps => ({
      currentUserResolver: async () => user,
      usersRepoFactory: async (ctx: UserContext) => new MemoryUsersRepo(store, ctx),
      auditRepoFactory: async (ctx: UserContext) => new MemoryAuditRepo(store, ctx),
    });

    const activeOwnerUser: AuthenticatedUser = {
      id: "owner-1",
      name: "Doña Elena",
      role: "owner",
      isActive: true,
    };

    const activeCashierUser: AuthenticatedUser = {
      id: "cashier-1",
      name: "Carlos Mamani",
      role: "cashier",
      isActive: true,
    };

    return { store, makeDeps, activeOwnerUser, activeCashierUser, ownerProfile, cashierProfile };
  };

  describe("listUsersAction", () => {
    it("permite al propietario listar todos los perfiles", async () => {
      const { makeDeps, activeOwnerUser } = setupTestEnv();
      const listUsers = createListUsersAction(makeDeps(activeOwnerUser));

      const result = await listUsers();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(2);
        expect(result.data.map((p) => p.full_name)).toEqual(["Carlos Mamani", "Doña Elena"]);
      }
    });

    it("deniega el acceso a un cajero", async () => {
      const { makeDeps, activeCashierUser } = setupTestEnv();
      const listUsers = createListUsersAction(makeDeps(activeCashierUser));

      const result = await listUsers();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("updateUserNameAction", () => {
    it("permite al propietario actualizar el nombre de un usuario y registra auditoría", async () => {
      const { makeDeps, activeOwnerUser, store } = setupTestEnv();
      const updateName = createUpdateUserNameAction(makeDeps(activeOwnerUser));

      const result = await updateName({
        id: "cashier-1",
        fullName: "Carlos Mamani Morales",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.full_name).toBe("Carlos Mamani Morales");
      }

      // Verificar persistencia en repo
      const updated = store.profiles.get("cashier-1");
      expect(updated?.full_name).toBe("Carlos Mamani Morales");

      // Verificar log de auditoría
      const logs = Array.from(store.auditLog.values());
      const auditEntry = logs.find((l) => l.action === "users.update_name");
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.entity_id).toBe("cashier-1");
    });

    it("rechaza nombres vacíos o que solo contienen espacios", async () => {
      const { makeDeps, activeOwnerUser } = setupTestEnv();
      const updateName = createUpdateUserNameAction(makeDeps(activeOwnerUser));

      const result = await updateName({
        id: "cashier-1",
        fullName: "   ",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION_ERROR");
      }
    });

    it("deniega el acceso a un cajero para cambiar nombres", async () => {
      const { makeDeps, activeCashierUser } = setupTestEnv();
      const updateName = createUpdateUserNameAction(makeDeps(activeCashierUser));

      const result = await updateName({
        id: "cashier-1",
        fullName: "Nuevo Nombre",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("updateUserRoleAction & Protección de último dueño", () => {
    it("permite ascender a un cajero a propietario", async () => {
      const { makeDeps, activeOwnerUser, store } = setupTestEnv();
      const updateRole = createUpdateUserRoleAction(makeDeps(activeOwnerUser));

      const result = await updateRole({
        id: "cashier-1",
        role: "owner",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.role).toBe("owner");
      }

      expect(store.profiles.get("cashier-1")?.role).toBe("owner");
    });

    it("rechaza degradar al único propietario activo", async () => {
      const { makeDeps, activeOwnerUser, store } = setupTestEnv();
      const updateRole = createUpdateUserRoleAction(makeDeps(activeOwnerUser));

      const result = await updateRole({
        id: "owner-1",
        role: "cashier",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("único propietario activo");
      }

      // No debe haber cambiado
      expect(store.profiles.get("owner-1")?.role).toBe("owner");
    });

    it("permite degradar a un propietario cuando existe otro propietario activo", async () => {
      const { makeDeps, activeOwnerUser, store } = setupTestEnv();
      // Añadir segundo propietario activo
      const secondOwner: Profile = {
        id: "owner-2",
        full_name: "Segundo Dueño",
        role: "owner",
        active: true,
        created_at: "2026-01-03T00:00:00.000Z",
        updated_at: "2026-01-03T00:00:00.000Z",
      };
      store.profiles.set(secondOwner.id, secondOwner);

      const updateRole = createUpdateUserRoleAction(makeDeps(activeOwnerUser));

      const result = await updateRole({
        id: "owner-1",
        role: "cashier",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.role).toBe("cashier");
      }
    });

    it("deniega el acceso a un cajero", async () => {
      const { makeDeps, activeCashierUser } = setupTestEnv();
      const updateRole = createUpdateUserRoleAction(makeDeps(activeCashierUser));

      const result = await updateRole({
        id: "cashier-1",
        role: "owner",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("toggleUserActiveAction", () => {
    it("permite al propietario desactivar a un cajero", async () => {
      const { makeDeps, activeOwnerUser, store } = setupTestEnv();
      const toggleActive = createToggleUserActiveAction(makeDeps(activeOwnerUser));

      const result = await toggleActive({
        id: "cashier-1",
        active: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.active).toBe(false);
      }
      expect(store.profiles.get("cashier-1")?.active).toBe(false);
    });

    it("rechaza desactivar al único propietario activo", async () => {
      const { makeDeps, activeOwnerUser, store } = setupTestEnv();
      const toggleActive = createToggleUserActiveAction(makeDeps(activeOwnerUser));

      const result = await toggleActive({
        id: "owner-1",
        active: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("único propietario activo");
      }
      expect(store.profiles.get("owner-1")?.active).toBe(true);
    });

    it("deniega el acceso a un cajero para desactivar usuarios", async () => {
      const { makeDeps, activeCashierUser } = setupTestEnv();
      const toggleActive = createToggleUserActiveAction(makeDeps(activeCashierUser));

      const result = await toggleActive({
        id: "owner-1",
        active: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("FORBIDDEN");
      }
    });
  });
});
