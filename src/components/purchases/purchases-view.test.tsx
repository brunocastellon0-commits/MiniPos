import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPurchase, buildPurchaseItem } from "@/test/factories";
import { PurchasesView } from "./purchases-view";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  usePathname: () => "/compras",
}));

vi.mock("@/lib/actions/purchases", () => ({
  getPurchaseAction: vi.fn(),
  getPurchaseTimelineAction: vi.fn(),
  cancelPurchaseAction: vi.fn(),
  registerPurchaseVisitAction: vi.fn(),
}));

vi.mock("@/lib/actions/products", () => ({
  getProductNamesAction: vi.fn(),
}));

import {
  cancelPurchaseAction,
  getPurchaseAction,
  getPurchaseTimelineAction,
  registerPurchaseVisitAction,
} from "@/lib/actions/purchases";
import { getProductNamesAction } from "@/lib/actions/products";

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

const partial = buildPurchase({
  id: "pur-3",
  supplier_id: "sup-1",
  status: "partial",
  total_cents: 30000,
  created_at: "2026-10-30T08:00:00.000Z",
});

const supplierNames = { "sup-1": "Distribuidora Andina" };

const ok = <T,>(data: T) => ({ ok: true as const, data });

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(getPurchaseAction).mockImplementation(async ({ id }) => {
    const purchase = [ordered, received, partial].find((item) => item.id === id);
    if (!purchase) {
      return { ok: false, code: "NOT_FOUND", message: "Compra no encontrada." };
    }
    return ok({
      purchase,
      items:
        id === "pur-1"
          ? [
              buildPurchaseItem({
                purchase_id: "pur-1",
                product_id: "prod-arroz",
                qty_ordered: 10,
                qty_received: 0,
                unit_cost_cents: 900,
              }),
              buildPurchaseItem({
                purchase_id: "pur-1",
                product_id: "prod-leche",
                qty_ordered: 6,
                qty_received: 0,
                unit_cost_cents: 500,
              }),
            ]
          : [],
    });
  });

  vi.mocked(getProductNamesAction).mockResolvedValue(
    ok({ "prod-arroz": "Arroz 1kg", "prod-leche": "Leche 1L" }),
  );

  vi.mocked(getPurchaseTimelineAction).mockResolvedValue(
    ok([
      {
        id: "aud-1",
        at: "2026-11-02T10:00:00.000Z",
        action: "purchases.create",
        reason: null,
        userName: "Doña Elena",
      },
    ]),
  );

  vi.mocked(cancelPurchaseAction).mockResolvedValue(ok(buildPurchase({ id: "pur-1", status: "cancelled" })));
  vi.mocked(registerPurchaseVisitAction).mockResolvedValue(ok({ purchaseId: "pur-1" }));
});

function renderView(overrides: Partial<Parameters<typeof PurchasesView>[0]> = {}) {
  return render(
    <PurchasesView
      initialPurchases={[ordered, received, partial]}
      supplierNames={supplierNames}
      {...overrides}
    />,
  );
}

function expandFirstRow() {
  fireEvent.click(screen.getByText("Bs 120,00"));
}

