import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/repos/types";
import { buildCategory } from "@/test/factories";
import { CategoriesPanel } from "./categories-panel";

vi.mock("@/lib/actions/categories", () => ({
  createCategoryAction: vi.fn(),
  updateCategoryAction: vi.fn(),
  reorderCategoriesAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
}));

import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  updateCategoryAction,
} from "@/lib/actions/categories";

const abarrotes = buildCategory({ id: "cat-1", name: "Abarrotes", sort_order: 0 });
const bebidas = buildCategory({ id: "cat-2", name: "Bebidas", sort_order: 1 });

describe("CategoriesPanel (E2-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra las categorías y el estado vacío", () => {
    const { unmount } = render(<CategoriesPanel initialCategories={[abarrotes, bebidas]} />);

    expect(screen.getByText("Abarrotes")).toBeInTheDocument();
    expect(screen.getAllByText("Activa")).toHaveLength(2);

    unmount();
    render(<CategoriesPanel initialCategories={[]} />);
    expect(screen.getByText("Todavía no hay categorías")).toBeInTheDocument();
  });

  it("crea una categoría desde el diálogo", async () => {
    const nueva = buildCategory({ id: "cat-3", name: "Lácteos", sort_order: 2 });
    vi.mocked(createCategoryAction).mockResolvedValue({ ok: true, data: nueva });

    render(<CategoriesPanel initialCategories={[abarrotes]} />);

    fireEvent.click(screen.getByRole("button", { name: /nueva categoría/i }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Lácteos" } });
    fireEvent.click(screen.getByRole("button", { name: /crear categoría/i }));

    await waitFor(() => {
      expect(createCategoryAction).toHaveBeenCalledWith({ name: "Lácteos", sortOrder: undefined, active: true });
      expect(screen.getByText("Lácteos")).toBeInTheDocument();
    });
  });

  it("desactiva una categoría y reordena con los botones", async () => {
    const inactive = { ...abarrotes, active: false };
    vi.mocked(updateCategoryAction).mockResolvedValue({ ok: true, data: inactive });
    vi.mocked(reorderCategoriesAction).mockResolvedValue({
      ok: true,
      data: [
        { ...bebidas, sort_order: 0 },
        { ...abarrotes, sort_order: 1 },
      ],
    });

    render(<CategoriesPanel initialCategories={[abarrotes, bebidas]} />);

    fireEvent.click(screen.getByRole("button", { name: "Desactivar Abarrotes" }));
    await waitFor(() => {
      expect(updateCategoryAction).toHaveBeenCalledWith({ id: "cat-1", active: false });
      expect(screen.getByText("Inactiva")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bajar Abarrotes" }));
    await waitFor(() => {
      expect(reorderCategoriesAction).toHaveBeenCalledWith({ ids: ["cat-2", "cat-1"] });
    });
  });

  it("muestra el motivo cuando no se puede eliminar una categoría con productos", async () => {
    vi.mocked(deleteCategoryAction).mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      message: "La categoría tiene productos asociados. Desactívala o reasigna sus productos.",
    });

    render(<CategoriesPanel initialCategories={[abarrotes]} />);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Abarrotes" }));
    fireEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/La categoría tiene productos asociados/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Abarrotes")).toBeInTheDocument();
  });
});
