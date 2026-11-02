import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildSale, buildSaleItem } from "@/test/factories";
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

describe("SaleDetail (E5-01)", () => {
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
});
