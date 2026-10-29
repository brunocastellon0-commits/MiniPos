export const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos por defecto
export const INACTIVITY_WARNING_MS = 60 * 1000; // Aviso 1 minuto antes

export interface InactivityConfig {
  timeoutMs?: number;
  warningMs?: number;
  onTimeout: () => void | Promise<void>;
  onWarning?: () => void;
}

export class InactivityTracker {
  private lastActivity: number;
  private timeoutMs: number;
  private warningMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private warned = false;
  private onTimeout: () => void | Promise<void>;
  private onWarning?: () => void;

  constructor(config: InactivityConfig) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS;
    this.warningMs = config.warningMs ?? INACTIVITY_WARNING_MS;
    this.onTimeout = config.onTimeout;
    this.onWarning = config.onWarning;
    this.lastActivity = Date.now();
  }

  start(): void {
    if (this.timer) return;
    this.lastActivity = Date.now();
    this.warned = false;

    this.timer = setInterval(() => {
      this.tick();
    }, 1000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  recordActivity(): void {
    this.lastActivity = Date.now();
    this.warned = false;
  }

  tick(currentTime = Date.now()): void {
    const elapsed = currentTime - this.lastActivity;

    if (elapsed >= this.timeoutMs) {
      this.stop();
      this.onTimeout();
      return;
    }

    if (!this.warned && this.onWarning && elapsed >= this.timeoutMs - this.warningMs) {
      this.warned = true;
      this.onWarning();
    }
  }

  getLastActivity(): number {
    return this.lastActivity;
  }
}
