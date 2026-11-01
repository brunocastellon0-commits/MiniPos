import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CashOverview } from "@/lib/actions/cash-core";
import { buildCashMovement, buildCashSession, buildSale } from "@/test/factories";

vi.mock("@/lib/actions/cash", () => ({
  getCashOverviewAction: vi.fn(),
  listCashSessionsAction: vi.fn(),
  openCashSessionAction: vi.fn(),
  addCashMovementAction: vi.fn(),
  closeCashSessionAction: vi.fn(),
}));

import {
  addCashMovementAction,
  getCashOverviewAction,
  listCashSessionsAction,
  openCashSessionAction,
} from "@/lib/actions/cash";
import { TurnoClient } from "./turno-client";

const session = buildCashSession({ id: "s-1", status: "open", opening_cents: 10000 });

const overview: CashOverview = {
  session,
  openedByName: "María Choque",
  movements: [
    buildCashMovement({ id: "m-1", session_id: "s-1", kind: "out", amount_cents: 500, reason: "Cambio" }),
  ],
  sales: [buildSale({ session_id: "s-1", payment_method: "cash", total_cents: 2500 })],
  payments: { cashCents: 2500, qrCents: 0, cardCents: 0, totalCents: 2500, count: 1 },
  expectedCents: 12000,
};

describe("TurnoClient (E3-01/E3-02/E3-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCashOverviewAction).mockResolvedValue({ ok: true, data: overview });
    vi.mocked(listCashSessionsAction).mockResolvedValue({ ok: true, data: [session] });
  });

  it("muestra la cabecera del turno abierto, esperado y movimientos", async () => {
    render(
      <TurnoClient initialOverview={overview} initialHistory={[session]} />,
    );

    expect(
      screen.getByText(
        `Caja abierta · desde ${new Intl.DateTimeFormat("es-BO", {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZone: "America/La_Paz",
        }).format(new Date(session.opened_at))} · María Choque`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Bs 120,00")).toBeInTheDocument();
    expect(screen.getByText("Cambio")).toBeInTheDocument();
  });

  it("registra un movimiento y refresca el resumen", async () => {
    vi.mocked(addCashMovementAction).mockResolvedValue({
      ok: true,
      data: buildCashMovement({ id: "m-2" }),
    });

    render(<TurnoClient initialOverview={overview} initialHistory={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /movimiento/i }));

    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "20,00" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Ingreso proveedor" } });
    fireEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(() => {
      expect(addCashMovementAction).toHaveBeenCalledWith({
        sessionId: "s-1",
        kind: "in",
        amountCents: 2000,
        reason: "Ingreso proveedor",
      });
      expect(getCashOverviewAction).toHaveBeenCalled();
    });
  });

  it("ofrece abrir turno cuando no hay caja abierta", async () => {
    vi.mocked(getCashOverviewAction).mockResolvedValue({ ok: true, data: null });
    vi.mocked(openCashSessionAction).mockResolvedValue({
      ok: true,
      data: session,
    });

    render(<TurnoClient initialOverview={null} initialHistory={[]} />);

    expect(screen.getByText("Abrir turno de caja")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/saldo inicial/i), { target: { value: "100,00" } });
    fireEvent.click(screen.getByRole("button", { name: /abrir caja/i }));

    await waitFor(() => {
      expect(openCashSessionAction).toHaveBeenCalledWith({ openingCents: 10000, notes: undefined });
    });
  });
});
