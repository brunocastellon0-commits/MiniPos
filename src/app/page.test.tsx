import { describe, expect, it, vi } from "vitest";
import Home from "./page";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

describe("Home", () => {
  it("redirige a /login", () => {
    Home();
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
