import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adjustStockAction } from "@/lib/actions/inventory";
import { buildProduct, buildStockMovement } from "@/test/factories";
import { InventoryView } from "./inventory-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/inventario",
}));

vi.mock("@/lib/actions/inventory", () => ({
  adjustStockAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const coca = buildProduct({
  id: "prod-coca",
  name: "Coca-Cola 2L",
  barcode: "7771234567890",
  stock_qty: 3,
  min_stock: 5,
});

const leche = buildProduct({
  id: "prod-leche",
  name: "Leche Entera 1L",
  stock_qty: 0,
  min_stock: 2,
});

const arroz = buildProduct({
  id: "prod-arroz",
  name: "Arroz 1kg",
  stock_qty: 10,
  min_stock: 4,
});

const inactiva = buildProduct({
  id: "prod-vieja",
  name: "Producto Retirado",
  stock_qty: 50,
  min_stock: 5,
  active: false,
});

const movVenta = buildStockMovement({
  id: "mov-1",
  product_id: "prod-coca",
  kind: "sale",
  delta: -2,
  reason: "Cobro venta #101",
  ref_type: "sale",
  ref_id: "sale-101",
  user_id: "cashier-1",
  created_at: "2026-11-01T12:00:00.000Z",
});

const movAjuste = {
  ...buildStockMovement({
    id: "mov-2",
    product_id: "prod-arroz",
    kind: "adjustment",
    delta: 5,
    reason: "Conteo de almacén",
    user_id: "owner-1",
    created_at: "2026-11-02T09:30:00.000Z",
  }),
  ref_type: null,
  ref_id: null,
};

const userNames = { "cashier-1": "Carlos Mamani", "owner-1": "Ana Quispe" };

function renderView(overrides: Partial<Parameters<typeof InventoryView>[0]> = {}) {
  return render(
    <InventoryView
      initialProducts={[coca, leche, arroz, inactiva]}
      initialMovements={[movVenta, movAjuste]}
      userNames={userNames}
      {...overrides}
    />,
  );
}

describe("InventoryView (E6-01 / E6-03 / E6-04)", () => {
  it("lista productos con mínimo, existencias y estado (texto + ícono, sin solo-color)", () => {
    renderView();

    expect(screen.getByText("Coca-Cola 2L")).toBeInTheDocument();
    expect(screen.getByText("Leche Entera 1L")).toBeInTheDocument();
    expect(screen.getByText("Arroz 1kg")).toBeInTheDocument();
    expect(screen.getByText("Producto Retirado")).toBeInTheDocument();

    // Badges de estado con texto (no dependen solo del color), acotados a la tabla
    const stockTable = within(screen.getByRole("table"));
    expect(stockTable.getByText("Bajo")).toBeInTheDocument();
    expect(stockTable.getByText("Agotado")).toBeInTheDocument();
    expect(stockTable.getAllByText("OK")).toHaveLength(2);
    expect(stockTable.getByText("Inactivo")).toBeInTheDocument();

    // Alerta de reposición: 2 productos activos cumplen stock <= mínimo
    expect(screen.getByText(/2 productos requieren reposición/i)).toBeInTheDocument();
  });

  it("filtra por estado (Agotado muestra solo el producto sin existencias)", () => {
    renderView();

    fireEvent.change(screen.getByLabelText("Filtrar por estado"), {
      target: { value: "out" },
    });

    expect(screen.getByText("Leche Entera 1L")).toBeInTheDocument();
    expect(screen.queryByText("Coca-Cola 2L")).not.toBeInTheDocument();
    expect(screen.queryByText("Arroz 1kg")).not.toBeInTheDocument();
  });

  it("busca por nombre o código de barras", () => {
    renderView();

    fireEvent.change(screen.getByLabelText("Buscar producto por nombre o código"), {
      target: { value: "coca" },
    });

    expect(screen.getByText("Coca-Cola 2L")).toBeInTheDocument();
    expect(screen.queryByText("Arroz 1kg")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar producto por nombre o código"), {
      target: { value: "7771234567890" },
    });
    expect(screen.getByText("Coca-Cola 2L")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar producto por nombre o código"), {
      target: { value: "no-existe" },
    });
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("muestra el historial de movimientos con origen, enlace, delta con signo y usuario", () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Historial de movimientos" }));

    expect(screen.getByText("Venta")).toBeInTheDocument();
    expect(screen.getByText("Ajuste")).toBeInTheDocument();

    const saleLink = screen.getByRole("link", { name: "Ver venta" });
    expect(saleLink).toHaveAttribute("href", "/ventas/sale-101");

    expect(screen.getByText("-2")).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.getByText("Conteo de almacén")).toBeInTheDocument();
    expect(screen.getByText("Carlos Mamani")).toBeInTheDocument();
    expect(screen.getByText("Ana Quispe")).toBeInTheDocument();
    expect(screen.getByText("Coca-Cola 2L")).toBeInTheDocument();
  });

  it("muestra estados vacíos: sin productos, sin resultados y sin movimientos", () => {
    const { rerender } = renderView({ initialProducts: [], initialMovements: [] });
    expect(
      screen.getByText("No hay productos en el inventario"),
    ).toBeInTheDocument();

    rerender(
      <InventoryView
        initialProducts={[coca]}
        initialMovements={[]}
        userNames={userNames}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Historial de movimientos" }));
    expect(screen.getByText("Sin movimientos registrados")).toBeInTheDocument();
  });

  it("muestra el error de carga con role alert", () => {
    renderView({ initialError: "No se pudo cargar el inventario." });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No se pudo cargar el inventario.");
  });
});

describe("InventoryView - Ajustes y mermas (E6-02)", () => {
  it("abre el diálogo y envía el ajuste al servidor", async () => {
    vi.mocked(adjustStockAction).mockResolvedValue({ ok: true, data: 9 });
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Ajustar stock de Coca-Cola 2L" }));
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: "Conteo de almacén" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar ajuste" }));

    await waitFor(() =>
      expect(adjustStockAction).toHaveBeenCalledWith({
        productId: "prod-coca",
        delta: 5,
        kind: "adjustment",
        reason: "Conteo de almacén",
      }),
    );
  });

  it("valida cantidad y motivo en el cliente sin llamar al servidor", () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Ajustar stock de Coca-Cola 2L" }));
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar ajuste" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/cantidad entera distinta de cero/i);
    expect(adjustStockAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: "-3" } });
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar ajuste" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/motivo es obligatorio/i);
    expect(adjustStockAction).not.toHaveBeenCalled();
  });

  it("muestra el error del servidor sin cerrar el diálogo", async () => {
    vi.mocked(adjustStockAction).mockResolvedValue({
      ok: false,
      code: "BAD_REQUEST",
      message: "El stock no puede quedar negativo.",
    });
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Ajustar stock de Coca-Cola 2L" }));
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: "-99" } });
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: "Merma grave" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar ajuste" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("El stock no puede quedar negativo."),
    );
    expect(screen.getByLabelText(/cantidad/i)).toBeInTheDocument();
  });

  it("ofrece el atajo para crear compra desde la alerta de stock bajo (E7-04)", () => {
    renderView();

    expect(screen.getByRole("link", { name: "Crear compra" })).toHaveAttribute(
      "href",
      "/compras/nueva?low=1",
    );
  });
});
