import type { Profile } from "../repos/types";

export interface CanModifyOwnerResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Verifica si es seguro cambiar el rol o desactivar a un usuario propietario.
 * Invariante: Nunca se puede degradar ni desactivar al último dueño activo del sistema.
 */
export function canDemoteOrDeactivateOwner(
  profiles: Array<Pick<Profile, "id" | "role" | "active">>,
  targetUserId: string,
  updates: { newRole?: "owner" | "cashier"; newActive?: boolean },
): CanModifyOwnerResult {
  const target = profiles.find((p) => p.id === targetUserId);
  if (!target) {
    return { allowed: false, reason: "Usuario no encontrado." };
  }

  // Si el usuario no es propietario activo actualmente, no afecta el cupo de dueños activos
  if (target.role !== "owner" || !target.active) {
    return { allowed: true };
  }

  const isDemoting = updates.newRole !== undefined && updates.newRole !== "owner";
  const isDeactivating = updates.newActive !== undefined && updates.newActive === false;

  // Si no se está degradando ni desactivando, se permite
  if (!isDemoting && !isDeactivating) {
    return { allowed: true };
  }

  // Contar cuántos otros propietarios activos existen
  const otherActiveOwners = profiles.filter(
    (p) => p.id !== targetUserId && p.role === "owner" && p.active,
  );

  if (otherActiveOwners.length === 0) {
    return {
      allowed: false,
      reason: "No se puede desactivar ni revocar el rol al único propietario activo del sistema.",
    };
  }

  return { allowed: true };
}
