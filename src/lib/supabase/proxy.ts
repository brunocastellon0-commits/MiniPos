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
  let response = NextResponse.next({
    request: {
      headers: request.headers,
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
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
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
    return NextResponse.redirect(loginUrl);
  }

  // 2. Redirección si usuario con sesión activa intenta ir al login
  if (isAuthenticated && isAuthRoute(pathname)) {
    const defaultAppUrl = request.nextUrl.clone();
    defaultAppUrl.pathname = "/caja";
    defaultAppUrl.search = "";
    return NextResponse.redirect(defaultAppUrl);
  }

  return response;
}
