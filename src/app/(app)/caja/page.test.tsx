import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CashOverview } from "@/lib/actions/cash-core";
import { buildCashSession, buildProduct } from "@/test/factories";

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/actions/cash", () => ({
  getCashOverviewAction: vi.fn(),
}));

vi.mock("@/lib/actions/products-search", () => ({
  listPosProductsAction: vi.fn(),
  searchPosProductsAction: vi.fn(),
  getProductsByIdsAction: vi.fn(),
}));

vi.mock("@/lib/actions/categories", () => ({
  listCategoriesAction: vi.fn(),
}));

vi.mock("@/lib/actions/settings", () => ({
  getBusinessPublicAction: vi.fn(),
}));

vi.mock("@/lib/actions/orders", () => ({
  listOrdersAction: vi.fn(),
}));

import { requireUser } from "@/lib/auth";
import { getCashOverviewAction } from "@/lib/actions/cash";
import { listCategoriesAction } from "@/lib/actions/categories";
import { listOrdersAction } from "@/lib/actions/orders";
import { listPosProductsAction } from "@/lib/actions/products-search";
import { getBusinessPublicAction } from "@/lib/actions/settings";
import CajaPage from "./page";

const overview: CashOverview = {
  session: buildCashSession({ id: "s-1", status: "open", opening_cents: 10000 }),
  openedByName: "Ana Quispe",
  movements: [],
  sales: [],
  payments: { cashCents: 0, qrCents: 0, cardCents: 0, totalCents: 0, count: 0 },
  expectedCents: 10000,
};

const product = buildProduct({ id: "p-1", name: "Arroz 1kg" });

function publicSettings(overrides: Record<string, unknown> = {}) {
  return {
    name: "Minimarket Demo",
    legal_name: null,
    currency_code: "BOB",
    currency_symbol: "Bs",
    allow_negative_stock: false,
    low_stock_default: 5,
    cashier_can_discount: true,
    cashier_max_discount_cents: 0,
    operating_mode: "micromarket",
    enable_held_sales: true,
    order_charge_timing: "on_order",
    ...overrides,
  };
}

async function renderPage(searchParams: { vista?: string } = {}) {
  const view = await CajaPage({ searchParams: Promise.resolve(searchParams) });
  return render(view);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({
    id: "owner-1",
    name: "Ana Quispe",
    role: "owner",
    isActive: true,
  } as never);
  vi.mocked(getCashOverviewAction).mockResolvedValue({ ok: true, data: overview });
  vi.mocked(listPosProductsAction).mockResolvedValue({ ok: true, data: [product] });
  vi.mocked(listCategoriesAction).mockResolvedValue({ ok: true, data: [] });
  vi.mocked(getBusinessPublicAction).mockResolvedValue({
    ok: true,
    data: publicSettings(),
  } as never);
  vi.mocked(listOrdersAction).mockResolvedValue({
    ok: true,
    data: { orders: [], items: [], cashierNames: {} },
  });
});

describe("/caja: bifurcación por modalidad (Fase E)", () => {
  it("en micromarket renderiza el POS tradicional", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { name: "Nueva venta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar productos")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pedidos" })).not.toBeInTheDocument();
    expect(listOrdersAction).not.toHaveBeenCalled();
  });

  it("en restaurante renderiza el tablero de pedidos", async () => {
    vi.mocked(getBusinessPublicAction).mockResolvedValue({
      ok: true,
      data: publicSettings({ operating_mode: "restaurant" }),
    } as never);

    await renderPage();

    expect(screen.getByRole("heading", { name: "Pedidos" })).toBeInTheDocument();
    expect(screen.getByTestId("nuevo-pedido-link")).toHaveAttribute("href", "/caja/nuevo");
    expect(screen.getByTestId("venta-directa-link")).toHaveAttribute("href", "/caja?vista=pos");
    expect(screen.queryByRole("heading", { name: "Nueva venta" })).not.toBeInTheDocument();
    expect(listOrdersAction).toHaveBeenCalledWith({});
  });

  it("en restaurante con vista=pos renderiza la venta directa con enlace de vuelta", async () => {
    vi.mocked(getBusinessPublicAction).mockResolvedValue({
      ok: true,
      data: publicSettings({ operating_mode: "restaurant" }),
    } as never);

    await renderPage({ vista: "pos" });

    expect(screen.getByRole("heading", { name: "Venta directa" })).toBeInTheDocument();
    expect(screen.getByTestId("volver-pedidos-link")).toHaveAttribute("href", "/caja");
    expect(screen.getByLabelText("Buscar productos")).toBeInTheDocument();
    expect(listOrdersAction).not.toHaveBeenCalled();
  });

  it("muestra el estado de turno cerrado antes de decidir la vista", async () => {
    vi.mocked(getCashOverviewAction).mockResolvedValue({
      ok: false,
      code: "BAD_REQUEST",
      message: "No hay turno abierto.",
    });

    await renderPage();

    expect(screen.getByText("No hay turno de caja abierto")).toBeInTheDocument();
    expect(listOrdersAction).not.toHaveBeenCalled();
  });

  it("muestra el error del tablero cuando falla la lista de pedidos", async () => {
    vi.mocked(getBusinessPublicAction).mockResolvedValue({
      ok: true,
      data: publicSettings({ operating_mode: "restaurant" }),
    } as never);
    vi.mocked(listOrdersAction).mockResolvedValue({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "No se pudieron cargar los pedidos.",
    });

    await renderPage();

    expect(screen.getByTestId("orders-error")).toHaveTextContent(
      "No se pudieron cargar los pedidos.",
    );
  });
});
