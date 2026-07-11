import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_KEY = 'brasileirao_v1';
const CACHE_TTL_MS = 5 * 60 * 1000;      // 5 min: dentro disso serve do cache sem tocar RSS
const FEED_TIMEOUT_MS = 6000;             // 6s por feed pra não travar

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  image: string | null;
  source: string;
}

const FEEDS = [
  { url: 'https://pox.globo.com/rss/ge/futebol', source: 'GE' },
  { url: 'https://pox.globo.com/rss/g1/futebol/brasileirao-serie-a', source: 'g1' },
];

function decodeEntities(s: string) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripCdata(s: string) {
  return s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function pick(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? stripCdata(m[1]).trim() : '';
}

function extractImage(itemXml: string, description: string): string | null {
  // media:content / media:thumbnail
  const media = itemXml.match(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"/i);
  if (media) return media[1];
  // enclosure
  const enc = itemXml.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/i);
  if (enc) return enc[1];
  // img tag in description
  const img = description.match(/<img[^>]+src="([^"]+)"/i);
  if (img) return img[1];
  return null;
}

function stripHtml(s: string) {
  return decodeEntities(s.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

async function fetchFeed(url: string, source: string): Promise<NewsItem[]> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FEED_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 PrecisaoBot/1.0' },
      signal: ctl.signal,
    });
    if (!res.ok) {
      console.log(`Falha ao buscar ${source}: ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    return items.slice(0, 15).map((raw) => {
      const description = pick(raw, 'description');
      return {
        title: stripHtml(pick(raw, 'title')),
        link: pick(raw, 'link'),
        description: stripHtml(description).slice(0, 220),
        pubDate: pick(raw, 'pubDate'),
        image: extractImage(raw, description),
        source,
      };
    });
  } catch (e) {
    console.error(`Erro feed ${source}:`, (e as Error)?.message ?? e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

async function readCache(): Promise<{ news: NewsItem[]; fetched_at: string } | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('news_cache')
      .select('payload, fetched_at')
      .eq('cache_key', CACHE_KEY)
      .maybeSingle();
    if (!data) return null;
    const payload = data.payload as any;
    return { news: payload?.news ?? [], fetched_at: data.fetched_at as string };
  } catch (e) {
    console.error('readCache erro:', (e as Error)?.message ?? e);
    return null;
  }
}

async function writeCache(news: NewsItem[], sourceOk: boolean) {
  try {
    const supabase = getSupabase();
    await supabase.from('news_cache').upsert(
      {
        cache_key: CACHE_KEY,
        payload: { news },
        fetched_at: new Date().toISOString(),
        source_ok: sourceOk,
      },
      { onConflict: 'cache_key' },
    );
  } catch (e) {
    console.error('writeCache erro:', (e as Error)?.message ?? e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';

  // 1) TTL: se cache está fresco e não é refresh forçado, devolve direto
  if (!forceRefresh) {
    const cached = await readCache();
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
      return new Response(
        JSON.stringify({
          success: true,
          news: cached.news,
          cached: true,
          fetched_at: cached.fetched_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }
  }

  // 2) Busca ao vivo com timeout por feed
  let all: NewsItem[] = [];
  let feedError: string | null = null;
  try {
    const results = await Promise.all(FEEDS.map((f) => fetchFeed(f.url, f.source)));
    all = results.flat();
  } catch (error) {
    feedError = error instanceof Error ? error.message : 'Erro desconhecido';
  }

  all.sort((a, b) => (new Date(b.pubDate).getTime() || 0) - (new Date(a.pubDate).getTime() || 0));
  const fresh = all.slice(0, 12);

  // 3) Se nada veio → fallback para o cache (mesmo expirado)
  if (fresh.length === 0) {
    const cached = await readCache();
    if (cached && cached.news.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          news: cached.news,
          cached: true,
          stale: true,
          fetched_at: cached.fetched_at,
          fallback_reason: feedError ?? 'feeds_vazios',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }
    // Sem cache e sem feed → 200 com lista vazia (evita quebrar UI)
    return new Response(
      JSON.stringify({ success: false, news: [], error: feedError ?? 'sem_dados' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  }

  // 4) Sucesso: atualiza cache em background e devolve
  writeCache(fresh, true); // fire-and-forget
  return new Response(
    JSON.stringify({ success: true, news: fresh, cached: false, fetched_at: new Date().toISOString() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
  );
});

