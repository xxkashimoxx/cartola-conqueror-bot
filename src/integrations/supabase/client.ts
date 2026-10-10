// Compatibility entry point: the app still imports "supabase" while Neon replaces it.
// Database queries and authentication use Neon Auth + Neon Data API.
import { neon } from "@/integrations/neon/client";

type InvokeOptions = { body?: unknown; headers?: Record<string, string> };
async function invoke(name: string, options: InvokeOptions = {}) {
  try {
    const { data: { session } } = await neon.auth.getSession();
    const response = await fetch("/api/cartola?name=" + encodeURIComponent(name), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: "Bearer " + session.access_token } : {}),
        ...options.headers,
      },
      body: JSON.stringify(options.body || {}),
    });
    const data = await response.json();
    if (!response.ok) {
      return { data: null, error: new Error(data.error || "Falha na API (" + response.status + ")") };
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Falha de rede") };
  }
}
// The SDK exposes the Supabase-compatible auth adapter and PostgREST query builder.
// Keep the old import name temporarily to avoid a risky all-at-once component rewrite.
export const supabase: any = Object.assign(neon, { functions: { invoke } });
