import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CashOverview } from "@/lib/actions/cash-core";
import { buildCashSession, buildProduct, buildSale, buildSaleItem } from "@/test/factories";

vi.mock("@/lib/actions/products-search", () => ({
  searchPosProductsAction: vi.fn(),
  listPosProductsAction: vi.fn(),
}));

vi.mock("@/lib/actions/sales", () => ({
  confirmSaleAction: vi.fn(),
}));

import { searchPosProductsAction } from "@/lib/actions/products-search";
import { confirmSaleAction } from "@/lib/actions/sales";
import { PosClient } from "./pos-client";

const arroz = buildProduct({
  id: "p-1",
  name: "Arroz 1kg",
  price_cents: 1200,
  stock_qty: 10,
  min_stock: 2,
});

const leche = buildProduct({
  id: "p-2",
  name: "Leche 1L",
  price_cents: 800,
  stock_qty: 0,
  min_stock: 2,
});

const overview: CashOverview = {
  session: buildCashSession({ id: "s-1", status: "open", opening_cents: 10000 }),
  openedByName: "María Choque",
  movements: [],
  sales: [],
  payments: { cashCents: 0, qrCents: 0, cardCents: 0, totalCents: 0, count: 0 },
  expectedCents: 10000,
};

function renderPos() {
  return render(
    <PosClient initialProducts={[arroz, leche]} categories={[]} overview={overview} />,
  );
}

function cardOf(productName: string): HTMLElement {
  let node: Element | null = screen.getByText(productName);
  while (node && !within(node as HTMLElement).queryByRole("button", { name: "Agregar" })) {
    node = node.parentElement;
  }
  if (!node) throw new Error(`Tarjeta de producto no encontrada: ${productName}`);
  return node as HTMLElement;
}

function addToCart(productName: string) {
  fireEvent.click(
    within(cardOf(productName)).getByRole("button", { name: "Agregar" }),
  );
}

describe("PosClient (E4-02/E4-03/E4-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("agrega productos al carrito y recalcula total", async () => {
    renderPos();

    addToCart("Arroz 1kg");

    const cart = screen.getByLabelText("Carrito");
    expect(cart).toHaveTextContent("Arroz 1kg");
    expect(cart).toHaveTextContent("Bs 12,00");

    fireEvent.click(screen.getByRole("button", { name: "Agregar unidad de Arroz 1kg" }));

    await waitFor(() => {
      expect(cart).toHaveTextContent("Bs 24,00");
    });
  });

  it("deshabilita Agregar en productos agotados", () => {
    renderPos();

    expect(screen.getByText("Agotado")).toBeInTheDocument();
    const addButton = within(cardOf("Leche 1L")).getByRole("button", { name: "Agregar" });
    expect(addButton).toBeDisabled();
  });

  it("F2 enfoca el buscador y F9 abre el cobro solo con productos", async () => {
    renderPos();

    fireEvent.keyDown(window, { key: "F2" });
    expect(screen.getByLabelText("Buscar productos")).toHaveFocus();

    fireEvent.keyDown(window, { key: "F9" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    addToCart("Arroz 1kg");
    fireEvent.keyDown(window, { key: "F9" });

    expect(await screen.findByRole("dialog")).toHaveTextContent("Cobrar venta");
  });

  it("cobra en efectivo y muestra la confirmación con el vuelto", async () => {
    vi.mocked(confirmSaleAction).mockResolvedValue({
      ok: true,
      data: { sale: buildSale({ id: "sale-1", number: 101, total_cents: 1200 }), items: [buildSaleItem()] },
    });

    renderPos();
    addToCart("Arroz 1kg");
    fireEvent.click(screen.getByRole("button", { name: /cobrar \(f9\)/i }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Efectivo recibido"), {
      target: { value: "20,00" },
    });
    expect(dialog).toHaveTextContent("Vuelto: Bs 8,00");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cobro" }));

    await waitFor(() => {
      expect(confirmSaleAction).toHaveBeenCalledWith({
        sessionId: "s-1",
        paymentMethod: "cash",
        clientRequestId: expect.any(String),
        items: [{ productId: "p-1", quantity: 1 }],
        cashReceivedCents: 2000,
      });
    });

    expect(await screen.findByText("Venta #101 confirmada")).toBeInTheDocument();
    expect(screen.getByText("Bs 8,00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nueva venta" }));
    expect(screen.getByText("Carrito vacío")).toBeInTheDocument();
  });

  it("conserva el carrito y reutiliza el mismo clientRequestId tras un error", async () => {
    vi.mocked(confirmSaleAction)
      .mockResolvedValueOnce({ ok: false, code: "BAD_REQUEST", message: "Stock insuficiente." })
      .mockResolvedValueOnce({
        ok: true,
        data: { sale: buildSale({ id: "sale-2", number: 102, total_cents: 1200 }), items: [buildSaleItem()] },
      });

    renderPos();
    addToCart("Arroz 1kg");
    fireEvent.click(screen.getByRole("button", { name: /cobrar \(f9\)/i }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Efectivo recibido"), {
      target: { value: "20,00" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cobro" }));

    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toHaveTextContent("Stock insuficiente.");
    });
    expect(screen.getByLabelText("Carrito")).toHaveTextContent("Arroz 1kg");

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cobro" }));

    await waitFor(() => {
      expect(confirmSaleAction).toHaveBeenCalledTimes(2);
    });
    const calls = vi.mocked(confirmSaleAction).mock.calls;
    expect(calls).toHaveLength(2);
    const first = calls[0]?.[0];
    const second = calls[1]?.[0];
    expect(first).toBeDefined();
    expect(second?.clientRequestId).toBe(first?.clientRequestId);
  });

  it("Enter con código exacto agrega el producto y mantiene el foco (E4-03)", async () => {
    const arrozConCodigo = buildProduct({
      ...arroz,
      id: "p-1",
      barcode: "777001",
      name: "Arroz 1kg",
      price_cents: 1200,
      stock_qty: 10,
    });
    vi.mocked(searchPosProductsAction).mockResolvedValue({ ok: true, data: [arrozConCodigo] });

    renderPos();
    const input = screen.getByLabelText("Buscar productos");
    fireEvent.change(input, { target: { value: "777001" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByLabelText("Carrito")).toHaveTextContent("Arroz 1kg");
    });
    expect(input).toHaveFocus();
    expect(input).toHaveValue("");
  });

  it("Enter con código inexistente muestra aviso y conserva el foco", async () => {
    vi.mocked(searchPosProductsAction).mockResolvedValue({ ok: true, data: [] });

    renderPos();
    const input = screen.getByLabelText("Buscar productos");
    fireEvent.change(input, { target: { value: "zzz" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("Código no encontrado: zzz")).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("filtra el catálogo al buscar y muestra estado sin resultados", async () => {
    vi.mocked(searchPosProductsAction).mockResolvedValue({ ok: true, data: [arroz] });

    renderPos();
    fireEvent.change(screen.getByLabelText("Buscar productos"), { target: { value: "arroz" } });

    await waitFor(() => {
      expect(searchPosProductsAction).toHaveBeenCalledWith({ query: "arroz", limit: 50 });
    });
    await waitFor(() => {
      expect(screen.queryByText("Leche 1L")).not.toBeInTheDocument();
    });

    vi.mocked(searchPosProductsAction).mockResolvedValue({ ok: true, data: [] });
    fireEvent.change(screen.getByLabelText("Buscar productos"), { target: { value: "zzz" } });

    expect(await screen.findByText("Sin resultados")).toBeInTheDocument();
  });
});
