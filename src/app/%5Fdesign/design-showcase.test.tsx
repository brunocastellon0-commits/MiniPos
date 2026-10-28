import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DesignShowcase } from "./design-showcase";

describe("DesignShowcase", () => {
  it("muestra todas las secciones del sistema de diseño", () => {
    render(<DesignShowcase />);

    for (const section of [
      "Colores",
      "Tipografía",
      "Botones",
      "Formularios",
      "Badges",
      "Card",
      "Estados",
      "Diálogo",
      "Atajos",
    ]) {
      expect(screen.getByRole("heading", { name: section })).toBeInTheDocument();
    }
  });

  it("abre y cierra el diálogo de demostración", async () => {
    const user = userEvent.setup();
    render(<DesignShowcase />);

    await user.click(screen.getByRole("button", { name: "Abrir diálogo" }));
    const dialog = screen.getByRole("dialog", { name: "Anular venta" });
    expect(dialog).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
