import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CashOverview } from "@/lib/actions/cash-core";
import { buildCashSession, buildProduct, buildSale, buildSaleItem } from "@/test/factories";

vi.mock("@/lib/actions/products-search", () => ({
  searchPosProductsAction: vi.fn(),
  listPosProductsAction: vi.fn(),
  getProductsByIdsAction: vi.fn(),
}));

vi.mock("@/lib/actions/sales", () => ({
  confirmSaleAction: vi.fn(),
}));

vi.mock("@/lib/actions/held-sales", () => ({
  saveHeldSaleAction: vi.fn(),
  listHeldSalesAction: vi.fn(),
  deleteHeldSaleAction: vi.fn(),
}));

import { searchPosProductsAction, getProductsByIdsAction } from "@/lib/actions/products-search";
import { confirmSaleAction } from "@/lib/actions/sales";
import {
  deleteHeldSaleAction,
  listHeldSalesAction,
  saveHeldSaleAction,
} from "@/lib/actions/held-sales";
import { buildHeldSale } from "@/test/factories";
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

function renderPos(canDiscount = true) {
  return render(
    <PosClient
      initialProducts={[arroz, leche]}
      categories={[]}
      overview={overview}
      canDiscount={canDiscount}
    />,
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

  it("agregar al carrito es local, sin llamadas al servidor (E11-05: <100 ms percibido)", async () => {
    renderPos();

    addToCart("Arroz 1kg");

    expect(screen.getByLabelText("Carrito")).toHaveTextContent("Bs 12,00");
    expect(searchPosProductsAction).not.toHaveBeenCalled();
    expect(getProductsByIdsAction).not.toHaveBeenCalled();
    expect(confirmSaleAction).not.toHaveBeenCalled();
    expect(saveHeldSaleAction).not.toHaveBeenCalled();
  });

  it("resumen inferior del carrito para pantallas chicas con enlace al panel (E11-06)", async () => {
    renderPos();

    const bar = screen.getByRole("region", { name: "Resumen del carrito" });
    expect(bar).toHaveClass("lg:hidden");
    expect(bar).toHaveTextContent("0 productos");
    expect(bar).toHaveTextContent("Bs 0,00");
    expect(screen.getByLabelText("Carrito")).toHaveAttribute("id", "carrito");

    addToCart("Arroz 1kg");
    expect(bar).toHaveTextContent("1 producto");
    expect(bar).toHaveTextContent("Bs 12,00");

    const scrollSpy = vi.fn();
    const originalScroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollSpy;
    try {
      fireEvent.click(screen.getByRole("button", { name: "Ver carrito" }));
      expect(scrollSpy).toHaveBeenCalledTimes(1);
    } finally {
      if (originalScroll) {
        Element.prototype.scrollIntoView = originalScroll;
      } else {
        Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      }
    }
  });

  it("deshabilita Agregar en productos agotados", () => {
    renderPos();

    expect(screen.getByText("Agotado")).toBeInTheDocument();
    const addButton = within(cardOf("Leche 1L")).getByRole("button", { name: "Agregar" });
    expect(addButton).toBeDisabled();
  });

  it("anuncia el total del carrito con aria-live polite (E11-04)", async () => {
    renderPos();
    addToCart("Arroz 1kg");

    const totalLabel = screen.getByText("Total");
    const region = totalLabel.closest("[aria-live='polite']");
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("aria-atomic", "true");
    await waitFor(() => expect(region).toHaveTextContent("Bs 12,00"));
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
        discountCents: 0,
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

  it("pausa la venta con etiqueta, limpia el carrito y avisa (E4-05)", async () => {
    vi.mocked(saveHeldSaleAction).mockResolvedValue({
      ok: true,
      data: buildHeldSale({ id: "h-1", label: "Cliente al cajero" }),
    });

    renderPos();
    addToCart("Arroz 1kg");
    fireEvent.click(screen.getByRole("button", { name: /pausar venta/i }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Etiqueta"), {
      target: { value: "Cliente al cajero" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Pausar" }));

    await waitFor(() => {
      expect(saveHeldSaleAction).toHaveBeenCalledWith({
        label: "Cliente al cajero",
        cart: {
          lines: [{ productId: "p-1", name: "Arroz 1kg", unitPriceCents: 1200, quantity: 1 }],
        },
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Carrito vacío")).toBeInTheDocument();
    });
    expect(screen.getByText("Venta pausada: Cliente al cajero")).toBeInTheDocument();
  });

  it("lista las ventas pausadas, recupera una al carrito y la descarta (E4-05)", async () => {
    const held = buildHeldSale({
      id: "h-1",
      label: "Cliente mesa 1",
      items: [{ productId: "p-1", name: "Arroz 1kg", unitPriceCents: 1200, quantity: 2 }],
    });
    vi.mocked(listHeldSalesAction).mockResolvedValue({ ok: true, data: [held] });
    vi.mocked(deleteHeldSaleAction).mockResolvedValue({ ok: true, data: { id: "h-1" } });
    vi.mocked(getProductsByIdsAction).mockResolvedValue({ ok: true, data: [arroz] });

    renderPos();
    fireEvent.click(screen.getByRole("button", { name: "Pausadas" }));

    expect(await screen.findByText("Cliente mesa 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recuperar" }));

    await waitFor(() => {
      expect(getProductsByIdsAction).toHaveBeenCalledWith({ ids: ["p-1"] });
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Carrito")).toHaveTextContent("Arroz 1kg");
    });
    expect(screen.getByText("Venta \"Cliente mesa 1\" recuperada.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pausadas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Descartar" }));

    await waitFor(() => {
      expect(deleteHeldSaleAction).toHaveBeenCalledWith({ id: "h-1" });
    });
    await waitFor(() => {
      expect(screen.queryByText("Cliente mesa 1")).not.toBeInTheDocument();
    });
  });

  it("avisa si ningún producto de la venta pausada está disponible (E4-05)", async () => {
    const held = buildHeldSale({
      id: "h-2",
      label: "Sin stock",
      items: [{ productId: "p-9", name: "Desaparecido", unitPriceCents: 500, quantity: 1 }],
    });
    vi.mocked(listHeldSalesAction).mockResolvedValue({ ok: true, data: [held] });
    vi.mocked(getProductsByIdsAction).mockResolvedValue({ ok: true, data: [] });

    renderPos();
    fireEvent.click(screen.getByRole("button", { name: "Pausadas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Recuperar" }));

    expect(await screen.findByText("Ningún producto de la venta pausada está disponible.")).toBeInTheDocument();
  });

  it("aplica descuento por monto en el carrito (E4-07)", () => {
    renderPos();
    addToCart("Arroz 1kg");

    fireEvent.click(screen.getByRole("button", { name: "Agregar descuento" }));
    fireEvent.change(screen.getByLabelText("Monto del descuento"), {
      target: { value: "2,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    const cart = screen.getByLabelText("Carrito");
    expect(cart).toHaveTextContent("-Bs 2,00");
    expect(cart).toHaveTextContent("Bs 10,00");
  });

  it("aplica descuento por porcentaje y valida el rango (E4-07)", () => {
    renderPos();
    addToCart("Arroz 1kg");

    fireEvent.click(screen.getByRole("button", { name: "Agregar descuento" }));
    fireEvent.click(screen.getByRole("button", { name: "Porcentaje (%)" }));

    fireEvent.change(screen.getByLabelText("Porcentaje del descuento"), {
      target: { value: "150" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El porcentaje debe estar entre 0 y 100.",
    );

    fireEvent.change(screen.getByLabelText("Porcentaje del descuento"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    const cart = screen.getByLabelText("Carrito");
    expect(cart).toHaveTextContent("-Bs 1,20");
    expect(cart).toHaveTextContent("Bs 10,80");
  });

  it("oculta el control de descuento cuando el rol no tiene permiso (E4-07)", () => {
    renderPos(false);
    addToCart("Arroz 1kg");

    expect(
      screen.queryByRole("button", { name: "Agregar descuento" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Carrito")).toHaveTextContent("-Bs 0,00");
  });

  it("envía el descuento aplicado al confirmar la venta (E4-07)", async () => {
    vi.mocked(confirmSaleAction).mockResolvedValue({
      ok: true,
      data: {
        sale: buildSale({ id: "sale-3", number: 103, total_cents: 1000 }),
        items: [buildSaleItem()],
      },
    });

    renderPos();
    addToCart("Arroz 1kg");
    fireEvent.click(screen.getByRole("button", { name: "Agregar descuento" }));
    fireEvent.change(screen.getByLabelText("Monto del descuento"), {
      target: { value: "2,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    fireEvent.click(screen.getByRole("button", { name: /cobrar \(f9\)/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Total a pagar: Bs 10,00");

    fireEvent.change(within(dialog).getByLabelText("Efectivo recibido"), {
      target: { value: "10,00" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cobro" }));

    await waitFor(() => {
      expect(confirmSaleAction).toHaveBeenCalledWith({
        sessionId: "s-1",
        paymentMethod: "cash",
        clientRequestId: expect.any(String),
        discountCents: 200,
        items: [{ productId: "p-1", quantity: 1 }],
        cashReceivedCents: 1000,
      });
    });
  });
});
