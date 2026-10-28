import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("muestra título, descripción y acción sugerida", () => {
    render(
      <EmptyState
        title="No hay productos que coincidan"
        description="Probá con otro nombre o código de barras."
        action={<button type="button">Limpiar búsqueda</button>}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No hay productos que coincidan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Probá con otro nombre o código de barras.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpiar búsqueda" })).toBeInTheDocument();
  });
});
