import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CashOverview } from "@/lib/actions/cash-core";
import { buildCashSession, buildSale, buildSaleItem } from "@/test/factories";

vi.mock("@/lib/actions/sales", () => ({
  confirmSaleAction: vi.fn(),
}));

import { confirmSaleAction } from "@/lib/actions/sales";
import { PaymentDialog } from "./payment-dialog";

const overview: CashOverview = {
  session: buildCashSession({ id: "s-1", status: "open", opening_cents: 10000 }),
  openedByName: "María Choque",
  movements: [],
  sales: [],
  payments: { cashCents: 0, qrCents: 0, cardCents: 0, totalCents: 0, count: 0 },
  expectedCents: 10000,
};

function setup() {
  const onConfirmed = vi.fn();
  const onClose = vi.fn();
  render(
    <PaymentDialog
      open
      overview={overview}
      totalCents={1200}
      discountCents={0}
      items={[{ productId: "p-1", quantity: 1 }]}
      onClose={onClose}
      onConfirmed={onConfirmed}
    />,
  );
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Efectivo recibido"), {
    target: { value: "20,00" },
  });
  const form = document.getElementById("payment-form") as HTMLFormElement;
  return { onConfirmed, form };
}

function submit(form: HTMLFormElement) {
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

describe("PaymentDialog — candado de envío", () => {
  beforeEach(() => {
    vi.mocked(confirmSaleAction).mockReset();
  });

  it("ignora el doble envío mientras el cobro está en curso", async () => {
    type ConfirmResult = Awaited<ReturnType<typeof confirmSaleAction>>;
    let resolveConfirm!: (value: ConfirmResult) => void;
    vi.mocked(confirmSaleAction).mockReturnValue(
      new Promise<ConfirmResult>((resolve) => {
        resolveConfirm = resolve;
      }),
    );

    const { onConfirmed, form } = setup();

    act(() => {
      submit(form);
      submit(form);
    });

    expect(confirmSaleAction).toHaveBeenCalledTimes(1);
    const button = screen.getByRole("button", { name: /procesando pago/i });
    expect(button).toBeDisabled();

    act(() => {
      submit(form);
    });
    expect(confirmSaleAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveConfirm({
        ok: true,
        data: { sale: buildSale({ number: 101 }), items: [buildSaleItem()] },
      });
    });
    const successBanner = await screen.findByRole("status");
    expect(successBanner).toHaveTextContent("Pago completado");
    expect(screen.getByRole("button", { name: "Pago completado" })).toBeDisabled();
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });

  it("permite reintentar después de un error", async () => {
    vi.mocked(confirmSaleAction)
      .mockRejectedValueOnce(new Error("red"))
      .mockResolvedValueOnce({
        ok: true,
        data: { sale: buildSale({ number: 102 }), items: [buildSaleItem()] },
      });

    const { onConfirmed, form } = setup();

    act(() => {
      submit(form);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo confirmar la venta. El carrito se conserva.",
    );

    act(() => {
      submit(form);
    });
    await waitFor(() => expect(confirmSaleAction).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
  });
});
