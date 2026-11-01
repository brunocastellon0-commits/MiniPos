import { describe, expect, it } from "vitest";
import {
  createGetCashOverviewAction,
  createGetOpenCashSessionAction,
  createOpenCashSessionAction,
} from "../cash-core";
import { cashierUser, createCashTestEnv, ownerUser } from "./test-env";

describe("Apertura de turno (E3-01)", () => {
  it("abre un turno con saldo inicial y responsable", async () => {
    const { deps } = createCashTestEnv();
    const openSession = createOpenCashSessionAction(deps(cashierUser));

    const result = await openSession({ openingCents: 10000 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("open");
      expect(result.data.opening_cents).toBe(10000);
      expect(result.data.opened_by).toBe(cashierUser.id);
    }
  });

  it("impide abrir una segunda caja abierta", async () => {
    const { deps } = createCashTestEnv();
    await createOpenCashSessionAction(deps(cashierUser))({ openingCents: 10000 });

    const second = await createOpenCashSessionAction(deps(ownerUser))({
      openingCents: 5000,
    });

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("BAD_REQUEST");
      expect(second.message).toMatch(/Ya existe una sesión de caja abierta/i);
    }
  });

  it("valida saldo inicial y exige sesión activa", async () => {
    const { deps } = createCashTestEnv();

    const negative = await createOpenCashSessionAction(deps(cashierUser))({
      openingCents: -1,
    });
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.code).toBe("VALIDATION_ERROR");

    const anon = await createOpenCashSessionAction(deps(null))({ openingCents: 1000 });
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.code).toBe("UNAUTHENTICATED");
  });

  it("expone el estado visible de la caja con hora y responsable", async () => {
    const { deps } = createCashTestEnv();
    await createOpenCashSessionAction(deps(cashierUser))({ openingCents: 10000 });

    const info = await createGetOpenCashSessionAction(deps(ownerUser))();
    expect(info.ok).toBe(true);
    if (info.ok) {
      expect(info.data?.opened_by_name).toBe("Carlos Mamani");
      expect(info.data?.opened_at).toBeTruthy();
    }

    const overview = await createGetCashOverviewAction(deps(ownerUser))();
    expect(overview.ok).toBe(true);
    if (overview.ok) {
      expect(overview.data?.expectedCents).toBe(10000);
      expect(overview.data?.openedByName).toBe("Carlos Mamani");
    }
  });
});
