import { describe, expect, it } from "vitest";
import { canTransitionOrder, isOrderChargeable, ORDER_STATUSES } from "./orders";

describe("canTransitionOrder", () => {
  it("permite la cadena pendiente → en_preparación → listo → entregado", () => {
    expect(canTransitionOrder("pendiente", "en_preparacion", "pendiente")).toBe(true);
    expect(canTransitionOrder("en_preparacion", "listo", "pendiente")).toBe(true);
    expect(canTransitionOrder("listo", "entregado", "pendiente")).toBe(true);
  });

  it("no permite saltar estados intermedios", () => {
    expect(canTransitionOrder("pendiente", "listo", "pendiente")).toBe(false);
    expect(canTransitionOrder("pendiente", "entregado", "pendiente")).toBe(false);
    expect(canTransitionOrder("en_preparacion", "entregado", "pendiente")).toBe(false);
  });

  it("no permite retroceder de estado", () => {
    expect(canTransitionOrder("listo", "en_preparacion", "pendiente")).toBe(false);
    expect(canTransitionOrder("entregado", "listo", "pendiente")).toBe(false);
    expect(canTransitionOrder("en_preparacion", "pendiente", "pendiente")).toBe(false);
  });

  it("permite cancelar desde cualquier estado previo al cobro", () => {
    for (const status of ORDER_STATUSES) {
      if (status === "cancelado") continue;
      expect(canTransitionOrder(status, "cancelado", "pendiente")).toBe(true);
    }
  });

  it("no permite cancelar un pedido ya cobrado ni reabrir uno cancelado", () => {
    expect(canTransitionOrder("entregado", "cancelado", "pagado")).toBe(false);
    expect(canTransitionOrder("pendiente", "cancelado", "pagado")).toBe(false);
    expect(canTransitionOrder("cancelado", "pendiente", "pendiente")).toBe(false);
    expect(canTransitionOrder("cancelado", "en_preparacion", "pendiente")).toBe(false);
    expect(canTransitionOrder("cancelado", "cancelado", "pendiente")).toBe(false);
  });

  it("no permite ningún cambio de estado después del cobro", () => {
    for (const status of ORDER_STATUSES) {
      for (const target of ORDER_STATUSES) {
        expect(canTransitionOrder(status, target, "pagado")).toBe(false);
      }
    }
  });
});

describe("isOrderChargeable", () => {
  it("permite cobrar un pedido no cancelado sin pagar", () => {
    expect(isOrderChargeable("pendiente", "pendiente")).toBe(true);
    expect(isOrderChargeable("en_preparacion", "pendiente")).toBe(true);
    expect(isOrderChargeable("listo", "pendiente")).toBe(true);
    expect(isOrderChargeable("entregado", "pendiente")).toBe(true);
  });

  it("bloquea el cobro si ya está pagado o cancelado", () => {
    expect(isOrderChargeable("pendiente", "pagado")).toBe(false);
    expect(isOrderChargeable("entregado", "pagado")).toBe(false);
    expect(isOrderChargeable("cancelado", "pendiente")).toBe(false);
    expect(isOrderChargeable("cancelado", "pagado")).toBe(false);
  });
});
