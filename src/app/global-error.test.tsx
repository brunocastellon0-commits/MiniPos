import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

describe("global-error (E11-07)", () => {
  it("muestra la página 500 en español y ofrece reintentar sin exponer detalles", () => {
    const reset = vi.fn();
    render(
      <GlobalError
        error={new Error("syntax error at or near \"DROP\"")}
        reset={reset}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("No se pudo iniciar la aplicación")).toBeInTheDocument();
    expect(screen.getByText(/Tus datos no se perdieron/)).toBeInTheDocument();
    expect(screen.queryByText(/DROP/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
