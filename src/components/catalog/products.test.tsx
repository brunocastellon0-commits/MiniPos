import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, Product } from "@/lib/repos/types";
import { buildCategory, buildProduct } from "@/test/factories";
import { ProductsPanel } from "./products-panel";

vi.mock("@/lib/actions/products", () => ({
  listProductsAction: vi.fn(),
  createProductAction: vi.fn(),
  updateProductAction: vi.fn(),
  setProductActiveAction: vi.fn(),
}));

import {
  createProductAction,
  listProductsAction,
  setProductActiveAction,
  updateProductAction,
} from "@/lib/actions/products";

const categories: Category[] = [
  buildCategory({ id: "cat-1", name: "Abarrotes" }),
  buildCategory({ id: "cat-2", name: "Bebidas" }),
];

const arroz = buildProduct({
  id: "prod-1",
  name: "Arroz 1kg",
  barcode: "777001",
  category_id: "cat-1",
  price_cents: 1500,
  stock_qty: 10,
  min_stock: 5,
});
const coca = buildProduct({
  id: "prod-2",
  name: "Coca-Cola 2L",
  category_id: "cat-2",
  price_cents: 1200,
  stock_qty: 0,
  min_stock: 5,
});

function page(items: Product[], overrides: Partial<{ total: number; page: number; totalPages: number }> = {}) {
  return {
    ok: true as const,
    data: {
      items,
      total: overrides.total ?? items.length,
      page: overrides.page ?? 1,
      pageSize: 20,
      totalPages: overrides.totalPages ?? 1,
    },
  };
}

function renderPanel(products: Product[] = [arroz, coca], totalPages = 1) {
  return render(
    <ProductsPanel
      initialProducts={products}
      initialTotal={products.length}
      initialPage={1}
      initialTotalPages={totalPages}
      categories={categories}
    />,
  );
}

describe("ProductsPanel (E2-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listProductsAction).mockResolvedValue(page([arroz, coca]));
  });

  it("muestra productos, precios, categorías y estados de stock", () => {
    renderPanel();

    expect(screen.getByText("Arroz 1kg")).toBeInTheDocument();
    expect(screen.getByText("Bs 15,00")).toBeInTheDocument();
    expect(screen.getAllByText("Abarrotes").length).toBeGreaterThan(0);
    expect(screen.getByText("Agotado")).toBeInTheDocument();
  });

  it("muestra estado vacío sin productos", () => {
    renderPanel([], 1);
    expect(screen.getByText("Todavía no hay productos")).toBeInTheDocument();
  });

  it("crea un producto enviando el precio convertido a centavos", async () => {
    const nuevo = buildProduct({ id: "prod-3", name: "Leche entera", price_cents: 1250 });
    vi.mocked(createProductAction).mockResolvedValue({ ok: true, data: nuevo });
    vi.mocked(listProductsAction).mockResolvedValue(page([nuevo, arroz, coca]));

    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /nuevo producto/i }));
    fireEvent.change(screen.getByLabelText(/nombre del producto/i), {
      target: { value: "Leche entera" },
    });
    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "12,50" } });
    fireEvent.change(screen.getByLabelText(/stock actual/i), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => {
      expect(createProductAction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Leche entera",
          priceCents: 1250,
          stockQty: 7,
          costCents: null,
        }),
      );
      expect(screen.getByText("Producto guardado.")).toBeInTheDocument();
    });
  });

  it("advierte si el precio no es válido y no envía la acción", async () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /nuevo producto/i }));
    fireEvent.change(screen.getByLabelText(/nombre del producto/i), {
      target: { value: "Producto inválido" },
    });
    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => {
      expect(screen.getByText(/El precio no es válido/i)).toBeInTheDocument();
    });
    expect(createProductAction).not.toHaveBeenCalled();
  });

  it("edita un producto sin habilitar la edición del stock", async () => {
    const updated = { ...arroz, price_cents: 1800 };
    vi.mocked(updateProductAction).mockResolvedValue({ ok: true, data: updated });
    vi.mocked(listProductsAction).mockResolvedValue(page([updated, coca]));

    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Editar Arroz 1kg" }));
    expect(screen.getByLabelText(/stock actual/i)).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "18,00" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(updateProductAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: "prod-1", priceCents: 1800 }),
      );
    });
  });

  it("activa o desactiva productos y filtra por estado", async () => {
    vi.mocked(setProductActiveAction).mockResolvedValue({ ok: true, data: { ...coca, active: false } });

    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Desactivar Coca-Cola 2L" }));
    await waitFor(() => {
      expect(setProductActiveAction).toHaveBeenCalledWith({ id: "prod-2", active: false });
    });

    fireEvent.change(screen.getByLabelText(/filtrar por estado/i), { target: { value: "low" } });
    await waitFor(() => {
      expect(listProductsAction).toHaveBeenCalledWith(
        expect.objectContaining({ status: "low", page: 1 }),
      );
    });
  });

  it("pagina resultados", async () => {
    vi.mocked(listProductsAction).mockResolvedValue(page([coca], { page: 2, totalPages: 2, total: 3 }));

    renderPanel([arroz], 2);
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    await waitFor(() => {
      expect(listProductsAction).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });
  });
});
