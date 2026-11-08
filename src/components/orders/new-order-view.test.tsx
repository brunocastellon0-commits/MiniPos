import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCategory, buildProduct } from "@/test/factories";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/actions/orders", () => ({
  createOrderAction: vi.fn(),
}));

vi.mock("@/lib/actions/products-search", () => ({
  searchPosProductsAction: vi.fn(),
  listPosProductsAction: vi.fn(),
  getProductsByIdsAction: vi.fn(),
}));

import { createOrderAction } from "@/lib/actions/orders";
import { NewOrderView } from "./new-order-view";

const arroz = buildProduct({
  id: "p-1",
  name: "Arroz 1kg",
  price_cents: 1500,
  stock_qty: 10,
});

const leche = buildProduct({
  id: "p-2",
  name: "Leche 1L",
  price_cents: 800,
  stock_qty: 5,
});

const categoria = buildCategory({ id: "cat-1", name: "Granos" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createOrderAction).mockResolvedValue({
    ok: true,
    code: "OK",
    message: "",
    data: {
      order: { id: "order-9" },
      items: [],
      saleId: null,
    },
  } as never);
});

function renderNewOrder(chargeTiming: "on_order" | "on_consumption") {
  return render(
    <NewOrderView
      initialProducts={[arroz, leche]}
      categories={[categoria]}
      chargeTiming={chargeTiming}
    />,
  );
}

function addProduct(name: string) {
  let node: Element | null = screen.getByText(name);
  while (node && !(node as HTMLElement).querySelector("button")) {
    node = node.parentElement;
  }
  const button = (node as HTMLElement | null)?.querySelector("button");
  if (!button) throw new Error(`Tarjeta no encontrada: ${name}`);
  fireEvent.click(button);
}

describe("NewOrderView (creación de pedidos)", () => {
  it("muestra catálogo, panel de pedido vacío y total en cero", () => {
    renderNewOrder("on_consumption");

    expect(screen.getByText("Arroz 1kg")).toBeInTheDocument();
    expect(screen.getByText("Pedido vacío")).toBeInTheDocument();
    expect(screen.getByTestId("create-order-button")).toBeDisabled();
    expect(screen.getByText("Bs 0,00")).toBeInTheDocument();
  });

  it("agrega productos, muestra el total y crea el pedido en on_consumption", async () => {
    renderNewOrder("on_consumption");

    addProduct("Arroz 1kg");
    expect(screen.getByLabelText("Cantidad de Arroz 1kg")).toHaveTextContent("1");
    expect(screen.getAllByText("Bs 15,00").length).toBeGreaterThanOrEqual(2);

    fireEvent.change(screen.getByLabelText("Notas del pedido"), {
      target: { value: "Sin cebolla" },
    });
    fireEvent.click(screen.getByTestId("create-order-button"));

    await waitFor(() =>
      expect(createOrderAction).toHaveBeenCalledWith({
        items: [{ productId: "p-1", quantity: 1 }],
        notes: "Sin cebolla",
        paymentMethod: undefined,
        cashReceivedCents: undefined,
        clientRequestId: undefined,
      }),
    );
    expect(push).toHaveBeenCalledWith("/caja/pedido/order-9");
    expect(refresh).toHaveBeenCalled();
  });

  it("en on_order pide el método de pago antes de crear", async () => {
    renderNewOrder("on_order");

    addProduct("Arroz 1kg");
    fireEvent.click(screen.getByTestId("create-order-button"));

    expect(screen.getByRole("dialog", { name: /Cobrar pedido/ })).toBeInTheDocument();
    expect(createOrderAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "QR" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cobro" }));

    await waitFor(() =>
      expect(createOrderAction).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ productId: "p-1", quantity: 1 }],
          paymentMethod: "qr",
        }),
      ),
    );
  });

  it("en on_order valida que el efectivo cubra el total", async () => {
    renderNewOrder("on_order");

    addProduct("Arroz 1kg");
    fireEvent.click(screen.getByTestId("create-order-button"));
    fireEvent.change(screen.getByLabelText("Efectivo recibido"), {
      target: { value: "5" },
    });
    const button = screen.getByRole("button", { name: "Confirmar cobro" });
    const form = (button as HTMLButtonElement).form ?? document.getElementById("payment-method-form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El efectivo recibido debe cubrir el total.",
    );
    expect(createOrderAction).not.toHaveBeenCalled();
  });

  it("muestra el error del servidor sin perder los productos", async () => {
    vi.mocked(createOrderAction).mockResolvedValue({
      ok: false,
      code: "BAD_REQUEST",
      message: "No hay turno de caja abierto.",
    });
    renderNewOrder("on_consumption");

    addProduct("Arroz 1kg");
    fireEvent.click(screen.getByTestId("create-order-button"));

    expect(await screen.findByTestId("create-order-error")).toHaveTextContent(
      "No hay turno de caja abierto.",
    );
    expect(screen.getAllByText("Arroz 1kg").length).toBeGreaterThanOrEqual(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("filtra el catálogo por búsqueda y muestra estado sin resultados", () => {
    renderNewOrder("on_consumption");

    fireEvent.change(screen.getByLabelText("Buscar productos"), {
      target: { value: "zzz" },
    });

    expect(screen.queryByText("Arroz 1kg")).not.toBeInTheDocument();
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar productos"), {
      target: { value: "Arroz" },
    });
    expect(screen.getByText("Arroz 1kg")).toBeInTheDocument();
  });

  it("muestra el texto del momento de cobro según la modalidad", () => {
    const { unmount } = renderNewOrder("on_order");
    expect(screen.getByText("Crear pedido y cobrar")).toBeInTheDocument();
    expect(screen.getByText(/El cobro y el stock se registran al crear el pedido./)).toBeInTheDocument();
    unmount();

    renderNewOrder("on_consumption");
    expect(screen.getByText("Crear pedido")).toBeInTheDocument();
    expect(screen.getByText(/El cobro se registra al finalizar el consumo./)).toBeInTheDocument();
  });
});
