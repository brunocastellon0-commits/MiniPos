import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

describe("Card", () => {
  it("compone cabecera, contenido y pie", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Coca-Cola 2 L</CardTitle>
          <CardDescription>Bebidas · 12 disponibles</CardDescription>
        </CardHeader>
        <CardContent>Bs 12,50</CardContent>
        <CardFooter>Acciones</CardFooter>
      </Card>,
    );

    expect(screen.getByRole("heading", { name: "Coca-Cola 2 L" })).toBeInTheDocument();
    expect(screen.getByText("Bebidas · 12 disponibles")).toBeInTheDocument();
    expect(screen.getByText("Bs 12,50")).toBeInTheDocument();
    expect(screen.getByText("Acciones")).toBeInTheDocument();
  });
});
