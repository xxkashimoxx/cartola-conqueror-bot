import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const posicao = url.searchParams.get('posicao');

    console.log(`Buscando top ${limit} jogadores${posicao ? ` na posição ${posicao}` : ''}`);

    let query = supabase
      .from('atletas')
      .select(`
        *,
        clube:clubes(nome, abreviacao, escudo_url),
        posicao:posicoes(nome, abreviacao)
      `)
      .order('media', { ascending: false })
      .limit(limit);

    if (posicao) {
      query = query.eq('posicao_id', posicao);
    }

    const { data: atletas, error } = await query;

    if (error) {
      throw error;
    }

    // Calcular previsões e probabilidades (simulado)
    const atletasComPrevisao = atletas.map((atleta, index) => {
      const baseScore = atleta.media || 0;
      const variance = Math.random() * 2 - 1; // -1 a 1
      const predictedScore = Math.max(0, baseScore + variance);
      
      // Probabilidade baseada na consistência (simulado)
      const probability = Math.min(95, Math.max(60, 75 + (atleta.jogos || 0) * 0.5));
      
      // Tendência baseada na variação de preço
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (atleta.variacao_preco > 0.5) trend = 'up';
      else if (atleta.variacao_preco < -0.5) trend = 'down';

      return {
        id: atleta.id,
        rank: index + 1,
        name: atleta.apelido,
        fullName: atleta.nome,
        position: atleta.posicao?.nome || 'Desconhecido',
        team: atleta.clube?.abreviacao || 'N/A',
        teamName: atleta.clube?.nome || 'Desconhecido',
        shield: atleta.clube?.escudo_url,
        photo: atleta.foto_url,
        price: atleta.preco,
        predictedScore: Number(predictedScore.toFixed(2)),
        probability: Number(probability.toFixed(1)),
        trend,
        average: atleta.media,
        games: atleta.jogos,
        totalPoints: atleta.pontos_num,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: atletasComPrevisao,
        count: atletasComPrevisao.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro ao buscar jogadores:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
