import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

export const PROTECTED_ROUTES = [
  "/caja",
  "/panel",
  "/ventas",
  "/turno",
  "/productos",
  "/inventario",
  "/compras",
  "/reportes",
  "/configuracion",
  "/usuarios",
];

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isAuthRoute(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

export function generateCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? `'self' 'unsafe-eval' 'nonce-${nonce}'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function applySecurityHeaders(response: NextResponse, nonce?: string): void {
  if (nonce) {
    const csp = generateCsp(nonce);
    response.headers.set("Content-Security-Policy", csp);
  }
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  );
}

export type ClientFactory = (
  url: string,
  key: string,
  options: Parameters<typeof createServerClient<Database>>[2],
) => {
  auth: {
    getClaims: () => Promise<{
      data: { claims: Record<string, unknown> } | null;
      error: unknown | null;
    }>;
  };
};

export async function updateSession(
  request: NextRequest,
  clientFactory?: ClientFactory,
): Promise<NextResponse> {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const csp = generateCsp(nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const { url, key } = getSupabaseEnv();
  const createClient = clientFactory || createServerClient<Database>;

  const supabase = createClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        if (headers) {
          Object.entries(headers).forEach(([headerKey, value]) => {
            response.headers.set(headerKey, value);
          });
        }
      },
    },
  });

  // REGLA FUNDAMENTAL DE SEGURIDAD (Supabase SSR):
  // No ejecutar ninguna lógica entre crear el cliente y getClaims()
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;
  const isAuthenticated = !error && Boolean(claims);

  const pathname = request.nextUrl.pathname;

  // 1. Redirección si usuario sin sesión intenta acceder a una ruta privada
  if (!isAuthenticated && isProtectedRoute(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    applySecurityHeaders(redirectResponse, nonce);
    return redirectResponse;
  }

  // 2. Redirección si usuario con sesión activa intenta ir al login
  if (isAuthenticated && isAuthRoute(pathname)) {
    const defaultAppUrl = request.nextUrl.clone();
    defaultAppUrl.pathname = "/caja";
    defaultAppUrl.search = "";
    const redirectResponse = NextResponse.redirect(defaultAppUrl);
    applySecurityHeaders(redirectResponse, nonce);
    return redirectResponse;
  }

  applySecurityHeaders(response, nonce);
  return response;
}
