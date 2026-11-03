import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportsData } from "@/lib/actions/reports-core";
import { ReportsView } from "./reports-view";

const { getReportsDataAction, exportSalesReportCsvAction } = vi.hoisted(() => ({
  getReportsDataAction: vi.fn(),
  exportSalesReportCsvAction: vi.fn(),
}));

vi.mock("@/lib/actions/reports", () => ({
  getReportsDataAction,
  exportSalesReportCsvAction,
}));

function buildData(overrides: Partial<ReportsData> = {}): ReportsData {
  return {
    dateFrom: "2026-11-01",
    dateTo: "2026-11-07",
    previousDateFrom: "2026-10-25",
    previousDateTo: "2026-10-31",
    stats: {
      grossCents: 3000,
      discountCents: 200,
      totalCents: 2800,
      transactionCount: 2,
      voidedCount: 1,
      voidedCents: 900,
      averageTicketCents: 1400,
    },
    previousStats: {
      grossCents: 2000,
      discountCents: 0,
      totalCents: 2000,
      transactionCount: 1,
      voidedCount: 0,
      voidedCents: 0,
      averageTicketCents: 2000,
    },
    dailyRows: [
      {
        dayKey: "2026-11-01",
        transactionCount: 1,
        grossCents: 1800,
        discountCents: 0,
        collectedCents: 1800,
        voidedCount: 0,
        voidedCents: 0,
      },
      {
        dayKey: "2026-11-02",
        transactionCount: 1,
        grossCents: 1200,
        discountCents: 200,
        collectedCents: 1000,
        voidedCount: 1,
        voidedCents: 900,
      },
    ],
    topProducts: [{ productId: "p1", name: "Coca-Cola 2L", units: 4, totalCents: 5000 }],
    leastProducts: [{ productId: "p9", name: "Harina 1kg", units: 0, totalCents: 0 }],
    purchasesSummary: {
      totalCount: 2,
      totalCents: 45_000,
      byStatus: [
        { status: "draft", count: 0, totalCents: 0 },
        { status: "ordered", count: 0, totalCents: 0 },
        { status: "partial", count: 0, totalCents: 0 },
        { status: "received", count: 2, totalCents: 45_000 },
        { status: "cancelled", count: 0, totalCents: 0 },
      ],
    },
    cashSummary: { closedCount: 3, totalDifferenceCents: -50, withDifferenceCount: 1 },
    inventoryValuation: {
      retailValueCents: 100_000,
      costValueCents: 60_000,
      costedRetailValueCents: 80_000,
      costedProductCount: 3,
      uncostedProductCount: 1,
      totalProductCount: 4,
    },
    ...overrides,
  };
}

const initialRange = { dateFrom: "2026-11-01", dateTo: "2026-11-07" };

