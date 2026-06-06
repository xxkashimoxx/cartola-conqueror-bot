const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

async function fetchFeed(url: string, source: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 PrecisaoBot/1.0' },
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
    console.error(`Erro feed ${source}:`, e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const results = await Promise.all(FEEDS.map((f) => fetchFeed(f.url, f.source)));
    const all = results.flat();

    // ordenar por data desc
    all.sort((a, b) => {
      const da = new Date(a.pubDate).getTime() || 0;
      const db = new Date(b.pubDate).getTime() || 0;
      return db - da;
    });

    return new Response(
      JSON.stringify({ success: true, news: all.slice(0, 12) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: msg, news: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
