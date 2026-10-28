import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("muestra la marca y el estado inicial del proyecto", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "Base del proyecto lista" })).toBeInTheDocument();
    expect(screen.getByText("LILA MARKET")).toBeInTheDocument();
  });
});