beforeEach(() => {
  vi.clearAllMocks();
  getReportsDataAction.mockResolvedValue({ ok: true, data: buildData() });
  exportSalesReportCsvAction.mockResolvedValue({
    ok: true,
    data: { csv: "fecha\r\n2026-11-01,1,18.00,0.00,18.00,0,0.00\r\n", filename: "ventas.csv" },
  });
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReportsView (E9-01/E9-05)", () => {
  it("muestra las métricas del periodo y la comparación con el periodo anterior", () => {
    render(<ReportsView initialRange={initialRange} initialData={buildData()} />);

    expect(screen.getByTestId("stat-collected")).toHaveTextContent("Bs 28,00");
    expect(screen.getByTestId("stat-collected-change")).toHaveTextContent(
      "+40% vs. periodo anterior",
    );
    expect(screen.getByTestId("stat-gross")).toHaveTextContent("Bs 30,00");
    expect(screen.getByTestId("stat-discounts")).toHaveTextContent("Bs 2,00");
    expect(screen.getByTestId("stat-transactions")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-voided")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-voided-amount")).toHaveTextContent("Bs 9,00");
    expect(screen.getAllByTestId("daily-row")).toHaveLength(2);
  });

  it("cambia a la pestaña de productos y muestra top y menos vendidos", () => {
    render(<ReportsView initialRange={initialRange} initialData={buildData()} />);

    const tab = screen.getByRole("button", { name: "Productos" });
    fireEvent.click(tab);

    expect(tab).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Ventas" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("top-product-row")).toHaveTextContent("Coca-Cola 2L");
    expect(screen.getByTestId("top-product-row")).toHaveTextContent("Bs 50,00");
    expect(screen.getByTestId("least-product-row")).toHaveTextContent("Harina 1kg");
  });

  it("muestra inventario valorizado y aclara el método del margen sin decir ganancia neta", () => {
    render(<ReportsView initialRange={initialRange} initialData={buildData()} />);

    fireEvent.click(screen.getByRole("button", { name: "Inventario" }));

    expect(screen.getByTestId("value-cost")).toHaveTextContent("Bs 600,00");
    expect(screen.getByTestId("value-retail")).toHaveTextContent("Bs 1.000,00");
    expect(screen.getByTestId("value-margin")).toHaveTextContent("Bs 200,00");
    expect(screen.getByText(/Solo productos con costo registrado \(3 de 4\)/)).toBeInTheDocument();
    expect(screen.getByText(/Método: valor al precio de venta menos valor al costo/)).toBeInTheDocument();
    expect(screen.queryByText("ganancia neta")).not.toBeInTheDocument();
  });

  it("muestra compras por estado y resumen de cajas cerradas", () => {
    render(<ReportsView initialRange={initialRange} initialData={buildData()} />);

    fireEvent.click(screen.getByRole("button", { name: "Caja y compras" }));

    const statusRows = screen.getAllByTestId("purchase-status-row");
    expect(statusRows).toHaveLength(5);
    expect(statusRows[3]).toHaveTextContent("Recibida");
    expect(statusRows[3]).toHaveTextContent("Bs 450,00");
    expect(screen.getByTestId("cash-closed-count")).toHaveTextContent("3");
    expect(screen.getByTestId("cash-with-difference")).toHaveTextContent("1");
    expect(screen.getByTestId("cash-difference-total")).toHaveTextContent("-Bs 0,50");
  });

  it("actualiza el periodo con las fechas elegidas", async () => {
    render(<ReportsView initialRange={initialRange} initialData={buildData()} />);

    getReportsDataAction.mockResolvedValue({
      ok: true,
      data: buildData({
        dateFrom: "2026-11-01",
        dateTo: "2026-11-10",
        stats: { ...buildData().stats, totalCents: 9999, transactionCount: 7 },
      }),
    });

    fireEvent.change(screen.getByLabelText("Fecha hasta"), {
      target: { value: "2026-11-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => {
      expect(getReportsDataAction).toHaveBeenCalledWith({
        dateFrom: "2026-11-01",
        dateTo: "2026-11-10",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("stat-transactions")).toHaveTextContent("7");
    });
    expect(screen.getByTestId("stat-collected")).toHaveTextContent("Bs 99,99");
  });

  it("muestra error de la acción en un alert", async () => {
    getReportsDataAction.mockResolvedValue({
      ok: false,
      code: "BAD_REQUEST",
      message: "La fecha final debe ser igual o posterior a la inicial.",
    });

    render(<ReportsView initialRange={initialRange} initialData={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La fecha final debe ser igual o posterior a la inicial.",
      );
    });
    expect(screen.getByText("Selecciona un periodo y pulsa «Actualizar».")).toBeInTheDocument();
  });

  it("muestra estado vacío cuando no hay ventas en el periodo", () => {
    const empty = buildData();
    empty.stats = {
      grossCents: 0,
      discountCents: 0,
      totalCents: 0,
      transactionCount: 0,
      voidedCount: 0,
      voidedCents: 0,
      averageTicketCents: null,
    };

    render(<ReportsView initialRange={initialRange} initialData={empty} />);

    expect(screen.getByText("Sin ventas en el periodo")).toBeInTheDocument();
  });

  it("exporta el CSV descargándolo desde el navegador", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<ReportsView initialRange={initialRange} initialData={buildData()} />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));

    await waitFor(() => {
      expect(exportSalesReportCsvAction).toHaveBeenCalledWith({
        dateFrom: "2026-11-01",
        dateTo: "2026-11-07",
      });
    });
    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    const alert = screen.queryByRole("alert");
    expect(alert).not.toBeInTheDocument();
  });

  it("propaga el error inicial recibido por la página", () => {
    render(
      <ReportsView
        initialRange={initialRange}
        initialData={null}
        initialError="No se pudieron cargar los reportes."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar los reportes.");
  });
});
