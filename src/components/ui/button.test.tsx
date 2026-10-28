import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Trash2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Button, IconButton } from "./button";

describe("Button", () => {
  it("renderiza las variantes y tamaños", () => {
    render(
      <>
        <Button variant="primary">Principal</Button>
        <Button variant="secondary">Secundario</Button>
        <Button variant="ghost">Fantasma</Button>
        <Button variant="danger">Peligro</Button>
        <Button size="sm">Pequeño</Button>
        <Button size="lg">Grande</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Principal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Secundario" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fantasma" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Peligro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pequeño" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grande" })).toBeInTheDocument();
  });

  it("no dispara onClick cuando está deshabilitado", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={onClick}>
        Cobrar
      </Button>,
    );

    await user.click(screen.getByRole("button", { name: "Cobrar" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("muestra el spinner y deshabilita mientras carga", () => {
    render(<Button loading>Cobrar</Button>);

    expect(screen.getByRole("button", { name: /Cobrar/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
  });

  it("expone un nombre accesible en botones de solo ícono", () => {
    render(
      <IconButton aria-label="Eliminar producto">
        <Trash2 aria-hidden="true" />
      </IconButton>,
    );

    expect(screen.getByRole("button", { name: "Eliminar producto" })).toBeInTheDocument();
  });

  it("tiene foco visible y lo recibe al navegar con teclado", async () => {
    const user = userEvent.setup();
    render(<Button>Guardar</Button>);

    await user.tab();

    const button = screen.getByRole("button", { name: "Guardar" });
    expect(button).toHaveFocus();
    expect(button).toHaveClass("focus-visible:ring-2");
  });
});
