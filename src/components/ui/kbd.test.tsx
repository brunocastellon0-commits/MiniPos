import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Kbd } from "./kbd";

describe("Kbd", () => {
  it("renderiza un atajo con el elemento semántico kbd", () => {
    render(<Kbd>F2</Kbd>);

    const kbd = screen.getByText("F2");
    expect(kbd.tagName).toBe("KBD");
  });
});
