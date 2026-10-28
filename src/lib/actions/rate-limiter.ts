interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

export class RateLimiter {
  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  check(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const record = memoryStore.get(key);

    if (!record || now > record.resetAt) {
      memoryStore.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (record.count >= this.maxRequests) {
      const retryAfterMs = Math.max(0, record.resetAt - now);
      return { allowed: false, retryAfterMs };
    }

    record.count++;
    return { allowed: true, retryAfterMs: 0 };
  }

  static reset(key?: string): void {
    if (key) {
      memoryStore.delete(key);
    } else {
      memoryStore.clear();
    }
  }
}
