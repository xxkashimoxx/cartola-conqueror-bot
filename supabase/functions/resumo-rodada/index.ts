import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

interface ResumoRodada {
  rodada: number;
  manchete: string;
  confrontos_principais: Array<{ jogo: string; analise: string }>;
  surpresas: Array<{ titulo: string; descricao: string }>;
  escalacao_free: { resumo: string; jogadores: string[] };
  escalacao_pro: { resumo: string; jogadores: string[]; diferencial: string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY ausente');

    // Permite ?refresh=1 para ignorar cache
    const url = new URL(req.url);
    const refresh = url.searchParams.get('refresh') === '1';

    // Rodada atual
    const { data: mercado } = await supabase
      .from('mercado_status')
      .select('rodada_atual')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const rodada = mercado?.rodada_atual ?? 1;
    const cacheKey = `resumo_rodada_${rodada}`;

    // Cache em memória do worker
    // @ts-ignore
    const cache: Map<string, { at: number; data: ResumoRodada }> = (globalThis as any).__resumoCache ||= new Map();
    const cached = cache.get(cacheKey);
    if (!refresh && cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) {
      return new Response(JSON.stringify({ success: true, cached: true, ...cached.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Confrontos da rodada com nomes dos clubes
    const { data: partidas } = await supabase
      .from('partidas')
      .select('rodada, data_partida, time_casa_id, time_fora_id')
      .eq('rodada', rodada);

    const { data: clubes } = await supabase
      .from('clubes')
      .select('id, nome, abreviacao');

    const clubeMap = new Map((clubes || []).map((c: any) => [c.id, c]));
    const confrontos = (partidas || []).map((p: any) => ({
      casa: clubeMap.get(p.time_casa_id)?.nome || 'Casa',
      fora: clubeMap.get(p.time_fora_id)?.nome || 'Fora',
      data: p.data_partida,
    }));

    // Top jogadores em forma (status provável = 7)
    const { data: topAtletas } = await supabase
      .from('atletas')
      .select('apelido, posicao_id, clube_id, preco, media, jogos, status_id')
      .eq('status_id', 7)
      .gte('jogos', 3)
      .order('media', { ascending: false })
      .limit(60);


    const posMap: Record<number, string> = { 1: 'GOL', 2: 'LAT', 3: 'ZAG', 4: 'MEI', 5: 'ATA', 6: 'TEC' };
    const atletas = (topAtletas || []).map((a: any) => ({
      nome: a.apelido,
      pos: posMap[a.posicao_id] || '?',
      clube: clubeMap.get(a.clube_id)?.abreviacao || '?',
      preco: Number(a.preco)?.toFixed(1),
      media: Number(a.media)?.toFixed(2),
    }));

    // Atletas baratos com média boa (potenciais surpresas)
    const surpresasCandidatas = atletas
      .filter(a => Number(a.preco) <= 8 && Number(a.media) >= 5)
      .slice(0, 15);

    const systemPrompt = `Você é "Mestre Cartoleiro", analista raiz do Cartola FC com gíria brasileira de boleiro. Tom: agressivo, informal, vencedor, direto. NUNCA corporativo. Use expressões como "mitada", "amassar", "tá voando", "raiz", "calejado". Responda SEMPRE em JSON válido seguindo o schema pedido. Sem markdown, sem texto fora do JSON.`;

    const userPrompt = `Monta o resumo da RODADA ${rodada} do Brasileirão para os cartoleiros.

CONFRONTOS DA RODADA (${confrontos.length}):
${confrontos.map(c => `- ${c.casa} x ${c.fora}`).join('\n')}

TOP ATLETAS EM FORMA (média recente):
${atletas.slice(0, 25).map(a => `${a.nome} (${a.pos}/${a.clube}) - média ${a.media}, C$${a.preco}`).join('\n')}

POTENCIAIS SURPRESAS (baratos com média boa):
${surpresasCandidatas.map(a => `${a.nome} (${a.pos}/${a.clube}) C$${a.preco} média ${a.media}`).join('\n')}

Retorne EXATAMENTE este JSON:
{
  "manchete": "string curta e impactante (máx 90 chars) sobre a rodada",
  "confrontos_principais": [
    { "jogo": "Time A x Time B", "analise": "1-2 frases raiz sobre o jogo" }
  ], // 3 confrontos mais quentes
  "surpresas": [
    { "titulo": "Nome do jogador (POS/CLUBE)", "descricao": "por que pode mitar barato" }
  ], // 3 surpresas
  "escalacao_free": {
    "resumo": "1 frase sobre a escalação básica e segura",
    "jogadores": ["Nome1 (POS/CLUBE)", "Nome2 (POS/CLUBE)", "..."]
  }, // 6 nomes seguros, foco em consistência
  "escalacao_pro": {
    "resumo": "1 frase sobre a estratégia premium",
    "jogadores": ["Nome1 (POS/CLUBE)", "..."],
    "diferencial": "1 frase: qual é a sacada/diferencial dessa escalação vs a Free"
  } // 6 nomes incluindo surpresas e mitadas
}`;

    const aiRes = await fetch(LOVABLE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ success: false, error: 'Limite de requisições atingido. Tenta de novo em alguns minutos.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ success: false, error: 'Créditos de IA esgotados. Adicione créditos no workspace.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`AI gateway error ${aiRes.status}: ${txt}`);
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const resumo: ResumoRodada = {
      rodada,
      manchete: parsed.manchete || `Rodada ${rodada}: hora de mitar`,
      confrontos_principais: parsed.confrontos_principais || [],
      surpresas: parsed.surpresas || [],
      escalacao_free: parsed.escalacao_free || { resumo: '', jogadores: [] },
      escalacao_pro: parsed.escalacao_pro || { resumo: '', jogadores: [], diferencial: '' },
    };

    cache.set(cacheKey, { at: Date.now(), data: resumo });

    return new Response(JSON.stringify({ success: true, cached: false, ...resumo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('resumo-rodada erro:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
