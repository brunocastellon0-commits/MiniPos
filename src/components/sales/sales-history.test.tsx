import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sale } from "@/lib/repos/types";
import { buildSale } from "@/test/factories";
import { SalesHistory } from "./sales-history";

vi.mock("@/lib/actions/sales", () => ({
  listSalesAction: vi.fn(),
}));

import { listSalesAction } from "@/lib/actions/sales";

const saleCash = buildSale({
  id: "sale-1",
  number: 101,
  cashier_id: "cashier-1",
  payment_method: "cash",
  total_cents: 3000,
  created_at: "2026-10-01T12:00:00.000Z",
});

const saleQr = buildSale({
  id: "sale-2",
  number: 102,
  cashier_id: "owner-1",
  payment_method: "qr",
  status: "voided",
  total_cents: 1500,
  created_at: "2026-11-01T18:00:00.000Z",
});

const cashierNames = { "cashier-1": "Carlos Mamani", "owner-1": "Ana Quispe" };

type ListResult = Awaited<ReturnType<typeof listSalesAction>>;

function ok(sales: Sale[], hasMore = false): ListResult {
  return { ok: true, data: { sales, cashierNames, hasMore } };
}

function renderHistory(
  isOwner = true,
  initialSales: Sale[] = [saleCash, saleQr],
  initialHasMore = false,
) {
  return render(
    <SalesHistory
      initialSales={initialSales}
      initialCashierNames={cashierNames}
      isOwner={isOwner}
      initialHasMore={initialHasMore}
    />,
  );
}

describe("SalesHistory (E5-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSalesAction).mockResolvedValue(ok([saleCash, saleQr]));
  });

  it("lista ventas con enlace al detalle, cajero, método y estado", () => {
    renderHistory();

    const link = screen.getByRole("link", { name: "#101" });
    expect(link).toHaveAttribute("href", "/ventas/sale-1");
    expect(screen.getAllByText("Carlos Mamani").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana Quispe").length).toBeGreaterThan(0);
    expect(screen.getByText("Pagada")).toBeInTheDocument();
    expect(screen.getByText("Anulada")).toBeInTheDocument();
    expect(screen.getByText("Bs 30,00")).toBeInTheDocument();
  });

  it("filtra por método de pago y actualiza la lista", async () => {
    vi.mocked(listSalesAction).mockResolvedValue(ok([saleQr]));
    renderHistory();

    fireEvent.change(screen.getByLabelText("Filtrar por método de pago"), {
      target: { value: "qr" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() =>
      expect(listSalesAction).toHaveBeenCalledWith({ paymentMethod: "qr" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "#101" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "#102" })).toBeInTheDocument();
  });

  it("filtra por rango de fechas", async () => {
    vi.mocked(listSalesAction).mockResolvedValue(ok([saleQr]));
    renderHistory();

    fireEvent.change(screen.getByLabelText("Fecha desde"), { target: { value: "2026-11-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() =>
      expect(listSalesAction).toHaveBeenCalledWith({ dateFrom: "2026-11-01" }),
    );
  });

  it("permite filtrar por cajero solo al dueño", async () => {
    vi.mocked(listSalesAction).mockResolvedValue(ok([saleCash]));
    renderHistory();

    expect(screen.getByLabelText("Filtrar por cajero")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por cajero"), {
      target: { value: "cashier-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() =>
      expect(listSalesAction).toHaveBeenCalledWith({ cashierId: "cashier-1" }),
    );
    expect(screen.queryByRole("link", { name: "#102" })).not.toBeInTheDocument();
  });

  it("el cajero no ve el filtro de cajeros", () => {
    renderHistory(false, [saleCash]);

    expect(screen.queryByLabelText("Filtrar por cajero")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#101" })).toBeInTheDocument();
  });

  it("muestra error del servidor sin perder la lista", async () => {
    vi.mocked(listSalesAction).mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
      message: "No autorizado.",
    });
    renderHistory(true, [saleCash]);

    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("No autorizado.");
    expect(screen.getByRole("link", { name: "#101" })).toBeInTheDocument();
  });

  it("muestra estado de carga mientras busca", async () => {
    let resolve!: (value: ListResult) => void;
    vi.mocked(listSalesAction).mockReturnValue(new Promise<ListResult>((r) => (resolve = r)));
    renderHistory();

    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(screen.getByRole("status")).toHaveTextContent("Cargando ventas…");

    resolve(ok([saleCash]));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("muestra estados vacíos: sin ventas y sin resultados", async () => {
    renderHistory(true, []);
    expect(screen.getByText("Sin ventas registradas")).toBeInTheDocument();

    vi.mocked(listSalesAction).mockResolvedValue(ok([]));
    fireEvent.change(screen.getByLabelText("Filtrar por método de pago"), {
      target: { value: "cash" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(screen.getByText("Sin resultados")).toBeInTheDocument());
    expect(screen.queryByText("Sin ventas registradas")).not.toBeInTheDocument();
  });

  it("limpia los filtros y recarga la lista completa", async () => {
    renderHistory();

    fireEvent.change(screen.getByLabelText("Filtrar por estado"), { target: { value: "voided" } });
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));

    await waitFor(() => expect(listSalesAction).toHaveBeenCalledWith({}));
    expect(screen.getByLabelText("Filtrar por estado")).toHaveValue("");
  });

  it("«Cargar más» pide la siguiente página y oculta el botón al agotar", async () => {
    renderHistory(true, [saleCash], true);

    const loadMore = screen.getByRole("button", { name: "Cargar más" });
    vi.mocked(listSalesAction).mockResolvedValue(ok([saleCash, saleQr], false));
    fireEvent.click(loadMore);

    await waitFor(() => expect(listSalesAction).toHaveBeenCalledWith({ limit: 101 }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Cargar más" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "#102" })).toBeInTheDocument();
  });
});
