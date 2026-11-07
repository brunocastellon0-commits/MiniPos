import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BarcodeCameraScanner } from "./barcode-camera-scanner";

class FakeBarcodeDetector {
  async detect(): Promise<Array<{ rawValue: string }>> {
    return [{ rawValue: "7891234567890" }];
  }
}

function stubCamera(getUserMedia: () => Promise<unknown>) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
}

function stubDetector() {
  Object.defineProperty(window, "BarcodeDetector", {
    configurable: true,
    value: FakeBarcodeDetector,
  });
}

function fakeStream() {
  const stop = vi.fn();
  return { getTracks: () => [{ stop }] };
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "mediaDevices");
  Reflect.deleteProperty(window, "BarcodeDetector");
  vi.restoreAllMocks();
});

describe("BarcodeCameraScanner", () => {
  it("muestra un aviso cuando el navegador no soporta la cámara", () => {
    render(<BarcodeCameraScanner onDetected={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Escanear código con la cámara" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Tu navegador no soporta acceso a la cámara.",
    );
  });

  it("muestra un aviso cuando el navegador no tiene el detector nativo", () => {
    stubCamera(() => Promise.resolve(fakeStream()));
    // Sin stub de BarcodeDetector: jsdom no lo incluye.

    render(<BarcodeCameraScanner onDetected={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Escanear código con la cámara" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Tu navegador no cuenta con BarcodeDetector nativo. Ingresa el código manualmente.",
    );
  });

  it("muestra un error cuando la cámara es rechazada por el navegador", async () => {
    stubCamera(() => Promise.reject(new Error("denied")));
    stubDetector();

    render(<BarcodeCameraScanner onDetected={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Escanear código con la cámara" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No se pudo acceder a la cámara. Verifica los permisos del navegador.",
      ),
    );
  });

  it("entrega el código detectado y cierra el diálogo", async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        setTimeout(() => cb(0), 0);
        return 1;
      });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    Object.defineProperty(HTMLVideoElement.prototype, "readyState", {
      configurable: true,
      get: () => 2,
    });
    stubCamera(() => Promise.resolve(fakeStream()));
    stubDetector();
    const onDetected = vi.fn();

    render(<BarcodeCameraScanner onDetected={onDetected} />);
    fireEvent.click(screen.getByRole("button", { name: "Escanear código con la cámara" }));

    await waitFor(() => expect(onDetected).toHaveBeenCalledWith("7891234567890"));
    expect(playSpy).toHaveBeenCalled();
    expect(rafSpy).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
