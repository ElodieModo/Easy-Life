import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const normalizeSupabaseUrl = (url: string) => {
  const trimmedUrl = url.trim().replace(/\/+$/, "");
  return trimmedUrl.replace(/\/(?:rest|auth|storage|functions)\/v1$/i, "");
};

export function createAdminClient() {
  const rawUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceRoleKey) {
    throw new Error("Variables d'environnement manquantes: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createSupabaseClient(normalizeSupabaseUrl(rawUrl), serviceRoleKey.trim(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
