import { describe, expect, it } from "vitest";
import {
  createAddCashMovementAction,
  createCloseCashSessionAction,
  createGetCashOverviewAction,
  createOpenCashSessionAction,
} from "../cash-core";
import { cashierUser, createCashTestEnv, otherCashierUser } from "./test-env";

async function openCash(deps: ReturnType<typeof createCashTestEnv>["deps"]) {
  const result = await createOpenCashSessionAction(deps(cashierUser))({
    openingCents: 10000,
  });
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

describe("Movimientos de efectivo (E3-02)", () => {
  it("registra ingresos y egresos con motivo, usuario y efecto en el esperado", async () => {
    const { deps } = createCashTestEnv();
    const session = await openCash(deps);
    const addMovement = createAddCashMovementAction(deps(otherCashierUser));

    const income = await addMovement({
      sessionId: session.id,
      kind: "in",
      amountCents: 2000,
      reason: "Cambio para caja",
    });
    expect(income.ok).toBe(true);
    if (income.ok) {
      expect(income.data.user_id).toBe(otherCashierUser.id);
      expect(income.data.reason).toBe("Cambio para caja");
    }

    const expense = await addMovement({
      sessionId: session.id,
      kind: "out",
      amountCents: 1000,
      reason: "Pago a proveedor",
    });
    expect(expense.ok).toBe(true);

    const overview = await createGetCashOverviewAction(deps(cashierUser))();
    expect(overview.ok).toBe(true);
    if (overview.ok) {
      expect(overview.data?.expectedCents).toBe(11000);
      expect(overview.data?.movements).toHaveLength(2);
    }
  });

  it("rechaza egresos que superan el efectivo disponible", async () => {
    const { deps } = createCashTestEnv();
    const session = await openCash(deps);

    const result = await createAddCashMovementAction(deps(cashierUser))({
      sessionId: session.id,
      kind: "out",
      amountCents: 10001,
      reason: "Retiro excesivo",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("BAD_REQUEST");
      expect(result.message).toMatch(/supera el efectivo disponible/i);
    }
  });

  it("exige motivo, monto positivo y una sesión abierta", async () => {
    const { deps } = createCashTestEnv();
    const session = await openCash(deps);
    const addMovement = createAddCashMovementAction(deps(cashierUser));

    const noReason = await addMovement({
      sessionId: session.id,
      kind: "in",
      amountCents: 1000,
      reason: "   ",
    });
    expect(noReason.ok).toBe(false);
    if (!noReason.ok) expect(noReason.code).toBe("VALIDATION_ERROR");

    const zero = await addMovement({
      sessionId: session.id,
      kind: "in",
      amountCents: 0,
      reason: "Cambio",
    });
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.code).toBe("VALIDATION_ERROR");

    const missing = await addMovement({
      sessionId: "no-existe",
      kind: "in",
      amountCents: 1000,
      reason: "Cambio",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("BAD_REQUEST");
  });

  it("no permite movimientos en un turno cerrado", async () => {
    const { deps } = createCashTestEnv();
    const session = await openCash(deps);

    const close = await createCloseCashSessionAction(deps(cashierUser))({
      sessionId: session.id,
      countedCents: 10000,
    });
    expect(close.ok).toBe(true);

    const result = await createAddCashMovementAction(deps(cashierUser))({
      sessionId: session.id,
      kind: "in",
      amountCents: 1000,
      reason: "Tarde",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("BAD_REQUEST");
  });
});
