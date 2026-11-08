import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildOrder, buildOrderItem } from "@/test/factories";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

vi.mock("@/lib/actions/orders", () => ({
  chargeOrderAction: vi.fn(),
  updateOrderStatusAction: vi.fn(),
}));

import { chargeOrderAction, updateOrderStatusAction } from "@/lib/actions/orders";
import { OrderDetail } from "./order-detail";

const pendingOrder = buildOrder({
  id: "order-1",
  order_number: 12,
  status: "pendiente",
  payment_status: "pendiente",
  subtotal_cents: 3000,
  total_cents: 3000,
  notes: "Sin cebolla",
});

const items = [
  buildOrderItem({
    order_id: "order-1",
    name_snapshot: "Arroz 1kg",
    quantity: 2,
    unit_price_cents: 1500,
    line_total_cents: 3000,
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updateOrderStatusAction).mockResolvedValue({
    ok: true,
    data: { ...pendingOrder, status: "en_preparacion" },
  } as never);
  vi.mocked(chargeOrderAction).mockResolvedValue({
    ok: true,
    data: { saleId: "sale-1", order: { ...pendingOrder, payment_status: "pagado" } },
  } as never);
});

function renderDetail(overrides: Partial<Parameters<typeof OrderDetail>[0]> = {}) {
  return render(
    <OrderDetail
      order={pendingOrder}
      items={items}
      createdByName="Carlos Mamani"
      {...overrides}
    />,
  );
}

describe("OrderDetail (detalle de pedido)", () => {
  it("muestra datos, productos, total y flujo de estados", () => {
    renderDetail();

    expect(screen.getByRole("heading", { name: "Pedido #12" })).toBeInTheDocument();
    expect(screen.getByText("Carlos Mamani")).toBeInTheDocument();
    expect(screen.getByText("Sin cebolla")).toBeInTheDocument();
    expect(screen.getByText("Arroz 1kg")).toBeInTheDocument();
    expect(screen.getAllByText("Bs 30,00").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("flow-step-pendiente")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Volver a pedidos")).toHaveAttribute("href", "/caja");
  });

  it("avanza al siguiente estado desde el tablero de detalle", async () => {
    renderDetail();

    fireEvent.click(screen.getByTestId("advance-order-button"));

    await waitFor(() =>
      expect(updateOrderStatusAction).toHaveBeenCalledWith({
        orderId: "order-1",
        status: "en_preparacion",
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("cancela el pedido con motivo opcional", async () => {
    renderDetail();

    fireEvent.click(screen.getByTestId("cancel-order-button"));
    expect(screen.getByRole("dialog", { name: "Cancelar pedido" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Motivo (opcional)"), {
      target: { value: "Cliente se retiró" },
    });
    fireEvent.click(screen.getByTestId("confirm-cancel-order"));

    await waitFor(() =>
      expect(updateOrderStatusAction).toHaveBeenCalledWith({
        orderId: "order-1",
        status: "cancelado",
        reason: "Cliente se retiró",
      }),
    );
  });

  it("cobra el pedido con QR desde el diálogo de pago", async () => {
    renderDetail();

    fireEvent.click(screen.getByTestId("charge-order-button"));
    expect(screen.getByRole("dialog", { name: /Cobrar pedido/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "QR" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cobro" }));

    await waitFor(() =>
      expect(chargeOrderAction).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          paymentMethod: "qr",
          clientRequestId: expect.any(String),
        }),
      ),
    );
  });

  it("muestra las acciones de error del servidor", async () => {
    vi.mocked(updateOrderStatusAction).mockResolvedValue({
      ok: false,
      code: "BAD_REQUEST",
      message: "Ese cambio de estado no está permitido para este pedido.",
    });
    renderDetail();

    fireEvent.click(screen.getByTestId("advance-order-button"));

    expect(await screen.findByTestId("order-action-error")).toHaveTextContent(
      "Ese cambio de estado no está permitido para este pedido.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("un pedido cobrado muestra confirmación y oculta acciones", () => {
    const paid = buildOrder({
      id: "order-2",
      order_number: 13,
      status: "entregado",
      payment_status: "pagado",
      sale_id: "sale-99",
      total_cents: 4500,
    });

    renderDetail({ order: paid });

    expect(screen.getByTestId("order-paid")).toHaveTextContent("Pedido cobrado");
    expect(screen.getByRole("link", { name: "Ver venta registrada" })).toHaveAttribute(
      "href",
      "/ventas/sale-99",
    );
    expect(screen.queryByTestId("advance-order-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("charge-order-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-order-button")).not.toBeInTheDocument();
  });

  it("un pedido cancelado muestra el aviso y oculta acciones", () => {
    const cancelled = buildOrder({
      id: "order-3",
      order_number: 14,
      status: "cancelado",
      payment_status: "pendiente",
    });

    renderDetail({ order: cancelled });

    expect(screen.getByText("Pedido cancelado")).toBeInTheDocument();
    expect(screen.queryByTestId("advance-order-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("charge-order-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-order-button")).not.toBeInTheDocument();
  });

  it("el pedido en preparación ofrece marcar listo", () => {
    const preparing = buildOrder({
      id: "order-4",
      order_number: 15,
      status: "en_preparacion",
    });

    renderDetail({ order: preparing });

    expect(screen.getByTestId("advance-order-button")).toHaveTextContent("Marcar listo");
    expect(screen.getByTestId("flow-step-en_preparacion")).toHaveAttribute(
      "aria-current",
      "step",
    );
  });
});
