import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./spinner";

describe("Spinner", () => {
  it("anuncia el estado de carga con un texto accesible", () => {
    render(<Spinner />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
  });

  it("permite personalizar la etiqueta", () => {
    render(<Spinner label="Guardando" />);

    expect(screen.getByRole("status")).toHaveTextContent("Guardando");
  });
});
