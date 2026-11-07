"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export interface BarcodeCameraScannerProps {
  onDetected: (barcode: string) => void;
  buttonLabel?: string;
}

export function BarcodeCameraScanner({
  onDetected,
  buttonLabel = "Escanear",
}: BarcodeCameraScannerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Capacidades derivadas del entorno (sin setState): se evalúan al renderizar.
  const cameraAvailable =
    typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const detectorAvailable = typeof window !== "undefined" && "BarcodeDetector" in window;
  const unsupportedReason = !cameraAvailable
    ? "Tu navegador no soporta acceso a la cámara."
    : !detectorAvailable
      ? "Tu navegador no cuenta con BarcodeDetector nativo. Ingresa el código manualmente."
      : null;

  const stopStream = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleClose = () => {
    stopStream();
    setOpen(false);
    setError(null);
  };

  const handleOpen = () => {
    setError(null);
    setOpen(true);
  };

  // Todas las actualizaciones de estado ocurren dentro de callbacks de
  // promesa (nunca en forma síncrona dentro del effect), cumpliendo la regla
  // react-hooks/set-state-in-effect.
  const startScanning = () => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {
            setError("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
          });
        }

        // Detector de código de barras nativo
        // @ts-expect-error BarcodeDetector native API
        const barcodeDetector = new window.BarcodeDetector();

        const scanLoop = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            animFrameRef.current = requestAnimationFrame(scanLoop);
            return;
          }

          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0]?.rawValue) {
              const code = barcodes[0].rawValue;
              stopStream();
              setOpen(false);
              onDetected(code);
              return;
            }
          } catch {
            // Continúa escaneando
          }

          animFrameRef.current = requestAnimationFrame(scanLoop);
        };

        animFrameRef.current = requestAnimationFrame(scanLoop);
      })
      .catch(() => {
        setError("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
      });
  };

  useEffect(() => {
    if (open && !unsupportedReason) {
      startScanning();
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleOpen}
        className="flex items-center gap-1.5 whitespace-nowrap"
        aria-label="Escanear código con la cámara"
      >
        <Camera className="size-4" aria-hidden="true" />
        <span>{buttonLabel}</span>
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        title="Escanear código de barras"
        description="Apunta la cámara del dispositivo hacia el código de barras del producto."
        footer={
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cerrar
          </Button>
        }
      >
        <div className="space-y-3">
          {error ?? unsupportedReason ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error ?? unsupportedReason}</span>
            </div>
          ) : null}

          <div className="relative mx-auto aspect-video max-h-64 w-full overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {!unsupportedReason && !error && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-32 w-48 rounded-lg border-2 border-primary border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
