import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupplierAction,
  deleteSupplierAction,
  updateSupplierAction,
} from "@/lib/actions/suppliers";
import { buildSupplier } from "@/test/factories";
import { SuppliersView } from "./suppliers-view";

const pushMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  usePathname: () => "/proveedores",
}));

vi.mock("@/lib/actions/suppliers", () => ({
  createSupplierAction: vi.fn(),
  updateSupplierAction: vi.fn(),
  deleteSupplierAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const andina = buildSupplier({
  id: "sup-1",
  name: "Distribuidora Andina",
  phone: "71234567",
  notes: "Entrega los martes",
  active: true,
});

function renderView(overrides: Partial<Parameters<typeof SuppliersView>[0]> = {}) {
  return render(<SuppliersView initialSuppliers={[andina]} {...overrides} />);
}

describe("SuppliersView (E7-01)", () => {
  it("lista proveedores con teléfono, notas, estado y acciones", () => {
    renderView();

    expect(screen.getByText("Distribuidora Andina")).toBeInTheDocument();
    expect(screen.getByText("71234567")).toBeInTheDocument();
    expect(screen.getByText("Entrega los martes")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Editar Distribuidora Andina" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar Distribuidora Andina" }),
    ).toBeInTheDocument();
  });

  it("crea un proveedor con payload normalizado y refresca", async () => {
    vi.mocked(createSupplierAction).mockResolvedValue({ ok: true, data: andina });
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Nuevo proveedor" }));
    fireEvent.change(screen.getByLabelText("Nombre (obligatorio)"), {
      target: { value: "  Distribuidora Sur  " },
    });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: " 72000000 " } });
    fireEvent.submit(document.getElementById("supplier-form")!);

    await waitFor(() =>
      expect(createSupplierAction).toHaveBeenCalledWith({
        name: "Distribuidora Sur",
        phone: "72000000",
        notes: null,
        active: true,
      }),
    );
    expect(refreshMock).toHaveBeenCalled();
    expect(await screen.findByText("Proveedor creado")).toBeInTheDocument();
  });

  it("valida el nombre mínimo en el cliente sin llamar al servidor", () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Nuevo proveedor" }));
    fireEvent.change(screen.getByLabelText("Nombre (obligatorio)"), {
      target: { value: " A " },
    });
    fireEvent.submit(document.getElementById("supplier-form")!);

    expect(screen.getByRole("alert")).toHaveTextContent(/mínimo 2 caracteres/i);
    expect(createSupplierAction).not.toHaveBeenCalled();
  });

  it("muestra el conflicto de eliminación cuando el proveedor tiene compras", async () => {
    vi.mocked(deleteSupplierAction).mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      message: "No se puede eliminar: el proveedor tiene compras registradas.",
    });
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Distribuidora Andina" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No se puede eliminar: el proveedor tiene compras registradas.",
      ),
    );
    expect(deleteSupplierAction).toHaveBeenCalledWith({ id: "sup-1" });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("actualiza un proveedor existente", async () => {
    vi.mocked(updateSupplierAction).mockResolvedValue({ ok: true, data: andina });
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Editar Distribuidora Andina" }));
    fireEvent.change(screen.getByLabelText("Nombre (obligatorio)"), {
      target: { value: "Distribuidora Andina SRL" },
    });
    fireEvent.submit(document.getElementById("supplier-form")!);

    await waitFor(() =>
      expect(updateSupplierAction).toHaveBeenCalledWith({
        id: "sup-1",
        name: "Distribuidora Andina SRL",
        phone: "71234567",
        notes: "Entrega los martes",
        active: true,
      }),
    );
    expect(await screen.findByText("Proveedor actualizado")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay proveedores", () => {
    renderView({ initialSuppliers: [] });
    expect(screen.getByText("No hay proveedores registrados")).toBeInTheDocument();
  });

  it("muestra el error de carga con role alert", () => {
    renderView({ initialSuppliers: [], initialError: "No se pudo cargar." });
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar.");
  });
});
