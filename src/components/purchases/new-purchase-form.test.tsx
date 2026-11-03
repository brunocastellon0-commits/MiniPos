import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPurchaseAction } from "@/lib/actions/purchases";
import { buildProduct, buildSupplier } from "@/test/factories";
import { NewPurchaseForm } from "./new-purchase-form";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  usePathname: () => "/compras/nueva",
}));

vi.mock("@/lib/actions/purchases", () => ({
  createPurchaseAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const supplier = buildSupplier({ id: "sup-1", name: "Distribuidora Andina" });

const arroz = buildProduct({
  id: "p-arroz",
  name: "Arroz 1kg",
  cost_cents: 950,
  stock_qty: 0,
});

const leche = buildProduct({
  id: "p-leche",
  name: "Leche 1L",
  cost_cents: 500,
  stock_qty: 3,
});

function renderForm(overrides: Partial<Parameters<typeof NewPurchaseForm>[0]> = {}) {
  return render(
    <NewPurchaseForm suppliers={[supplier]} products={[arroz, leche]} {...overrides} />,
  );
}

describe("NewPurchaseForm (E7-02 / E7-04)", () => {
  it("precarga la fila con cantidad y costo del producto (atajo desde stock bajo)", () => {
    renderForm({ initialItems: [{ productId: "p-arroz", quantity: 4 }] });

    expect(screen.getByLabelText("Cant.")).toHaveValue(4);
    expect(screen.getByLabelText("Costo unit. (Bs)")).toHaveValue("9.50");
    expect(screen.getByLabelText("Producto")).toHaveValue("p-arroz");
    // 4 * 9,50 Bs = 38,00
    expect(screen.getByTestId("purchase-total")).toHaveTextContent("Bs 38,00");
  });

  it("registra la compra con montos convertidos a centavos y navega al listado", async () => {
    vi.mocked(createPurchaseAction).mockResolvedValue({
      ok: true,
      data: {
        purchase: buildPurchaseSafe(),
        items: [],
      },
    });
    const { container } = renderForm({
      initialItems: [{ productId: "p-arroz", quantity: 4 }],
    });

    fireEvent.change(screen.getByLabelText("Proveedor (obligatorio)"), {
      target: { value: "sup-1" },
    });
    fireEvent.submit(container.querySelector("#new-purchase-form")!);

    await waitFor(() =>
      expect(createPurchaseAction).toHaveBeenCalledWith({
        supplierId: "sup-1",
        notes: null,
        items: [{ productId: "p-arroz", quantity: 4, unitCostCents: 950 }],
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/compras");
  });

  it("valida proveedor y cantidades en el cliente", () => {
    const { container } = renderForm({
      initialItems: [{ productId: "p-arroz", quantity: 4 }],
    });

    fireEvent.submit(container.querySelector("#new-purchase-form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Selecciona un proveedor.");
    expect(createPurchaseAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Proveedor (obligatorio)"), {
      target: { value: "sup-1" },
    });
    fireEvent.change(screen.getByLabelText("Cant."), { target: { value: "0" } });
    fireEvent.submit(container.querySelector("#new-purchase-form")!);
    expect(screen.getByRole("alert")).toHaveTextContent(/enteros mayores a 0/i);
    expect(createPurchaseAction).not.toHaveBeenCalled();
  });

  it("suma el total del pedido al editar filas (Bs → centavos)", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Agregar producto" }));
    fireEvent.change(screen.getByLabelText("Producto"), { target: { value: "p-leche" } });
    // El costo se precarga con el costo del producto: 500 centavos → 5.00
    expect(screen.getByLabelText("Costo unit. (Bs)")).toHaveValue("5.00");

    fireEvent.change(screen.getByLabelText("Cant."), { target: { value: "2" } });
    expect(screen.getByTestId("purchase-total")).toHaveTextContent("Bs 10,00");

    fireEvent.change(screen.getByLabelText("Costo unit. (Bs)"), {
      target: { value: "10.50" },
    });
    expect(screen.getByTestId("purchase-total")).toHaveTextContent("Bs 21,00");
  });

  it("muestra el error del servidor sin navegar", async () => {
    vi.mocked(createPurchaseAction).mockResolvedValue({
      ok: false,
      code: "BAD_REQUEST",
      message: "El proveedor está inactivo.",
    });
    const { container } = renderForm({
      initialItems: [{ productId: "p-arroz", quantity: 1 }],
    });

    fireEvent.change(screen.getByLabelText("Proveedor (obligatorio)"), {
      target: { value: "sup-1" },
    });
    fireEvent.submit(container.querySelector("#new-purchase-form")!);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("El proveedor está inactivo."),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});

function buildPurchaseSafe() {
  return {
    id: "pur-new",
    supplier_id: "sup-1",
    status: "ordered" as const,
    notes: null,
    total_cents: 3800,
    created_by: "owner-1",
    created_at: "2026-11-03T10:00:00.000Z",
    updated_at: "2026-11-03T10:00:00.000Z",
  };
}
