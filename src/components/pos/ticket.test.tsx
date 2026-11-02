import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSale, buildSaleItem } from "@/test/factories";

vi.mock("@/lib/actions/sales", () => ({
  getSaleTicketAction: vi.fn(),
}));

import { getSaleTicketAction } from "@/lib/actions/sales";
import { TicketDialog } from "./ticket";

const sale = buildSale({
  id: "sale-1",
  number: 101,
  payment_method: "cash",
  subtotal_cents: 3000,
  total_cents: 3000,
  cash_received_cents: 5000,
});

const ticket = {
  sale,
  items: [buildSaleItem({ sale_id: "sale-1", name_snapshot: "Arroz 1kg", quantity: 2, line_total_cents: 3000 })],
  business: {
    name: "Minimarket Demo",
    legal_name: "Demo SRL",
    currency_code: "BOB",
    currency_symbol: "Bs",
    logo_url: null,
    allow_negative_stock: false,
    low_stock_default: 5,
  },
};

describe("TicketDialog (E4-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el comprobante con datos del negocio, ítems y vuelto", async () => {
    vi.mocked(getSaleTicketAction).mockResolvedValue({ ok: true, data: ticket });

    render(<TicketDialog saleId="sale-1" onClose={() => {}} />);

    expect(await screen.findByText("Minimarket Demo")).toBeInTheDocument();
    expect(screen.getByText("Venta N.º")).toBeInTheDocument();
    expect(screen.getByText("101")).toBeInTheDocument();
    expect(screen.getByText("Arroz 1kg")).toBeInTheDocument();
    expect(screen.getAllByText("Bs 30,00").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Vuelto")).toBeInTheDocument();
    expect(screen.getByText("Bs 20,00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /imprimir/i })).toBeInTheDocument();
    expect(getSaleTicketAction).toHaveBeenCalledWith({ saleId: "sale-1" });
  });

  it("muestra error si no se puede cargar el comprobante", async () => {
    vi.mocked(getSaleTicketAction).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Venta no encontrada.",
    });

    render(<TicketDialog saleId="sale-x" onClose={() => {}} />);

    expect(await screen.findByText("Venta no encontrada.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /imprimir/i })).toBeDisabled();
  });

  it("llama a window.print al presionar Imprimir", async () => {
    vi.mocked(getSaleTicketAction).mockResolvedValue({ ok: true, data: ticket });
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(<TicketDialog saleId="sale-1" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /imprimir/i }));

    await waitFor(() => {
      expect(printSpy).toHaveBeenCalledTimes(1);
    });
    printSpy.mockRestore();
  });
});
