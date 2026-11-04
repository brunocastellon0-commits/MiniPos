import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("página 404 (E11-07)", () => {
  it("muestra la página no encontrada en español con enlace al panel", () => {
    render(<NotFound />);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Página no encontrada" })).toBeInTheDocument();
    expect(screen.getByText(/no existe o fue movida/)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Volver al panel" })).toHaveAttribute(
      "href",
      "/panel",
    );
  });
});
