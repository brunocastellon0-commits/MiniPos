import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatTime } from "@/lib/dates";
import {
  buildPanelComparison,
  lastDayKeys,
  summarizeSalesByDay,
  type DashboardSale,
} from "@/lib/domain/dashboard";
import { formatBs } from "@/lib/money";
import { PanelView, type PanelViewProps } from "./panel-view";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  usePathname: () => "/panel",
}));

const REFERENCE = new Date("2026-11-03T16:00:00.000Z");
const DAY_KEYS = lastDayKeys(REFERENCE, 30);
const PREVIOUS_WEEK_KEY = DAY_KEYS[DAY_KEYS.length - 1 - 7]!;

function sale(overrides: Partial<DashboardSale> = {}): DashboardSale {
  return {
    status: "paid",
    subtotal_cents: 1000,
    discount_cents: 0,
    total_cents: 1000,
    created_at: "2026-11-03T14:00:00.000Z",
    ...overrides,
  };
}

const SALES: DashboardSale[] = [
  sale({ subtotal_cents: 12000, discount_cents: 500, total_cents: 11500 }),
  sale({
    subtotal_cents: 8000,
    discount_cents: 0,
    total_cents: 8000,
    created_at: "2026-11-03T15:00:00.000Z",
  }),
  sale({
    status: "voided",
    subtotal_cents: 9999,
    total_cents: 9999,
    created_at: "2026-11-03T15:30:00.000Z",
  }),
  sale({
    subtotal_cents: 5000,
    total_cents: 5000,
    created_at: "2026-10-27T14:00:00.000Z",
  }),
  sale({
    subtotal_cents: 3000,
    total_cents: 3000,
    created_at: "2026-10-29T14:00:00.000Z",
  }),
];

function buildProps(overrides: Partial<PanelViewProps> = {}): PanelViewProps {
  const todaySales = SALES.filter(
    (item) => item.created_at.startsWith("2026-11-03") && item.status !== "voided",
  );
  const previousSales = SALES.filter((item) => item.created_at.startsWith(PREVIOUS_WEEK_KEY));
  const comparison = buildPanelComparison(todaySales, [], previousSales);

  return {
    userName: "Doña Elena",
    greetingDate: "lunes, 3 de noviembre",
    comparison,
    dayKeys: DAY_KEYS,
    series: summarizeSalesByDay(SALES, DAY_KEYS),
    cash: {
      status: "open",
      openedAt: "2026-11-03T12:00:00.000Z",
      openedByName: "María Choque",
    },
    lowStock: [
      { id: "p-1", name: "Coca-Cola 2L", stock_qty: 1, min_stock: 5 },
      { id: "p-2", name: "Leche Entera 1L", stock_qty: 0, min_stock: 2 },
    ],
    recentSales: [
      {
        id: "s-1",
        created_at: "2026-11-03T14:00:00.000Z",
        total_cents: 11500,
        payment_method: "cash",
      },
      {
        id: "s-2",
        created_at: "2026-11-03T15:00:00.000Z",
        total_cents: 8000,
        payment_method: "qr",
      },
    ],
    topProducts: [],
    margin: null,
    dayCash: null,
    ...overrides,
  };
}

