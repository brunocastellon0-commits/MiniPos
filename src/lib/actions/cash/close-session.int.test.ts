import { describe, expect, it } from "vitest";
import { buildSale } from "@/test/factories";
import {
  createAddCashMovementAction,
  createCloseCashSessionAction,
  createGetCashOverviewAction,
  createListCashSessionsAction,
  createOpenCashSessionAction,
} from "../cash-core";
import {
  cashierUser,
  createCashTestEnv,
  otherCashierUser,
  ownerUser,
} from "./test-env";

async function openCash(
  deps: ReturnType<typeof createCashTestEnv>["deps"],
  openingCents = 10000,
  opener = cashierUser,
) {
  const result = await createOpenCashSessionAction(deps(opener))({ openingCents });
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

describe("Cierre de turno (E3-04)", () => {
  it("calcula esperado por método, registra la diferencia y no autoajusta", async () => {
    const { deps, store } = createCashTestEnv();
    const session = await openCash(deps);

    await createAddCashMovementAction(deps(cashierUser))({
      sessionId: session.id,
      kind: "in",
      amountCents: 2000,
      reason: "Cambio",
    });
    await createAddCashMovementAction(deps(cashierUser))({
      sessionId: session.id,
      kind: "out",
      amountCents: 1000,
      reason: "Pago proveedor",
    });

    store.sales.set(
      "sale-cash",
      buildSale({
        id: "sale-cash",
        session_id: session.id,
        payment_method: "cash",
        total_cents: 3000,
      }),
    );
    store.sales.set(
      "sale-qr",
      buildSale({
        id: "sale-qr",
        session_id: session.id,
        payment_method: "qr",
        total_cents: 5000,
      }),
    );

    const result = await createCloseCashSessionAction(deps(otherCashierUser))({
      sessionId: session.id,
      countedCents: 14500,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("closed");
      expect(result.data.expected_cash_cents).toBe(14000);
      expect(result.data.counted_cash_cents).toBe(14500);
      expect(result.data.difference_cents).toBe(500);
      expect(result.data.closed_by).toBe(otherCashierUser.id);
    }

    const overview = await createGetCashOverviewAction(deps(cashierUser))();
    expect(overview.ok).toBe(true);
    if (overview.ok) expect(overview.data).toBeNull();
  });

  it("muestra faltante cuando lo contado es menor al esperado", async () => {
    const { deps } = createCashTestEnv();
    const session = await openCash(deps);

    const result = await createCloseCashSessionAction(deps(cashierUser))({
      sessionId: session.id,
      countedCents: 9000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.difference_cents).toBe(-1000);
  });

  it("impide cerrar dos veces y agregar movimientos después del cierre", async () => {
    const { deps } = createCashTestEnv();
    const session = await openCash(deps);
    const close = createCloseCashSessionAction(deps(cashierUser));

    expect((await close({ sessionId: session.id, countedCents: 10000 })).ok).toBe(true);
    const second = await close({ sessionId: session.id, countedCents: 10000 });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("BAD_REQUEST");

    const movement = await createAddCashMovementAction(deps(cashierUser))({
      sessionId: session.id,
      kind: "in",
      amountCents: 1000,
      reason: "Tarde",
    });
    expect(movement.ok).toBe(false);
  });

  it("valida el efectivo contado", async () => {
    const { deps } = createCashTestEnv();
    const session = await openCash(deps);

    const result = await createCloseCashSessionAction(deps(cashierUser))({
      sessionId: session.id,
      countedCents: -1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_ERROR");
  });
});

describe("Historial de turnos (E3-05)", () => {
  it("el dueño ve todos los turnos y el cajero solo los suyos", async () => {
    const { deps } = createCashTestEnv();

    const cashierSession = await openCash(deps);
    await createCloseCashSessionAction(deps(cashierUser))({
      sessionId: cashierSession.id,
      countedCents: 10000,
    });

    const ownerSession = await openCash(deps, 5000, ownerUser);
    await createCloseCashSessionAction(deps(ownerUser))({
      sessionId: ownerSession.id,
      countedCents: 5000,
    });

    const ownerHistory = await createListCashSessionsAction(deps(ownerUser))();
    expect(ownerHistory.ok).toBe(true);
    if (ownerHistory.ok) expect(ownerHistory.data).toHaveLength(2);

    const cashierHistory = await createListCashSessionsAction(deps(cashierUser))();
    expect(cashierHistory.ok).toBe(true);
    if (cashierHistory.ok) {
      expect(cashierHistory.data).toHaveLength(1);
      expect(cashierHistory.data[0]?.id).toBe(cashierSession.id);
    }
  });
});
