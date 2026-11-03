import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { receivePurchaseAction } from "@/lib/actions/purchases";
import { buildPurchase, buildPurchaseItem } from "@/test/factories";
import { PurchaseReceiveView } from "./purchase-receive-view";

const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
  usePathname: () => "/compras/pur-1",
}));

vi.mock("@/lib/actions/purchases", () => ({
  receivePurchaseAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const purchase = buildPurchase({
  id: "pur-1",
  supplier_id: "sup-1",
  status: "ordered",
  total_cents: 14000,
});

const items = [
  buildPurchaseItem({
    id: "it-1",
    purchase_id: "pur-1",
    product_id: "p-arroz",
    qty_ordered: 10,
    qty_received: 4,
    unit_cost_cents: 950,
  }),
  buildPurchaseItem({
    id: "it-2",
    purchase_id: "pur-1",
    product_id: "p-leche",
    qty_ordered: 5,
    qty_received: 0,
    unit_cost_cents: 500,
  }),
];

const productNames = { "p-arroz": "Arroz 1kg", "p-leche": "Leche 1L" };

function renderView(overrides: Partial<Parameters<typeof PurchaseReceiveView>[0]> = {}) {
  return render(
    <PurchaseReceiveView purchase={purchase} items={items} productNames={productNames} {...overrides} />,
  );
}

describe("PurchaseReceiveView (E7-03)", () => {
  it("precarga lo ya recibido y confirma la recepción con cantidades enteras", async () => {
    vi.mocked(receivePurchaseAction).mockResolvedValue({
      ok: true,
      data: { purchase: { ...purchase, status: "partial" }, items: [] },
    });
    const { container } = renderView();

    expect(screen.getByLabelText("Cantidad recibida de Arroz 1kg")).toHaveValue(4);
    expect(screen.getByLabelText("Cantidad recibida de Leche 1L")).toHaveValue(0);

    fireEvent.change(screen.getByLabelText("Cantidad recibida de Arroz 1kg"), {
      target: { value: "6" },
    });
    fireEvent.submit(container.querySelector("#receive-purchase-form")!);

    await waitFor(() =>
      expect(receivePurchaseAction).toHaveBeenCalledWith({
        purchaseId: "pur-1",
        items: [
          { productId: "p-arroz", qtyReceived: 6 },
          { productId: "p-leche", qtyReceived: 0 },
        ],
        updateCost: false,
      }),
    );
    expect(refreshMock).toHaveBeenCalled();
    expect(await screen.findByText("Recepción registrada")).toBeInTheDocument();
  });

  it("envía updateCost cuando la casilla está marcada", async () => {
    vi.mocked(receivePurchaseAction).mockResolvedValue({
      ok: true,
      data: { purchase: { ...purchase, status: "received" }, items: [] },
    });
    const { container } = renderView();

    fireEvent.click(screen.getByLabelText(/actualizar el costo/i));
    fireEvent.submit(container.querySelector("#receive-purchase-form")!);

    await waitFor(() =>
      expect(receivePurchaseAction).toHaveBeenCalledWith(
        expect.objectContaining({ updateCost: true }),
      ),
    );
  });

  it("bloquea recibir más de lo ordenado sin llamar al servidor", () => {
    const { container } = renderView();

    fireEvent.change(screen.getByLabelText("Cantidad recibida de Arroz 1kg"), {
      target: { value: "11" },
    });
    fireEvent.submit(container.querySelector("#receive-purchase-form")!);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /no puede superar la ordenada \(10\)/i,
    );
    expect(receivePurchaseAction).not.toHaveBeenCalled();
  });

  it("en compra recibida no permite recibir de nuevo", () => {
    renderView({ purchase: { ...purchase, status: "received" } });

    expect(screen.queryByRole("button", { name: "Confirmar recepción" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad recibida de Arroz 1kg")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Esta compra ya fue recibida en su totalidad.",
    );
  });

  it("muestra el error del servidor", async () => {
    vi.mocked(receivePurchaseAction).mockResolvedValue({
      ok: false,
      code: "BAD_REQUEST",
      message: "La compra está cancelada.",
    });
    const { container } = renderView();

    fireEvent.submit(container.querySelector("#receive-purchase-form")!);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("La compra está cancelada."),
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
