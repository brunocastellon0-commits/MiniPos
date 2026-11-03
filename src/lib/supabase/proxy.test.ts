import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { isProtectedRoute, isAuthRoute, updateSession, type ClientFactory } from "./proxy";

describe("proxy helper functions", () => {
  it("detecta rutas protegidas y sus subrutas", () => {
    expect(isProtectedRoute("/caja")).toBe(true);
    expect(isProtectedRoute("/caja/cobro")).toBe(true);
    expect(isProtectedRoute("/panel")).toBe(true);
    expect(isProtectedRoute("/productos")).toBe(true);
    expect(isProtectedRoute("/productos/123")).toBe(true);
    expect(isProtectedRoute("/ventas")).toBe(true);
    expect(isProtectedRoute("/turno")).toBe(true);
    expect(isProtectedRoute("/reportes")).toBe(true);
    expect(isProtectedRoute("/configuracion")).toBe(true);
    expect(isProtectedRoute("/usuarios")).toBe(true);

    expect(isProtectedRoute("/")).toBe(false);
    expect(isProtectedRoute("/login")).toBe(false);
    expect(isProtectedRoute("/_design")).toBe(false);
    expect(isProtectedRoute("/api/health")).toBe(false);
  });

  it("detecta rutas de autenticación", () => {
    expect(isAuthRoute("/login")).toBe(true);
    expect(isAuthRoute("/login/reset")).toBe(true);
    expect(isAuthRoute("/caja")).toBe(false);
    expect(isAuthRoute("/")).toBe(false);
  });
});

describe("updateSession", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "dummy-key-12345");
  });

  it("redirige al usuario no autenticado a /login con redirectTo si accede a ruta protegida", async () => {
    const request = new NextRequest("http://localhost:3000/caja");

    const mockFactory: ClientFactory = () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    const response = await updateSession(request, mockFactory);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("redirectTo=%2Fcaja");
  });

  it("permite el acceso si el usuario no autenticado accede a una ruta pública", async () => {
    const request = new NextRequest("http://localhost:3000/_design");

    const mockFactory: ClientFactory = () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    const response = await updateSession(request, mockFactory);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirige al usuario autenticado a /caja si intenta entrar a /login", async () => {
    const request = new NextRequest("http://localhost:3000/login");

    const mockFactory: ClientFactory = () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
    });

    const response = await updateSession(request, mockFactory);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/caja");
  });

  it("permite el acceso si el usuario autenticado accede a una ruta protegida", async () => {
    const request = new NextRequest("http://localhost:3000/caja");

    const mockFactory: ClientFactory = () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
    });

    const response = await updateSession(request, mockFactory);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("sincroniza cookies de sesión entre la petición y la respuesta", async () => {
    const request = new NextRequest("http://localhost:3000/caja");

    const mockFactory: ClientFactory = (_url, _key, options) => {
      // Simula que el cliente Supabase emite cookies refrescadas al inicializarse
      if (options?.cookies?.setAll) {
        options.cookies.setAll(
          [
            {
              name: "sb-token",
              value: "refreshed-token-abc",
              options: { path: "/", httpOnly: true },
            },
          ],
          {},
        );
      }

      return {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
      };
    };

    const response = await updateSession(request, mockFactory);

    expect(response.status).toBe(200);
    const setCookieHeader = response.headers.get("set-cookie");
    expect(setCookieHeader).toContain("sb-token=refreshed-token-abc");
  });
});
