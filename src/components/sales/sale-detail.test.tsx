import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildSale, buildSaleItem } from "@/test/factories";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/lib/actions/sales", () => ({
  voidSaleAction: vi.fn(),
}));

import { voidSaleAction } from "@/lib/actions/sales";
import { SaleDetail } from "./sale-detail";

const items = [
  buildSaleItem({
    sale_id: "sale-1",
    name_snapshot: "Arroz 1kg",
    unit_price_cents: 1500,
    quantity: 2,
    line_total_cents: 3000,
  }),
];

describe("SaleDetail (E5-01/E5-02)", () => {
  it("muestra la venta pagada con ítems y totales congelados", () => {
    const sale = buildSale({
      id: "sale-1",
      number: 101,
      cashier_id: "cashier-1",
      subtotal_cents: 3000,
      discount_cents: 0,
      total_cents: 3000,
      payment_method: "cash",
      cash_received_cents: 5000,
    });

    render(<SaleDetail sale={sale} items={items} cashierName="Carlos Mamani" />);

    expect(screen.getByText("Venta #101")).toBeInTheDocument();
    expect(screen.getByText("Pagada")).toBeInTheDocument();
    expect(screen.getByText("Carlos Mamani")).toBeInTheDocument();
    expect(screen.getByText("Arroz 1kg")).toBeInTheDocument();
    expect(screen.getByText("Bs 15,00")).toBeInTheDocument();
    expect(screen.getByText("Bs 50,00")).toBeInTheDocument();
    expect(screen.getByText("-Bs 0,00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a ventas" })).toHaveAttribute(
      "href",
      "/ventas",
    );
  });

  it("muestra la venta anulada con motivo y fecha", () => {
    const sale = buildSale({
      id: "sale-2",
      number: 102,
      cashier_id: "owner-1",
      payment_method: "qr",
      status: "voided",
      void_reason: "Error de cobro",
      voided_at: "2026-11-02T14:00:00.000Z",
    });

    render(<SaleDetail sale={sale} items={items} cashierName="Ana Quispe" />);

    expect(screen.getByText("Anulada")).toBeInTheDocument();
    expect(screen.getByText("Venta anulada")).toBeInTheDocument();
    expect(screen.getByText("Motivo: Error de cobro")).toBeInTheDocument();
    expect(screen.getByText(/Anulada el/)).toBeInTheDocument();
  });

  it("solo el dueño ve el botón de anular en una venta pagada", () => {
    const sale = buildSale({ id: "sale-1", number: 101, status: "paid" });

    const { rerender } = render(
      <SaleDetail sale={sale} items={items} cashierName="Carlos Mamani" canVoid />,
    );
    expect(screen.getByRole("button", { name: /Anular venta/ })).toBeInTheDocument();

    rerender(<SaleDetail sale={sale} items={items} cashierName="Carlos Mamani" />);
    expect(screen.queryByRole("button", { name: /Anular venta/ })).not.toBeInTheDocument();

    const voided = buildSale({ id: "sale-3", number: 103, status: "voided" });
    rerender(<SaleDetail sale={voided} items={items} cashierName="Carlos Mamani" canVoid />);
    expect(screen.queryByRole("button", { name: /Anular venta/ })).not.toBeInTheDocument();
  });

  it("el diálogo exige motivo y envía la anulación con el motivo recortado", async () => {
    vi.mocked(voidSaleAction).mockResolvedValue({
      ok: true,
      data: buildSale({ id: "sale-1", status: "voided" }),
    });
    refreshMock.mockClear();

    const sale = buildSale({ id: "sale-1", number: 101, status: "paid" });
    render(<SaleDetail sale={sale} items={items} cashierName="Carlos Mamani" canVoid />);

    fireEvent.click(screen.getByRole("button", { name: /Anular venta/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const form = document.getElementById("void-sale-form");
    expect(form).not.toBeNull();

    // Sin motivo → error, no llama a la acción
    fireEvent.submit(form!);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El motivo de anulación es obligatorio.",
    );
    expect(voidSaleAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Motivo de anulación/), {
      target: { value: "  Error de cobro  " },
    });
    fireEvent.submit(form!);

    await waitFor(() =>
      expect(voidSaleAction).toHaveBeenCalledWith({
        saleId: "sale-1",
        reason: "Error de cobro",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(refreshMock).toHaveBeenCalled();
    expect(screen.getByText("Venta anulada")).toBeInTheDocument();
  });
});
