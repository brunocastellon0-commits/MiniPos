import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { updateSession, generateCsp, type ClientFactory } from "@/lib/supabase/proxy";
import nextConfig from "../../next.config";

describe("Security Headers & CSP", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "dummy-key-12345");
  });

  it("generateCsp produce una política estricta con nonce y frame-ancestors 'none'", () => {
    const testNonce = "random-test-nonce-12345";
    const csp = generateCsp(testNonce);

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain(`'nonce-${testNonce}'`);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("updateSession aplica cabeceras de seguridad y CSP en la respuesta", async () => {
    const request = new NextRequest("http://localhost:3000/_design");

    const mockFactory: ClientFactory = () => ({
      auth: {
        getClaims: async () => ({
          data: null,
          error: null,
        }),
      },
    });

    const response = await updateSession(request, mockFactory);

    // Comprobar cabeceras críticas de seguridad
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("Permissions-Policy")).toContain("camera=(self), microphone=()");

    // Comprobar Content-Security-Policy
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it("next.config.ts define cabeceras estáticas de seguridad global", async () => {
    expect(nextConfig.headers).toBeDefined();
    if (typeof nextConfig.headers === "function") {
      const headerRules = await nextConfig.headers();
      expect(headerRules.length).toBeGreaterThan(0);

      const allRouteRule = headerRules.find((r) => r.source === "/:path*");
      expect(allRouteRule).toBeDefined();

      const headerKeys = allRouteRule?.headers.map((h) => h.key);
      expect(headerKeys).toContain("Strict-Transport-Security");
      expect(headerKeys).toContain("X-Content-Type-Options");
      expect(headerKeys).toContain("X-Frame-Options");
      expect(headerKeys).toContain("Referrer-Policy");
      expect(headerKeys).toContain("Permissions-Policy");
    }
  });
});
