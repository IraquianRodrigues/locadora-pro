import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnvironment } from "@/config/env";
import { requireServiceRoleKey } from "@/config/server-env";

// Bypassa RLS. Reservado a processos privilegiados com autorização explícita.
// Nunca usar como cliente padrão de CRUD ou importar em componentes cliente.
export function createAdminClient() {
  const { url } = requireSupabaseEnvironment();
  return createClient(url, requireServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