describe("PurchasesView (D4)", () => {
  it("muestra contadores por estado y filtra al seleccionarlos", () => {
    renderView();

    expect(screen.getByRole("button", { name: "Todas (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pendientes (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parciales (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recibidas (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Canceladas (0)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todas (3)" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Recibidas (1)" }));
    expect(screen.getByText("Bs 550,00")).toBeInTheDocument();
    expect(screen.queryByText("Bs 120,00")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pendientes (1)" }));
    expect(screen.getByText("Bs 120,00")).toBeInTheDocument();
    expect(screen.queryByText("Bs 550,00")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Canceladas (0)" }));
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("despliega el detalle con ítems, nombres de producto e historial", async () => {
    renderView();
    expandFirstRow();

    expect(await screen.findByText("Arroz 1kg")).toBeInTheDocument();
    expect(screen.getByText("Leche 1L")).toBeInTheDocument();
    expect(screen.getByText("Historial de la compra")).toBeInTheDocument();
    expect(screen.getByText("Compra registrada")).toBeInTheDocument();
    expect(screen.getByText(/Doña Elena/)).toBeInTheDocument();

    expect(getPurchaseAction).toHaveBeenCalledWith({ id: "pur-1" });
    expect(getProductNamesAction).toHaveBeenCalledWith({ ids: ["prod-arroz", "prod-leche"] });
    expect(getPurchaseTimelineAction).toHaveBeenCalledWith({ purchaseId: "pur-1" });

    expect(screen.getByRole("link", { name: "Recibir mercadería" })).toHaveAttribute(
      "href",
      "/compras/pur-1",
    );
    expect(screen.getByRole("link", { name: "Ver página completa →" })).toHaveAttribute(
      "href",
      "/compras/pur-1",
    );
    expect(screen.getByRole("button", { name: "Cancelar compra" })).toBeInTheDocument();
  });

  it("la compra recibida no ofrece recibir ni cancelar", async () => {
    renderView();

    fireEvent.click(screen.getByText("Bs 550,00"));
    expect(await screen.findByText("Historial de la compra")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Recibir mercadería" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar compra" })).not.toBeInTheDocument();
  });

  it("cancela con motivo, exige mínimo de caracteres y actualiza el estado", async () => {
    renderView();
    expandFirstRow();

    fireEvent.click(await screen.findByRole("button", { name: "Cancelar compra" }));
    const reasonField = screen.getByLabelText(/Motivo de la cancelación/);

    fireEvent.change(reasonField, { target: { value: "ok" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelación" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "El motivo debe tener al menos 3 caracteres.",
      );
    });
    expect(cancelPurchaseAction).not.toHaveBeenCalled();

    fireEvent.change(reasonField, { target: { value: "El proveedor no tiene mercadería" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelación" }));

    await waitFor(() => {
      expect(cancelPurchaseAction).toHaveBeenCalledWith({
        purchaseId: "pur-1",
        reason: "El proveedor no tiene mercadería",
      });
    });
    expect(await screen.findByText("Compra cancelada. El stock no se modifica.")).toBeInTheDocument();
    expect(screen.getAllByText("Cancelada")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Canceladas (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pendientes (0)" })).toBeInTheDocument();
  });

  it("registra la visita del preventista", async () => {
    renderView();
    expandFirstRow();

    fireEvent.click(await screen.findByRole("button", { name: "Registrar visita" }));
    await waitFor(() => {
      expect(registerPurchaseVisitAction).toHaveBeenCalledWith({ purchaseId: "pur-1" });
    });
    expect(await screen.findByText("Visita del preventista registrada.")).toBeInTheDocument();
    expect(getPurchaseTimelineAction).toHaveBeenCalledWith({ purchaseId: "pur-1" });
  });

  it("enlaza a nueva compra y muestra proveedores como acceso independiente", () => {
    renderView();

    expect(screen.getByRole("link", { name: "Nueva compra" })).toHaveAttribute(
      "href",
      "/compras/nueva",
    );
    const suppliersSection = screen.getByRole("region", { name: "Proveedores" });
    expect(within(suppliersSection).getByRole("link", { name: "Administrar proveedores" })).toHaveAttribute(
      "href",
      "/proveedores",
    );
    expect(pushMock).not.toHaveBeenCalled();
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

  it("muestra error si el detalle no se puede cargar", async () => {
    vi.mocked(getPurchaseAction).mockResolvedValue({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "No se pudo cargar.",
    });
    renderView();
    expandFirstRow();

    expect(await screen.findByText("No se pudo cargar.")).toBeInTheDocument();
    expect(getPurchaseAction).toHaveBeenCalledWith({ id: "pur-1" });
  });
});
