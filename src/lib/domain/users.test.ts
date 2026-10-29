import { describe, expect, it } from "vitest";
import { canDemoteOrDeactivateOwner } from "./users";

describe("canDemoteOrDeactivateOwner (Reglas de dominio para gestión de propietarios)", () => {
  const singleOwnerList = [
    { id: "owner-1", role: "owner" as const, active: true },
    { id: "cashier-1", role: "cashier" as const, active: true },
  ];

  const multipleOwnersList = [
    { id: "owner-1", role: "owner" as const, active: true },
    { id: "owner-2", role: "owner" as const, active: true },
    { id: "cashier-1", role: "cashier" as const, active: true },
  ];

  it("rechaza degradar al único propietario activo a cajero", () => {
    const result = canDemoteOrDeactivateOwner(singleOwnerList, "owner-1", {
      newRole: "cashier",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("único propietario activo");
  });

  it("rechaza desactivar al único propietario activo", () => {
    const result = canDemoteOrDeactivateOwner(singleOwnerList, "owner-1", {
      newActive: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("único propietario activo");
  });

  it("permite mantener el rol y estado activo del único propietario", () => {
    const result = canDemoteOrDeactivateOwner(singleOwnerList, "owner-1", {
      newRole: "owner",
      newActive: true,
    });
    expect(result.allowed).toBe(true);
  });

  it("permite degradar a un propietario si queda otro propietario activo", () => {
    const result = canDemoteOrDeactivateOwner(multipleOwnersList, "owner-1", {
      newRole: "cashier",
    });
    expect(result.allowed).toBe(true);
  });

  it("permite desactivar a un propietario si queda otro propietario activo", () => {
    const result = canDemoteOrDeactivateOwner(multipleOwnersList, "owner-1", {
      newActive: false,
    });
    expect(result.allowed).toBe(true);
  });

  it("rechaza si el otro propietario está inactivo", () => {
    const listWithInactiveSecondOwner = [
      { id: "owner-1", role: "owner" as const, active: true },
      { id: "owner-2", role: "owner" as const, active: false },
    ];
    const result = canDemoteOrDeactivateOwner(listWithInactiveSecondOwner, "owner-1", {
      newRole: "cashier",
    });
    expect(result.allowed).toBe(false);
  });

  it("permite cualquier cambio en un cajero sin restricciones de cupo de dueño", () => {
    const demoteCashier = canDemoteOrDeactivateOwner(singleOwnerList, "cashier-1", {
      newRole: "cashier",
    });
    expect(demoteCashier.allowed).toBe(true);

    const deactivateCashier = canDemoteOrDeactivateOwner(singleOwnerList, "cashier-1", {
      newActive: false,
    });
    expect(deactivateCashier.allowed).toBe(true);

    const promoteCashier = canDemoteOrDeactivateOwner(singleOwnerList, "cashier-1", {
      newRole: "owner",
    });
    expect(promoteCashier.allowed).toBe(true);
  });

  it("devuelve error si el usuario objetivo no existe", () => {
    const result = canDemoteOrDeactivateOwner(singleOwnerList, "non-existent", {
      newRole: "cashier",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Usuario no encontrado.");
  });
});
