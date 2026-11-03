import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPurchase } from "@/test/factories";
import { PurchasesView } from "./purchases-view";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  usePathname: () => "/compras",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const ordered = buildPurchase({
  id: "pur-1",
  supplier_id: "sup-1",
  status: "ordered",
  total_cents: 12000,
  created_at: "2026-11-02T10:00:00.000Z",
});

const received = buildPurchase({
  id: "pur-2",
  supplier_id: "sup-1",
  status: "received",
  total_cents: 55000,
  created_at: "2026-11-01T09:00:00.000Z",
});

const supplierNames = { "sup-1": "Distribuidora Andina" };

function renderView(overrides: Partial<Parameters<typeof PurchasesView>[0]> = {}) {
  return render(
    <PurchasesView
      initialPurchases={[ordered, received]}
      supplierNames={supplierNames}
      {...overrides}
    />,
  );
}

describe("PurchasesView (E7-02)", () => {
  it("lista compras con proveedor, total formateado, estado y enlace de detalle", () => {
    renderView();

    const table = screen.getAllByRole("table")[0]!;
    expect(within(table).getAllByText("Distribuidora Andina")).toHaveLength(2);
    expect(within(table).getByText("Bs 120,00")).toBeInTheDocument();
    expect(within(table).getByText("Bs 550,00")).toBeInTheDocument();
    expect(within(table).getByText("En pedido")).toBeInTheDocument();
    expect(within(table).getByText("Recibida")).toBeInTheDocument();

    const detailLinks = within(table).getAllByRole("link", { name: "Ver compra" });
    expect(detailLinks).toHaveLength(2);
    expect(detailLinks[0]).toHaveAttribute("href", "/compras/pur-1");
    expect(detailLinks[1]).toHaveAttribute("href", "/compras/pur-2");
  });

  it("filtra por estado", () => {
    renderView();

    fireEvent.change(screen.getByLabelText("Filtrar por estado"), {
      target: { value: "received" },
    });
    expect(screen.queryByText("Bs 120,00")).not.toBeInTheDocument();
    expect(screen.getByText("Bs 550,00")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por estado"), {
      target: { value: "ordered" },
    });
    expect(screen.getByText("Bs 120,00")).toBeInTheDocument();
    expect(screen.queryByText("Bs 550,00")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por estado"), {
      target: { value: "cancelled" },
    });
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("navega a nueva compra y a proveedores", () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Nueva compra" }));
    expect(pushMock).toHaveBeenCalledWith("/compras/nueva");

    fireEvent.click(screen.getByRole("button", { name: "Proveedores" }));
    expect(pushMock).toHaveBeenCalledWith("/proveedores");
  });

  it("muestra estados vacío y de error", () => {
    const { rerender } = renderView({ initialPurchases: [] });
    expect(screen.getByText("No hay compras registradas")).toBeInTheDocument();

    rerender(
      <PurchasesView
        initialPurchases={[]}
        supplierNames={{}}
        initialError="No se pudo cargar."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar.");
  });
});
