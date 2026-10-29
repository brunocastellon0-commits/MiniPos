import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportProductsDialog } from "./import-products-dialog";

vi.mock("@/lib/actions/products-csv", () => ({
  previewProductsCsvAction: vi.fn(),
  importProductsCsvAction: vi.fn(),
}));

import {
  importProductsCsvAction,
  previewProductsCsvAction,
} from "@/lib/actions/products-csv";

function makeFile(content: string): File {
  return new File([content], "productos.csv", { type: "text/csv" });
}

describe("ImportProductsDialog (E2-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("previsualiza el archivo y confirma la importación", async () => {
    vi.mocked(previewProductsCsvAction).mockResolvedValue({
      ok: true,
      data: {
        totalRows: 2,
        validRows: 2,
        errors: [],
        preview: [
          { line: 2, name: "Coca-Cola", categoryName: "Bebidas", priceCents: 1250, stockQty: 24 },
          { line: 3, name: "Fanta", categoryName: "Bebidas", priceCents: 1000, stockQty: 12 },
        ],
      },
    });
    vi.mocked(importProductsCsvAction).mockResolvedValue({
      ok: true,
      data: { imported: 2, errors: [] },
    });

    const onImported = vi.fn();
    render(<ImportProductsDialog open onClose={vi.fn()} onImported={onImported} />);

    expect(screen.getByRole("link", { name: /descargar plantilla/i })).toHaveAttribute(
      "href",
      "/plantilla_productos.csv",
    );

    fireEvent.change(screen.getByLabelText(/archivo csv/i), {
      target: { files: [makeFile("nombre,precio\nCoca-Cola,12.50\nFanta,10.00")] },
    });

    await waitFor(() => {
      expect(previewProductsCsvAction).toHaveBeenCalled();
      expect(screen.getByText("2 filas válidas")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /importar 2 productos/i }));

    await waitFor(() => {
      expect(importProductsCsvAction).toHaveBeenCalled();
      expect(onImported).toHaveBeenCalledWith(2);
      expect(screen.getByText(/Se importaron 2 productos/i)).toBeInTheDocument();
    });
  });

  it("bloquea la importación cuando hay errores por fila", async () => {
    vi.mocked(previewProductsCsvAction).mockResolvedValue({
      ok: true,
      data: {
        totalRows: 2,
        validRows: 1,
        errors: [{ line: 3, message: "El precio es obligatorio." }],
        preview: [
          { line: 2, name: "Coca-Cola", categoryName: "Bebidas", priceCents: 1250, stockQty: 24 },
        ],
      },
    });

    render(<ImportProductsDialog open onClose={vi.fn()} onImported={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/archivo csv/i), {
      target: { files: [makeFile("nombre,precio\nCoca-Cola,12.50\nMalo,")] },
    });

    await waitFor(() => {
      expect(screen.getByText("El precio es obligatorio.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /importar 1 productos/i })).toBeDisabled();
  });
});
