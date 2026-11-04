import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./form-field";
import { Input } from "./input";

describe("FormField (E13-05)", () => {
  it("asocia la etiqueta al control y muestra la microcopia de ayuda", () => {
    render(
      <FormField id="f1" label="Nombre del producto" help="Máximo 60 caracteres.">
        {(control) => <Input id={control.id} aria-describedby={control["aria-describedby"]} />}
      </FormField>,
    );

    const input = screen.getByLabelText("Nombre del producto");
    expect(input).toHaveAttribute("id", "f1");
    expect(screen.getByText("Máximo 60 caracteres.")).toHaveAttribute("id", "f1-help");
    expect(input).toHaveAttribute("aria-describedby", "f1-help");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("coloca el error debajo del campo con aria-invalid y aria-describedby", () => {
    render(
      <FormField id="f2" label="Precio" help="Monto en bolivianos." error="El precio debe ser mayor a 0.">
        {(control) => (
          <Input id={control.id} invalid={control.invalid} aria-describedby={control["aria-describedby"]} />
        )}
      </FormField>,
    );

    const input = screen.getByLabelText("Precio");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "f2-error");

    const error = screen.getByRole("alert");
    expect(error).toHaveAttribute("id", "f2-error");
    expect(error).toHaveTextContent("El precio debe ser mayor a 0.");
    // La ayuda se reemplaza por el error para no duplicar texto.
    expect(screen.queryByText("Monto en bolivianos.")).not.toBeInTheDocument();
  });

  it("acepta un control estático sin función de render", () => {
    render(
      <FormField id="f3" label="Rol en el sistema">
        <select id="f3">
          <option>Cajero</option>
        </select>
      </FormField>,
    );

    expect(screen.getByLabelText("Rol en el sistema")).toHaveAttribute("id", "f3");
  });
});
