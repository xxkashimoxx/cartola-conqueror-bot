// Neon Auth + Data API client.
// The PostgreSQL DATABASE_URL belongs only on a protected server runtime.
import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL;
if (!authUrl || !dataApiUrl) {
  throw new Error("Neon Auth and Data API URLs are required.");
}

export const neon = createClient({
  auth: { url: authUrl, adapter: SupabaseAuthAdapter(), allowAnonymous: true },
  dataApi: { url: dataApiUrl },
});
