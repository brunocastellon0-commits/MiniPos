import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

// Mock de next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("LoginForm (Componente UI de Login)", () => {
  it("renderiza el estado inicial con el nombre del negocio y campos accesibles", () => {
    render(<LoginForm businessName="Minimarket Doña María" />);

    expect(screen.getByRole("heading", { name: "Minimarket Doña María" })).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ingresar a caja/i })).toBeInTheDocument();
  });

  it("muestra errores de validación si los campos están vacíos o el correo es inválido", async () => {
    const mockLoginFn = vi.fn();
    render(<LoginForm loginFn={mockLoginFn} />);

    // Envío con campos vacíos
    fireEvent.click(screen.getByRole("button", { name: /ingresar a caja/i }));

    expect(await screen.findByText("Ingresa tu correo electrónico.")).toBeInTheDocument();
    expect(await screen.findByText("Ingresa tu contraseña.")).toBeInTheDocument();
    expect(mockLoginFn).not.toHaveBeenCalled();

    // Correo inválido
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: "correo-invalido" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ingresar a caja/i }));

    expect(await screen.findByText("Ingresa un correo electrónico válido.")).toBeInTheDocument();
    expect(mockLoginFn).not.toHaveBeenCalled();
  });

  it("muestra estado de carga mientras procesa la autenticación y se rehabilita ante fallo", async () => {
    let resolveLogin: (val: unknown) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    const mockLoginFn = vi.fn().mockReturnValue(pendingPromise);

    render(<LoginForm loginFn={mockLoginFn} />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: "cajero@lilamarket.bo" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "Password123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /ingresar a caja/i }));

    // Durante la carga
    const submitBtn = screen.getByRole("button");
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent(/iniciando sesión/i);

    // Resolver con error
    await act(async () => {
      resolveLogin({
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "Error de prueba",
      });
    });

    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
      expect(submitBtn).toHaveTextContent(/ingresar a caja/i);
    });
  });

  it("muestra mensaje de error accesible cuando las credenciales son incorrectas", async () => {
    const mockLoginFn = vi.fn().mockResolvedValue({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Correo electrónico o contraseña incorrectos.",
    });

    render(<LoginForm loginFn={mockLoginFn} />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: "inexistente@lilamarket.bo" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "erronea" },
    });

    fireEvent.click(screen.getByRole("button", { name: /ingresar a caja/i }));

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent("Correo electrónico o contraseña incorrectos.");
  });

  it("muestra error cuando el usuario está desactivado", async () => {
    const mockLoginFn = vi.fn().mockResolvedValue({
      ok: false,
      code: "USER_INACTIVE",
      message: "Tu usuario se encuentra inactivo. Contacta al administrador.",
    });

    render(<LoginForm loginFn={mockLoginFn} />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: "inactivo@lilamarket.bo" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "Password123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /ingresar a caja/i }));

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toHaveTextContent(
      "Tu usuario se encuentra inactivo. Contacta al administrador.",
    );
  });

  it("invoca onSuccess con redirectUrl al autenticar satisfactoriamente", async () => {
    const mockSuccess = vi.fn();
    const mockLoginFn = vi.fn().mockResolvedValue({
      ok: true,
      data: { redirectUrl: "/caja" },
    });

    render(<LoginForm loginFn={mockLoginFn} onSuccess={mockSuccess} />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: "dueno@lilamarket.bo" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "Password123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /ingresar a caja/i }));

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith("/caja");
    });
  });
});
