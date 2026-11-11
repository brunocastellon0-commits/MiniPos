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
    expect(screen.getByLabelText(/usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ingresar a caja/i })).toBeInTheDocument();
  });

  it("muestra el logo_form y los textos de marca", () => {
    render(<LoginForm businessName="Minimarket Doña María" />);

    const logo = screen.getByRole("img", { name: "Minimarket Doña María" });
    expect(logo).toHaveAttribute("src", expect.stringContaining("logo_form.png"));

    expect(screen.getByText(/Ingresa tus credenciales/i)).toHaveTextContent(
      "Ingresa tus credenciales para acceder al sistema",
    );
    expect(screen.getByText(/Haz crecer tu negocio con/i)).toHaveTextContent(
      "Haz crecer tu negocio con LilaMarket",
    );
  });

  it("muestra errores de validación si los campos están vacíos o el usuario es inválido", async () => {
    const mockLoginFn = vi.fn();
    render(<LoginForm loginFn={mockLoginFn} />);

    // Envío con campos vacíos
    fireEvent.click(screen.getByRole("button", { name: /ingresar a caja/i }));

    expect(await screen.findByText("Ingresa tu usuario.")).toBeInTheDocument();
    expect(await screen.findByText("Ingresa tu contraseña.")).toBeInTheDocument();
    expect(mockLoginFn).not.toHaveBeenCalled();

    // Usuario inválido (muy corto)
    fireEvent.change(screen.getByLabelText(/usuario/i), {
      target: { value: "ab" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ingresar a caja/i }));

    expect(await screen.findByText(/Usuario no válido/i)).toBeInTheDocument();
    expect(mockLoginFn).not.toHaveBeenCalled();
  });

  it("muestra estado de carga mientras procesa la autenticación y se rehabilita ante fallo", async () => {
    let resolveLogin: (val: unknown) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    const mockLoginFn = vi.fn().mockReturnValue(pendingPromise);

    render(<LoginForm loginFn={mockLoginFn} />);

    fireEvent.change(screen.getByLabelText(/usuario/i), {
      target: { value: "cajero" },
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
      message: "Usuario o contraseña incorrectos.",
    });

    render(<LoginForm loginFn={mockLoginFn} />);

    fireEvent.change(screen.getByLabelText(/usuario/i), {
      target: { value: "inexistente" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "erronea" },
    });

    fireEvent.click(screen.getByRole("button", { name: /ingresar a caja/i }));

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent("Usuario o contraseña incorrectos.");
  });

  it("muestra error cuando el usuario está desactivado", async () => {
    const mockLoginFn = vi.fn().mockResolvedValue({
      ok: false,
      code: "USER_INACTIVE",
      message: "Tu usuario se encuentra inactivo. Contacta al administrador.",
    });

    render(<LoginForm loginFn={mockLoginFn} />);

    fireEvent.change(screen.getByLabelText(/usuario/i), {
      target: { value: "inactivo" },
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

    fireEvent.change(screen.getByLabelText(/usuario/i), {
      target: { value: "dueno" },
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
