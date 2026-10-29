import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MfaBanner } from "./mfa-banner";
import { MfaSetupDialog } from "./mfa-setup-dialog";
import { MfaVerifyForm } from "./mfa-verify-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Componentes UI de MFA (E1-06)", () => {
  describe("MfaBanner", () => {
    it("muestra banner de recomendación cuando 2FA no está activo", () => {
      render(<MfaBanner isMfaEnabled={false} />);

      expect(screen.getByText(/recomendación de seguridad: activa 2fa/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /configurar 2fa/i })).toBeInTheDocument();
    });

    it("muestra indicador de protección activa cuando 2FA está configurado", () => {
      render(<MfaBanner isMfaEnabled={true} />);

      expect(screen.getByText(/autenticación en dos pasos activada/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /configurar 2fa/i })).not.toBeInTheDocument();
    });
  });

  describe("MfaSetupDialog", () => {
    const mockEnroll = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        factorId: "factor-xyz",
        qrCode: "data:image/svg+xml;base64,mockqr",
        secret: "ABCDEF123456",
        uri: "otpauth://totp/mock",
      },
    });

    it("carga y muestra el código QR y la clave secreta al abrirse", async () => {
      render(<MfaSetupDialog open={true} onOpenChange={vi.fn()} enrollFn={mockEnroll} />);

      expect(
        await screen.findByRole("heading", {
          name: /configurar autenticación en dos pasos/i,
        }),
      ).toBeInTheDocument();
      expect(await screen.findByText("ABCDEF123456")).toBeInTheDocument();
      expect(screen.getByAltText(/código qr para autenticación/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /verificar y activar/i })).toBeDisabled();
    });

    it("habilita el botón con 6 dígitos y ejecuta verificación", async () => {
      const mockVerify = vi.fn().mockResolvedValue({
        ok: true,
        data: { verified: true },
      });

      render(
        <MfaSetupDialog
          open={true}
          onOpenChange={vi.fn()}
          enrollFn={mockEnroll}
          verifyFn={mockVerify}
        />,
      );

      const input = await screen.findByLabelText(/código de 6 dígitos/i);
      fireEvent.change(input, { target: { value: "654321" } });

      const submitBtn = screen.getByRole("button", {
        name: /verificar y activar/i,
      });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockVerify).toHaveBeenCalledWith({
          factorId: "factor-xyz",
          code: "654321",
        });
      });
      expect(await screen.findByText(/¡2fa activado con éxito!/i)).toBeInTheDocument();
    });
  });

  describe("MfaVerifyForm", () => {
    it("muestra el campo para el código y ejecuta el login 2FA", async () => {
      const mockVerifyLogin = vi.fn().mockResolvedValue({
        ok: true,
        data: { redirectUrl: "/panel" },
      });
      const mockSuccess = vi.fn();

      render(
        <MfaVerifyForm
          factorId="factor-xyz"
          verifyLoginFn={mockVerifyLogin}
          onSuccess={mockSuccess}
        />,
      );

      expect(
        screen.getByRole("heading", { name: /verificación en dos pasos/i }),
      ).toBeInTheDocument();

      const input = screen.getByLabelText(/código de seguridad/i);
      fireEvent.change(input, { target: { value: "123456" } });

      const submitBtn = screen.getByRole("button", {
        name: /confirmar e ingresar/i,
      });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockVerifyLogin).toHaveBeenCalledWith({
          factorId: "factor-xyz",
          code: "123456",
        });
        expect(mockSuccess).toHaveBeenCalledWith("/panel");
      });
    });
  });
});
