import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabaseEnvironment } from "@/config/env";
import { authConfig, authConfigured } from "@/lib/auth/config";
import { AccessError, verifiedStaff } from "@/lib/auth/session";
import { canAccess, permissionForPath } from "@/lib/auth/security";
import { authErrorResponse } from "@/lib/auth/api-error";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const api = path.startsWith("/api/v1/admin");
  const protectedPath = api || path.startsWith("/admin");
  function finish(next: NextResponse) {
    for (const cookie of response.cookies.getAll()) next.cookies.set(cookie);
    next.headers.set("Cache-Control", "private, no-store, max-age=0");
    next.headers.set("Pragma", "no-cache");
    next.headers.set("Expires", "0");
    next.headers.set("Referrer-Policy", "no-referrer");
    next.headers.set("Vary", "Cookie");
    return next;
  }
  try {
    if (!authConfigured()) throw new AccessError(503);
    const { url, key } = requireSupabaseEnvironment();
    const client = createServerClient(url, key, {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: authConfig().secure,
        path: "/",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values, cacheHeaders) => {
          const previous = response.cookies.getAll();
          for (const { name, value } of values)
            request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const cookie of previous) response.cookies.set(cookie);
          for (const { name, value, options } of values)
            response.cookies.set(name, value, options);
          for (const [name, value] of Object.entries(cacheHeaders))
            response.headers.set(name, value);
        },
      },
    });
    if (protectedPath) {
      const staff = await verifiedStaff(client);
      const permission = permissionForPath(
        api ? path.replace("/api/v1", "") : path,
      );
      if (!canAccess(staff.permissions, permission)) throw new AccessError(403);
    } else {
      // Renovação também nas telas Auth; não usa getSession para autorizar.
      await client.auth.getUser();
    }
  } catch (error) {
    if (protectedPath) {
      const status = error instanceof AccessError ? error.status : 503;
      if (api) return finish(authErrorResponse(status));
      if (status === 403)
        return finish(
          NextResponse.rewrite(new URL("/acesso-negado", request.url), {
            status: 403,
          }),
        );
      const login = new URL("/login", request.url);
      login.searchParams.set("next", path);
      return finish(NextResponse.redirect(login));
    }
  }
  return finish(response);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/v1/admin/:path*",
    "/login",
    "/recuperar-senha",
    "/atualizar-senha",
    "/auth/:path*",
  ],
};
