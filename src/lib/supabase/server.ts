import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnvironment } from "@/config/env";
import { authConfig } from "@/lib/auth/config";

// Server Components leem a sessão renovada pelo proxy; actions/handlers escrevem cookies.
export async function createClient(writable = false) {
  const { url, key } = requireSupabaseEnvironment();
  const store = await cookies();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: authConfig().secure,
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        if (writable)
          for (const { name, value, options } of values)
            store.set(name, value, options);
      },
    },
  });
}
