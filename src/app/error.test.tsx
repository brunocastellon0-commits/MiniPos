import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RouteError from "./error";

describe("error de ruta global (E11-07)", () => {
  it("muestra mensaje en español con Reintentar y sin exponer el error interno", () => {
    const reset = vi.fn();
    render(
      <RouteError
        error={new Error('columna "cost_cents" no existe en relation "products"')}
        reset={reset}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
    expect(screen.getByText(/Tus datos no se perdieron/)).toBeInTheDocument();
    expect(screen.queryByText(/cost_cents/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
