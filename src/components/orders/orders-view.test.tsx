import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildOrder, buildOrderItem } from "@/test/factories";
import { OrdersView } from "./orders-view";

describe("OrdersView (tablero de pedidos)", () => {
  it("muestra las cuatro columnas de estados con sus encabezados", () => {
    render(
      <OrdersView
        orders={[buildOrder({ id: "o-1", order_number: 1, status: "pendiente" })]}
        items={[]}
        cashierNames={{}}
      />,
    );

    expect(screen.getByTestId("orders-column-pendiente")).toBeInTheDocument();
    expect(screen.getByTestId("orders-column-en_preparacion")).toBeInTheDocument();
    expect(screen.getByTestId("orders-column-listo")).toBeInTheDocument();
    expect(screen.getByTestId("orders-column-entregado")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pedidos" })).toBeInTheDocument();
  });

  it("muestra estado vacío con acción para crear el primer pedido", () => {
    render(<OrdersView orders={[]} items={[]} cashierNames={{}} />);

    expect(screen.getByText("No hay pedidos en este turno")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /Nuevo pedido/i });
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.getAttribute("href") === "/caja/nuevo")).toBe(true);
  });

  it("tarjeta con número, fecha, responsable, productos, total y estados", () => {
    const order = buildOrder({
      id: "order-1",
      order_number: 7,
      status: "pendiente",
      payment_status: "pendiente",
      subtotal_cents: 3000,
      total_cents: 3000,
      created_by: "cashier-1",
    });
    const item = buildOrderItem({
      order_id: "order-1",
      name_snapshot: "Arroz 1kg",
      quantity: 2,
      unit_price_cents: 1500,
      line_total_cents: 3000,
    });

    render(
      <OrdersView
        orders={[order]}
        items={[item]}
        cashierNames={{ "cashier-1": "Carlos Mamani" }}
      />,
    );

    const card = screen.getByTestId("order-card-7");
    expect(card).toHaveAttribute("href", "/caja/pedido/order-1");
    expect(within(card).getByText("Pedido #7")).toBeInTheDocument();
    expect(within(card).getByText(/Carlos Mamani/)).toBeInTheDocument();
    expect(within(card).getByText("2 × Arroz 1kg")).toBeInTheDocument();
    expect(within(card).getAllByText("Bs 30,00")).toHaveLength(2);
    expect(within(card).getByText("Pendiente")).toBeInTheDocument();
    expect(within(card).getByText("Sin cobrar")).toBeInTheDocument();

    const column = screen.getByTestId("orders-column-pendiente");
    expect(within(column).getByTestId("order-card-7")).toBeInTheDocument();
  });

  it("marca como cobrado un pedido pagado", () => {
    const order = buildOrder({
      id: "order-2",
      order_number: 8,
      status: "entregado",
      payment_status: "pagado",
    });

    render(<OrdersView orders={[order]} items={[]} cashierNames={{}} />);

    const card = screen.getByTestId("order-card-8");
    expect(within(card).getByText("Cobrado")).toBeInTheDocument();
    expect(within(card).getByText("Entregado")).toBeInTheDocument();
  });

  it("lista los pedidos cancelados en su propia sección", () => {
    const cancelled = buildOrder({
      id: "order-3",
      order_number: 9,
      status: "cancelado",
      total_cents: 1500,
    });

    render(<OrdersView orders={[cancelled]} items={[]} cashierNames={{}} />);

    const section = screen.getByTestId("orders-column-cancelado");
    expect(within(section).getByTestId("order-card-9")).toBeInTheDocument();
    expect(screen.getByTestId("orders-column-pendiente")).toHaveTextContent("Sin pedidos");
  });

  it("muestra el error de carga con role=alert", () => {
    render(
      <OrdersView
        orders={[]}
        items={[]}
        cashierNames={{}}
        error="No se pudieron cargar los pedidos."
      />,
    );

    expect(screen.getByTestId("orders-error")).toHaveTextContent(
      "No se pudieron cargar los pedidos.",
    );
    expect(screen.queryByText("No hay pedidos en este turno")).not.toBeInTheDocument();
  });

  it("ofrece el acceso secundario a Venta directa", () => {
    render(<OrdersView orders={[]} items={[]} cashierNames={{}} />);

    const direct = screen.getByTestId("venta-directa-link");
    expect(direct).toHaveAttribute("href", "/caja?vista=pos");
    expect(screen.getByTestId("nuevo-pedido-link")).toHaveAttribute("href", "/caja/nuevo");
  });
});
