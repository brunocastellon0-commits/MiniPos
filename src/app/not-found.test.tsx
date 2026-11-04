import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import NotFound from "./not-found";

describe("página 404 (E11-07)", () => {
  it("muestra la página no encontrada en español con enlace al panel", () => {
    vi.clearAllMocks();
    render(<NotFound />);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Página no encontrada" })).toBeInTheDocument();
    expect(screen.getByText(/no existe o fue movida/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver al panel" }));
    expect(push).toHaveBeenCalledWith("/panel");
  });
});
