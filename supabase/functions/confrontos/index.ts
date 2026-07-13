import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readCache, writeCache, shouldForceRefresh } from "../_shared/predictions-cache.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const rodada = url.searchParams.get('round') || url.searchParams.get('rodada');
    const matchId = url.searchParams.get('id');

    console.log(`[Confrontos] Buscando rodada: ${rodada}, matchId: ${matchId}`);

    // Buscar rodada atual se não especificada
    let currentRound = rodada ? parseInt(rodada) : 1;
    if (!rodada) {
      const { data: mercado } = await supabase
        .from('mercado_status')
        .select('rodada_atual')
        .order('id', { ascending: false })
        .limit(1)
        .single();
      
      if (mercado) {
        currentRound = mercado.rodada_atual;
      }
    }

    // Se matchId, retornar detalhes + recomendações
    if (matchId) {
      const { data: partida, error } = await supabase
        .from('partidas')
        .select(`
          *,
          time_casa:clubes!partidas_time_casa_id_fkey(id, nome, abreviacao, escudo_url),
          time_fora:clubes!partidas_time_fora_id_fkey(id, nome, abreviacao, escudo_url)
        `)
        .eq('id', matchId)
        .single();

      if (error) throw error;

      // Buscar jogadores dos times para recomendações
      const { data: atletasCasa } = await supabase
        .from('atletas')
        .select('*')
        .eq('clube_id', partida.time_casa_id)
        .eq('status_id', 7) // Provável
        .order('media', { ascending: false })
        .limit(10);

      const { data: atletasFora } = await supabase
        .from('atletas')
        .select('*')
        .eq('clube_id', partida.time_fora_id)
        .eq('status_id', 7)
        .order('media', { ascending: false })
        .limit(10);

      // Classificar por setor
      const classificarPorSetor = (atletas: any[]) => {
        const defesa = atletas.filter(a => [1, 2, 3].includes(a.posicao_id)); // GOL, LAT, ZAG
        const ataque = atletas.filter(a => [4, 5].includes(a.posicao_id)); // MEI, ATA
        return { defesa, ataque };
      };

      const recCasa = classificarPorSetor(atletasCasa || []);
      const recFora = classificarPorSetor(atletasFora || []);

      // Análise baseada em xG e SG
      let nota = '';
      if (partida.clean_sheet_casa > 0.4) {
        nota += `Alta chance de SG do ${partida.time_casa?.abreviacao} (${(partida.clean_sheet_casa * 100).toFixed(0)}%). `;
      }
      if (partida.xg_casa > 1.5) {
        nota += `${partida.time_casa?.abreviacao} com xG alto (${partida.xg_casa.toFixed(1)}). `;
      }
      if (partida.clean_sheet_fora > 0.4) {
        nota += `Alta chance de SG do ${partida.time_fora?.abreviacao} (${(partida.clean_sheet_fora * 100).toFixed(0)}%). `;
      }
      if (partida.xg_fora > 1.5) {
        nota += `${partida.time_fora?.abreviacao} com xG alto (${partida.xg_fora.toFixed(1)}). `;
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          partida,
          recomendacoes: {
            casa: recCasa,
            fora: recFora,
          },
          nota: nota || 'Partida equilibrada. Analise os últimos jogos.',
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Cache por rodada da listagem
    const force = shouldForceRefresh(req);
    const cached = await readCache(supabase, {
      cacheKey: 'confrontos',
      rodada: currentRound,
      ttlSeconds: 600,
      forceRefresh: force,
    });
    if (cached.hit && cached.payload) {
      return new Response(JSON.stringify({ ...cached.payload, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Listar partidas da rodada
    const { data: partidas, error } = await supabase
      .from('partidas')
      .select(`
        *,
        time_casa:clubes!partidas_time_casa_id_fkey(id, nome, abreviacao, escudo_url),
        time_fora:clubes!partidas_time_fora_id_fkey(id, nome, abreviacao, escudo_url)
      `)
      .eq('rodada', currentRound)
      .order('data_partida', { ascending: true });

    if (error) throw error;

    console.log(`[Confrontos] Encontradas ${partidas?.length || 0} partidas`);

    const responsePayload = {
      success: true,
      rodada: currentRound,
      data: partidas || [],
    };

    await writeCache(supabase, { cacheKey: 'confrontos', rodada: currentRound, ttlSeconds: 600 }, responsePayload);

    return new Response(JSON.stringify({ ...responsePayload, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Confrontos] Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
