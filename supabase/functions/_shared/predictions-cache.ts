// Helper de cache por rodada para rotas de previsões.
// Lê/grava na tabela public.predictions_cache. Invalidado automaticamente
// por trigger quando escalacoes_usuario muda.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CacheOptions {
  cacheKey: string;
  rodada: number;
  ttlSeconds?: number; // default 300 (5min)
  forceRefresh?: boolean;
}

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function readCache(
  supabase: SupabaseClient,
  opts: CacheOptions,
): Promise<{ hit: boolean; payload: any | null; fetched_at: string | null }> {
  if (opts.forceRefresh) return { hit: false, payload: null, fetched_at: null };

  const { data, error } = await supabase
    .from("predictions_cache")
    .select("payload, fetched_at, ttl_seconds")
    .eq("cache_key", opts.cacheKey)
    .eq("rodada", opts.rodada)
    .maybeSingle();

  if (error || !data) return { hit: false, payload: null, fetched_at: null };

  const ttl = data.ttl_seconds ?? opts.ttlSeconds ?? 300;
  const ageMs = Date.now() - new Date(data.fetched_at).getTime();
  if (ageMs > ttl * 1000) {
    return { hit: false, payload: data.payload, fetched_at: data.fetched_at };
  }
  return { hit: true, payload: data.payload, fetched_at: data.fetched_at };
}

export async function writeCache(
  supabase: SupabaseClient,
  opts: CacheOptions,
  payload: unknown,
): Promise<void> {
  const ttl = opts.ttlSeconds ?? 300;
  try {
    await supabase.from("predictions_cache").upsert(
      {
        cache_key: opts.cacheKey,
        rodada: opts.rodada,
        payload,
        ttl_seconds: ttl,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "cache_key,rodada" },
    );
  } catch (e) {
    console.warn("[predictions-cache] write failed", e);
  }
}

export function shouldForceRefresh(req: Request): boolean {
  const url = new URL(req.url);
  return url.searchParams.get("refresh") === "1" ||
    url.searchParams.get("force") === "1";
}
