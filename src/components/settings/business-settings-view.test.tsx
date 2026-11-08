import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateBusinessSettingsAction } from "@/lib/actions/settings";
import { buildBusinessSettings } from "@/test/factories";
import { BusinessSettingsView } from "./business-settings-view";

vi.mock("@/lib/actions/settings", () => ({
  updateBusinessSettingsAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const settings = buildBusinessSettings();

function renderView(overrides: Partial<Parameters<typeof BusinessSettingsView>[0]> = {}) {
  return render(<BusinessSettingsView initialSettings={settings} {...overrides} />);
}

describe("BusinessSettingsView (E10-01)", () => {
  it("muestra los datos actuales del negocio sin formulario de logo", () => {
    renderView();

    expect(screen.getByLabelText("Nombre del negocio")).toHaveValue("Minimarket Los Pinos");
    expect(screen.getByLabelText("Razón social")).toHaveValue("Los Pinos S.R.L.");
    expect(screen.getByLabelText("Código de moneda")).toHaveValue("BOB");
    expect(screen.getByLabelText("Símbolo de moneda")).toHaveValue("Bs");
    expect(screen.queryByLabelText("URL del logo")).not.toBeInTheDocument();
  });

  it("guarda los cambios y muestra confirmación", async () => {
    const saved = buildBusinessSettings({ name: "Minimarket Sol" });
    vi.mocked(updateBusinessSettingsAction).mockResolvedValue({ ok: true, data: saved });
    renderView();

    fireEvent.change(screen.getByLabelText("Nombre del negocio"), {
      target: { value: "Minimarket Sol" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(updateBusinessSettingsAction).toHaveBeenCalledWith({
        name: "Minimarket Sol",
        legal_name: "Los Pinos S.R.L.",
        currency_code: "BOB",
        currency_symbol: "Bs",
        allow_negative_stock: false,
        cashier_can_discount: false,
        cashier_max_discount_cents: 0,
        low_stock_default: 5,
        operating_mode: "micromarket",
        enable_held_sales: true,
        order_charge_timing: "on_order",
      }),
    );
    expect(await screen.findByText("Configuración guardada.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nombre del negocio"), {
      target: { value: "Otro" },
    });
    expect(screen.queryByText("Configuración guardada.")).not.toBeInTheDocument();
  });

  it("muestra las preferencias de operación y las envía al guardar (E10-02)", async () => {
    vi.mocked(updateBusinessSettingsAction).mockResolvedValue({
      ok: true,
      data: buildBusinessSettings({
        allow_negative_stock: true,
        cashier_can_discount: true,
        low_stock_default: 2,
      }),
    });
    renderView();

    expect(
      screen.getByRole("checkbox", { name: /Permitir stock negativo/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /El cajero puede aplicar descuentos/ }),
    ).not.toBeChecked();
    expect(screen.getByLabelText("Stock bajo por defecto")).toHaveValue(5);
    expect(screen.getByLabelText("Descuento máximo del cajero")).toHaveValue("0.00");

    fireEvent.click(screen.getByRole("checkbox", { name: /Permitir stock negativo/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /El cajero puede aplicar descuentos/ }),
    );
    fireEvent.change(screen.getByLabelText("Stock bajo por defecto"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Descuento máximo del cajero"), {
      target: { value: "25,50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(updateBusinessSettingsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          allow_negative_stock: true,
          cashier_can_discount: true,
          low_stock_default: 2,
          cashier_max_discount_cents: 2550,
        }),
      ),
    );
  });

  it("normaliza el código de moneda a mayúsculas en el formulario", () => {
    renderView();

    const codeInput = screen.getByLabelText("Código de moneda");
    fireEvent.change(codeInput, { target: { value: "bob" } });

    expect(codeInput).toHaveValue("BOB");
  });

  it("muestra la modalidad y el interruptor de ventas pausadas", () => {
    renderView();

    expect(screen.getByLabelText("Modalidad")).toHaveValue("micromarket");
    expect(
      screen.getByRole("checkbox", { name: /Permitir ventas pausadas/ }),
    ).toBeChecked();
  });

  it("oculta el momento de cobro en micromarket y lo muestra en restaurante", () => {
    renderView();

    expect(screen.queryByLabelText("Momento de cobro")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Modalidad"), {
      target: { value: "restaurant" },
    });

    expect(screen.getByLabelText("Momento de cobro")).toHaveValue("on_order");
  });

  it("envía la modalidad, ventas pausadas y el momento de cobro al guardar", async () => {
    vi.mocked(updateBusinessSettingsAction).mockResolvedValue({
      ok: true,
      data: buildBusinessSettings({
        operating_mode: "restaurant",
        enable_held_sales: false,
        order_charge_timing: "on_consumption",
      }),
    });
    renderView();

    fireEvent.change(screen.getByLabelText("Modalidad"), {
      target: { value: "restaurant" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Permitir ventas pausadas/ }),
    );
    fireEvent.change(screen.getByLabelText("Momento de cobro"), {
      target: { value: "on_consumption" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(updateBusinessSettingsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          operating_mode: "restaurant",
          enable_held_sales: false,
          order_charge_timing: "on_consumption",
        }),
      ),
    );
    expect(await screen.findByTestId("saved-toast")).toBeInTheDocument();
  });

  it("muestra el error del servidor en role=alert", async () => {
    vi.mocked(updateBusinessSettingsAction).mockResolvedValue({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "El nombre debe tener al menos 2 caracteres.",
    });
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("El nombre debe tener al menos 2 caracteres.");
    expect(screen.queryByText("Configuración guardada.")).not.toBeInTheDocument();
  });

  it("muestra el error inicial de carga", () => {
    renderView({ initialError: "No se pudo cargar la configuración." });

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar la configuración.");
  });
});
