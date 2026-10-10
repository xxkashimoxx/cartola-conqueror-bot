// Neon backend client (parallel to legacy Supabase client during the refactor).
// Never put a PostgreSQL connection string or admin secret in VITE_* variables.
import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";

const neonUrl = import.meta.env.VITE_NEON_URL;
if (!neonUrl) {
  throw new Error("VITE_NEON_URL is required (HTTPS Neon database base URL).");
}

export const neon = createClient(neonUrl, {
  auth: { adapter: SupabaseAuthAdapter(), allowAnonymous: true },
});
