import { canDemoteOrDeactivateOwner } from "../../domain/users";
import type { UsersRepo, Profile, ProfileUpdate, UserContext } from "../types";
import type { MemoryStore } from "./memory-store";

export class MemoryUsersRepo implements UsersRepo {
  constructor(
    private store: MemoryStore,
    private user: UserContext,
  ) {}

  async getProfile(id: string): Promise<Profile | null> {
    if (this.user.role === "cashier" && this.user.id !== id) {
      return null;
    }
    return this.store.profiles.get(id) ?? null;
  }

  async listProfiles(): Promise<Profile[]> {
    if (this.user.role !== "owner") {
      throw new Error("Acceso denegado: solo el propietario puede listar perfiles.");
    }
    return Array.from(this.store.profiles.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name),
    );
  }

  async updateProfile(id: string, data: ProfileUpdate): Promise<Profile> {
    const existing = this.store.profiles.get(id);
    if (!existing) {
      throw new Error("Perfil no encontrado.");
    }

    if (this.user.role === "cashier") {
      if (this.user.id !== id) {
        throw new Error("No tienes permiso para modificar este perfil.");
      }
      if (data.role && data.role !== "cashier") {
        throw new Error("Escalamiento de privilegios no permitido.");
      }
      if (data.active !== undefined && data.active !== existing.active) {
        throw new Error("No puedes cambiar tu propio estado de activación.");
      }
    }

    // Comprobar invariante: nunca dejar el sistema sin propietarios activos
    const check = canDemoteOrDeactivateOwner(
      Array.from(this.store.profiles.values()),
      id,
      {
        newRole: data.role as "owner" | "cashier" | undefined,
        newActive: data.active,
      },
    );

    if (!check.allowed) {
      throw new Error(check.reason ?? "Operación no permitida en este propietario.");
    }

    const updated: Profile = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };

    this.store.profiles.set(id, updated);
    return updated;
  }
}
