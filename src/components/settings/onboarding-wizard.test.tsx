import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openCashSessionAction } from "@/lib/actions/cash";
import { createCategoryAction } from "@/lib/actions/categories";
import { importProductsCsvAction } from "@/lib/actions/products-csv";
import { updateBusinessSettingsAction } from "@/lib/actions/settings";
import { buildBusinessSettings, buildCashSession, buildCategory } from "@/test/factories";
import { OnboardingWizard } from "./onboarding-wizard";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/actions/settings", () => ({
  updateBusinessSettingsAction: vi.fn(),
}));

vi.mock("@/lib/actions/categories", () => ({
  createCategoryAction: vi.fn(),
}));

vi.mock("@/lib/actions/products-csv", () => ({
  importProductsCsvAction: vi.fn(),
}));

vi.mock("@/lib/actions/cash", () => ({
  openCashSessionAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const settings = buildBusinessSettings({
  name: "Minimarket Los Pinos",
  legal_name: "Los Pinos S.R.L.",
  currency_code: "BOB",
  currency_symbol: "Bs",
  allow_negative_stock: false,
  cashier_can_discount: true,
  low_stock_default: 4,
});

const newCategory = buildCategory({ id: "cat-1", name: "Bebidas" });
const newSession = buildCashSession({ id: "session-1" });

function renderWizard() {
  return render(<OnboardingWizard initialSettings={settings} />);
}

async function goThroughBusinessStep() {
  vi.mocked(updateBusinessSettingsAction).mockResolvedValue({ ok: true, data: settings });
  renderWizard();
  fireEvent.click(screen.getByRole("button", { name: "Guardar y continuar" }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Categorías" })).toBeInTheDocument(),
  );
}

describe("OnboardingWizard (E10-03)", () => {
  it("muestra el paso de negocio con los datos precargados y el paso actual", () => {
    renderWizard();

    expect(screen.getByLabelText("Nombre del negocio")).toHaveValue("Minimarket Los Pinos");
    expect(screen.getByLabelText("Razón social")).toHaveValue("Los Pinos S.R.L.");
    expect(screen.getByLabelText("Código de moneda")).toHaveValue("BOB");
    expect(screen.getByText("1. Negocio").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("2. Categorías").closest("li")).not.toHaveAttribute("aria-current");
  });

  it("guarda el negocio con las preferencias intactas y avanza de paso", async () => {
    vi.mocked(updateBusinessSettingsAction).mockResolvedValue({ ok: true, data: settings });
    renderWizard();

    fireEvent.change(screen.getByLabelText("Nombre del negocio"), {
      target: { value: "Minimarket Sol" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar y continuar" }));

    await waitFor(() =>
      expect(updateBusinessSettingsAction).toHaveBeenCalledWith({
        name: "Minimarket Sol",
        legal_name: "Los Pinos S.R.L.",
        currency_code: "BOB",
        currency_symbol: "Bs",
        allow_negative_stock: false,
        cashier_can_discount: true,
        cashier_max_discount_cents: 0,
        low_stock_default: 4,
      }),
    );
    expect(await screen.findByRole("heading", { name: "Categorías" })).toBeInTheDocument();
  });

  it("muestra el error del servidor sin avanzar de paso", async () => {
    vi.mocked(updateBusinessSettingsAction).mockResolvedValue({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "El nombre debe tener al menos 2 caracteres.",
    });
    renderWizard();

    fireEvent.change(screen.getByLabelText("Nombre del negocio"), {
      target: { value: "A" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar y continuar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("El nombre debe tener al menos 2 caracteres.");
    expect(screen.queryByRole("heading", { name: "Categorías" })).not.toBeInTheDocument();
  });

  it("exige al menos una categoría antes de continuar y la agrega", async () => {
    await goThroughBusinessStep();

    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();

    vi.mocked(createCategoryAction).mockResolvedValue({
      ok: true,
      data: newCategory,
    });
    fireEvent.change(screen.getByLabelText("Nombre de la categoría"), {
      target: { value: "Bebidas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => expect(createCategoryAction).toHaveBeenCalledWith({ name: "Bebidas" }));
    expect(await screen.findByLabelText("Categorías creadas")).toHaveTextContent("Bebidas");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("heading", { name: "Productos (CSV)" })).toBeInTheDocument();
  });

  it("importa el CSV, muestra errores por fila y permite continuar u omitir", async () => {
    await goThroughBusinessStep();
    vi.mocked(createCategoryAction).mockResolvedValue({
      ok: true,
      data: newCategory,
    });
    fireEvent.change(screen.getByLabelText("Nombre de la categoría"), {
      target: { value: "Bebidas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    await waitFor(() => expect(createCategoryAction).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("button", { name: "Importar productos" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Contenido del CSV"), {
      target: { value: "nombre,precio\nCoca,12.50" },
    });
    vi.mocked(importProductsCsvAction).mockResolvedValue({
      ok: true,
      data: { imported: 1, errors: [] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importar productos" }));

    await waitFor(() => expect(importProductsCsvAction).toHaveBeenCalled());
    expect(await screen.findByRole("status")).toHaveTextContent("Se importaron 1 productos.");

    vi.mocked(importProductsCsvAction).mockResolvedValue({
      ok: true,
      data: { imported: 0, errors: [{ line: 2, message: "Falta el precio." }] },
    });
    fireEvent.change(screen.getByLabelText("Contenido del CSV"), {
      target: { value: "nombre,precio\nMalo," },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importar productos" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Falta el precio.");

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("heading", { name: "Saldo inicial de caja" })).toBeInTheDocument();
  });

  it("abre la caja con el saldo inicial y finaliza", async () => {
    await goThroughBusinessStep();
    vi.mocked(createCategoryAction).mockResolvedValue({
      ok: true,
      data: newCategory,
    });
    fireEvent.change(screen.getByLabelText("Nombre de la categoría"), {
      target: { value: "Bebidas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    await waitFor(() => expect(createCategoryAction).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    fireEvent.change(screen.getByLabelText(/Saldo inicial/), { target: { value: "150.50" } });
    vi.mocked(openCashSessionAction).mockResolvedValue({
      ok: true,
      data: newSession,
    });
    fireEvent.click(screen.getByRole("button", { name: "Abrir caja y finalizar" }));

    await waitFor(() =>
      expect(openCashSessionAction).toHaveBeenCalledWith({ openingCents: 15050 }),
    );
    expect(
      await screen.findByRole("heading", { name: "Configuración inicial lista" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a la caja" })).toHaveAttribute("href", "/caja");
    expect(screen.getByRole("link", { name: "Ir al panel" })).toHaveAttribute("href", "/panel");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("permite omitir el saldo inicial y terminar", async () => {
    await goThroughBusinessStep();
    vi.mocked(createCategoryAction).mockResolvedValue({
      ok: true,
      data: newCategory,
    });
    fireEvent.change(screen.getByLabelText("Nombre de la categoría"), {
      target: { value: "Bebidas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    await waitFor(() => expect(createCategoryAction).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    fireEvent.click(screen.getByRole("button", { name: "Omitir" }));

    expect(
      screen.getByRole("heading", { name: "Configuración inicial lista" }),
    ).toBeInTheDocument();
    expect(openCashSessionAction).not.toHaveBeenCalled();
  });
});
