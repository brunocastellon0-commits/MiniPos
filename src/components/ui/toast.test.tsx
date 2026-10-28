import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Toast } from "./toast";

describe("Toast", () => {
  it("se anuncia como estado con aria-live polite", () => {
    render(<Toast tone="success" title="Venta registrada" description="Se descontó el stock." />);

    const toast = screen.getByRole("status");
    expect(toast).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Venta registrada")).toBeInTheDocument();
    expect(screen.getByText("Se descontó el stock.")).toBeInTheDocument();
  });
});