describe("PanelView (D7 / E8-02)", () => {
  it("muestra saludo y fecha sin la sección de accesos directos", () => {
    pushMock.mockClear();
    render(<PanelView {...buildProps()} />);

    expect(screen.getByRole("heading", { name: "Hola, Doña Elena" })).toBeInTheDocument();
    expect(screen.getByText(/lunes, 3 de noviembre/)).toBeInTheDocument();

    expect(screen.queryByRole("heading", { name: "Accesos directos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir punto de venta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Registrar compra" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver turno de caja" })).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("las cifras del panel coinciden con la suma de las ventas de la prueba", () => {
    render(<PanelView {...buildProps()} />);

    // Ventas pagadas de hoy: 11.500 + 8.000 = 19.500 (la anulada no cuenta)
    expect(screen.getByTestId("today-sales")).toHaveTextContent(formatBs(19500));
    expect(screen.getByTestId("today-transactions")).toHaveTextContent("2");
    expect(screen.getByTestId("average-ticket")).toHaveTextContent(formatBs(9750));
    // Ventana de 7 días (28/10 a 03/11): 19.500 (hoy) + 3.000 (29/10) = 22.500
    expect(screen.getByTestId("window-total")).toHaveTextContent(formatBs(22500));
    expect(screen.getByTestId("window-transactions")).toHaveTextContent("3");
    expect(screen.getByTestId("low-stock-count")).toHaveTextContent("2");
  });

  it("muestra la comparación contra ayer y contra el mismo día de la semana anterior", () => {
    render(<PanelView {...buildProps()} />);

    // Sin ventas ayer en el dataset base: porcentaje y monto en «—».
    expect(screen.getByTestId("today-change-yesterday")).toHaveTextContent("—");
    expect(screen.getByTestId("yesterday-sales")).toHaveTextContent("—");

    // 19.500 vs 5.000 = +290%
    expect(screen.getByTestId("today-change")).toHaveTextContent("+290%");
    expect(screen.getByText(/Ese día: Bs 50,00/)).toBeInTheDocument();
  });

  it("muestra el porcentaje de variación contra ayer cuando hay ventas", () => {
    const comparison = buildPanelComparison(
      SALES.filter((item) => item.created_at.startsWith("2026-11-03") && item.status !== "voided"),
      [sale({ total_cents: 10000, subtotal_cents: 10000, created_at: "2026-11-02T14:00:00.000Z" })],
      [],
    );

    render(<PanelView {...buildProps({ comparison })} />);

    expect(screen.getByTestId("today-change-yesterday")).toHaveTextContent("+95%");
    expect(screen.getByTestId("yesterday-sales")).toHaveTextContent(formatBs(10000));
    expect(screen.getByTestId("today-change")).toHaveTextContent("—");
    expect(screen.getByText("Sin datos suficientes del día anterior")).toBeInTheDocument();
  });

  it("cambia el rango del gráfico y recalcula el total de la ventana", () => {
    render(<PanelView {...buildProps()} />);

    const thirtyButton = screen.getByRole("button", { name: "30 días" });
    expect(thirtyButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(thirtyButton);

    expect(thirtyButton).toHaveAttribute("aria-pressed", "true");
    // 22.500 (7 días) + 5.000 (27/10) = 27.500
    expect(screen.getByTestId("window-total")).toHaveTextContent(formatBs(27500));
    expect(screen.getByTestId("window-transactions")).toHaveTextContent("4");
    expect(screen.getByRole("img", { name: /últimos 30 días/ })).toBeInTheDocument();
  });

  it("muestra estado de caja abierta, stock bajo y actividad reciente", () => {
    render(<PanelView {...buildProps()} />);

    expect(screen.getByText("Caja abierta")).toBeInTheDocument();
    expect(screen.getByText(/Desde las 08:00 · María Choque/)).toBeInTheDocument();

    expect(screen.getByText("Coca-Cola 2L")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver inventario" })).toHaveAttribute(
      "href",
      "/inventario",
    );

    expect(screen.getByText(formatBs(11500))).toBeInTheDocument();
    expect(screen.getByText("Efectivo")).toBeInTheDocument();
    expect(
      screen.getByText(formatTime(new Date("2026-11-03T15:00:00.000Z"))),
    ).toBeInTheDocument();
    expect(screen.getByText("QR")).toBeInTheDocument();
  });

  it("muestra la última diferencia cuando la caja está cerrada", () => {
    render(
      <PanelView
        {...buildProps({
          cash: {
            status: "closed",
            closedAt: "2026-11-02T22:00:00.000Z",
            differenceCents: -150,
          },
        })}
      />,
    );

    expect(screen.getByText("Caja cerrada")).toBeInTheDocument();
    expect(screen.getByTestId("cash-difference")).toHaveTextContent("-Bs 1,50");
  });

  it("muestra top productos vendidos con unidades e importes", () => {
    render(
      <PanelView
        {...buildProps({
          topProducts: [
            { productId: "p-1", name: "Coca-Cola 2L", units: 3, totalCents: 4500 },
            { productId: "p-2", name: "Arroz 1kg", units: 1, totalCents: 800 },
          ],
        })}
      />,
    );

    expect(screen.getByText(/3 u\. · Bs 45,00/)).toBeInTheDocument();
    expect(screen.getByText(/1 u\. · Bs 8,00/)).toBeInTheDocument();
    expect(screen.queryByText("Sin ventas hoy")).not.toBeInTheDocument();
  });

  it("muestra ingresos y egresos del día con sus importes", () => {
    render(
      <PanelView {...buildProps({ dayCash: { incomeCents: 20000, expenseCents: 3500 } })} />,
    );

    expect(screen.getByTestId("day-income")).toHaveTextContent(formatBs(20000));
    expect(screen.getByTestId("day-expense")).toHaveTextContent(formatBs(3500));
    expect(screen.queryByText("Sin movimientos hoy")).not.toBeInTheDocument();
  });

  it("muestra el margen bruto estimado con su método y sin la palabra ganancia", () => {
    render(
      <PanelView
        {...buildProps({ margin: { marginCents: 2900, revenueCents: 5300, costCents: 2400 } })}
      />,
    );

    expect(screen.getByRole("heading", { name: "Margen bruto estimado" })).toBeInTheDocument();
    expect(screen.getByTestId("gross-margin")).toHaveTextContent(formatBs(2900));
    expect(screen.getByText(/costo registrado actualmente/)).toBeInTheDocument();
    expect(screen.queryByText(/ganancia/i)).not.toBeInTheDocument();
  });

  it("oculta la tarjeta de margen cuando no hay costos registrados", () => {
    render(<PanelView {...buildProps({ margin: null })} />);

    expect(screen.queryByRole("heading", { name: "Margen bruto estimado" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("gross-margin")).not.toBeInTheDocument();
  });

  it("muestra estados vacíos sin cifras engañosas", () => {
    render(
      <PanelView
        {...buildProps({
          comparison: buildPanelComparison([], [], []),
          series: summarizeSalesByDay([], DAY_KEYS),
          cash: { status: "none" },
          lowStock: [],
          recentSales: [],
        })}
      />,
    );

    expect(screen.getByTestId("today-sales")).toHaveTextContent(formatBs(0));
    expect(screen.getByTestId("today-transactions")).toHaveTextContent("0");
    expect(screen.getByTestId("average-ticket")).toHaveTextContent("—");
    expect(screen.getByTestId("today-change")).toHaveTextContent("—");
    expect(screen.getByTestId("today-change-yesterday")).toHaveTextContent("—");
    expect(screen.getByText("Sin datos suficientes del día anterior")).toBeInTheDocument();
    expect(screen.getByText("Sin caja")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay turnos registrados.")).toBeInTheDocument();
    expect(screen.getByText("Sin productos en stock bajo.")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay ventas hoy")).toBeInTheDocument();
    expect(screen.getByText("Sin ventas hoy")).toBeInTheDocument();
    expect(screen.getByText("Sin movimientos hoy")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Margen bruto estimado" }),
    ).not.toBeInTheDocument();
  });

  it("muestra el error de carga con role alert", () => {
    render(<PanelView {...buildProps({ initialError: "No se pudo cargar el panel." })} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar el panel.");
  });
});
