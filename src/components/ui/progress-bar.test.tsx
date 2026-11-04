import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  it("expone el porcentaje con role progressbar", () => {
    render(<ProgressBar value={5} max={10} label="Stock frente al mínimo" />);
    const bar = screen.getByRole("progressbar", { name: "Stock frente al mínimo" });
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("limita el ancho al 100% y evita divisiones por cero", () => {
    render(<ProgressBar value={20} max={10} label="Avance" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

    render(<ProgressBar value={3} max={0} label="Sin máximo" />);
    expect(screen.getByRole("progressbar", { name: "Sin máximo" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });

  it("renderiza la barra interna con el ancho calculado", () => {
    const { container } = render(<ProgressBar value={1} max={4} label="Un cuarto" />);
    const fill = container.querySelector<HTMLElement>("[style*='width: 25%']");
    expect(fill).not.toBeNull();
  });
});
