import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("se asocia a una etiqueta y acepta texto", async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="buscar">Buscar producto</label>
        <Input id="buscar" />
      </>,
    );

    const input = screen.getByLabelText("Buscar producto");
    await user.type(input, "Coca-Cola");

    expect(input).toHaveValue("Coca-Cola");
  });

  it("marca el estado inválido con aria-invalid y borde de error", () => {
    render(<Input aria-label="Precio" invalid />);

    const input = screen.getByLabelText("Precio");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("border-danger");
  });

  it("respeta el estado deshabilitado", () => {
    render(<Input aria-label="Usuario" disabled />);

    expect(screen.getByLabelText("Usuario")).toBeDisabled();
  });

  it("tiene foco visible por teclado", async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Código" />);

    await user.tab();

    const input = screen.getByLabelText("Código");
    expect(input).toHaveFocus();
    expect(input).toHaveClass("focus-visible:ring-2");
  });
});
