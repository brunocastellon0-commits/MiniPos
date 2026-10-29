"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import {
  DEFAULT_INACTIVITY_TIMEOUT_MS,
  INACTIVITY_WARNING_MS,
  InactivityTracker,
} from "@/lib/auth/inactivity";
import { Toast } from "@/components/ui/toast";

export interface InactivityWatcherProps {
  timeoutMs?: number;
  warningMs?: number;
}

export function InactivityWatcher({
  timeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
  warningMs = INACTIVITY_WARNING_MS,
}: InactivityWatcherProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const tracker = new InactivityTracker({
      timeoutMs,
      warningMs,
      onWarning: () => {
        setShowWarning(true);
      },
      onTimeout: async () => {
        setShowWarning(false);
        try {
          await logoutAction();
        } finally {
          router.push("/login?reason=inactivity");
        }
      },
    });

    tracker.start();

    const handleUserActivity = () => {
      tracker.recordActivity();
      setShowWarning(false);
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    return () => {
      tracker.stop();
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
    };
  }, [timeoutMs, warningMs, router]);

  if (!showWarning) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Toast
        tone="warning"
        title="Sesión por expirar"
        description="Tu sesión está por cerrarse por inactividad. Mueve el cursor o presiona una tecla para continuar."
      />
    </div>
  );
}
