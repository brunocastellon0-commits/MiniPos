import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renderiza todos los tonos con su texto", () => {
    render(
      <>
        <Badge>Neutro</Badge>
        <Badge tone="success">Caja abierta</Badge>
        <Badge tone="warning">Stock bajo</Badge>
        <Badge tone="danger">Agotado</Badge>
        <Badge tone="info">Pausada</Badge>
        <Badge tone="accent">Nueva</Badge>
      </>,
    );

    for (const text of ["Neutro", "Caja abierta", "Stock bajo", "Agotado", "Pausada", "Nueva"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });
});
