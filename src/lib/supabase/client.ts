"use client";
// Apenas para futuras consultas públicas. Auth é mediado pelo servidor e usa cookies HttpOnly.

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnvironment } from "@/config/env";

export function createClient() {
  const { url, key } = requireSupabaseEnvironment();
  return createBrowserClient(url, key);
}
