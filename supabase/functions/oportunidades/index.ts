import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log(`[Oportunidades] Buscando rodada: ${rodada}`);

    // Buscar rodada atual
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

    // Buscar oportunidades cadastradas
    const { data: oportunidadesManuais, error } = await supabase
      .from('oportunidades')
      .select(`
        *,
        atleta:atletas(
          id, apelido, nome, foto_url, preco, media, variacao_preco, jogos,
          posicao:posicoes(id, nome, abreviacao),
          clube:clubes(id, nome, abreviacao, escudo_url)
        )
      `)
      .eq('rodada', currentRound)
      .order('score', { ascending: false });

    if (error) throw error;

    // Buscar atletas que se encaixam nos critérios automaticamente
    // BARATO_EXPLOSAO: preço < 8, média > 5, variação positiva
    const { data: baratos } = await supabase
      .from('atletas')
      .select(`
        id, apelido, nome, foto_url, preco, media, variacao_preco, jogos,
        posicao:posicoes(id, nome, abreviacao),
        clube:clubes(id, nome, abreviacao, escudo_url)
      `)
      .eq('status_id', 7) // Provável
      .lt('preco', 8)
      .gt('media', 5)
      .gt('jogos', 2)
      .order('media', { ascending: false })
      .limit(5);

    // SUBESTIMADO: bom custo-benefício (média/preço alto)
    const { data: todosAtletas } = await supabase
      .from('atletas')
      .select(`
        id, apelido, nome, foto_url, preco, media, variacao_preco, jogos,
        posicao:posicoes(id, nome, abreviacao),
        clube:clubes(id, nome, abreviacao, escudo_url)
      `)
      .eq('status_id', 7)
      .gt('jogos', 3)
      .gt('preco', 0);

    // Calcular custo-benefício
    const subestimados = (todosAtletas || [])
      .map(a => ({
        ...a,
        custoBeneficio: a.preco > 0 ? a.media / a.preco : 0,
      }))
      .filter(a => a.custoBeneficio > 0.8) // Alta relação média/preço
      .sort((a, b) => b.custoBeneficio - a.custoBeneficio)
      .slice(0, 5);

    // Formatar oportunidades
    const oportunidades = [
      ...(oportunidadesManuais || []).map(o => ({
        id: o.id,
        atleta: o.atleta,
        tipo: o.tipo,
        nota: o.nota,
        score: o.score,
        fonte: 'manual',
      })),
      ...(baratos || [])
        .filter(a => !oportunidadesManuais?.some(o => o.atleta_id === a.id))
        .map(a => ({
          id: `auto-barato-${a.id}`,
          atleta: a,
          tipo: 'BARATO_EXPLOSAO',
          nota: `Preço baixo (C$ ${a.preco?.toFixed(1)}) com média alta (${a.media?.toFixed(2)})`,
          score: a.media || 0,
          fonte: 'auto',
        })),
      ...subestimados
        .filter(a => !oportunidadesManuais?.some(o => o.atleta_id === a.id))
        .filter(a => !baratos?.some(b => b.id === a.id))
        .map(a => ({
          id: `auto-sub-${a.id}`,
          atleta: a,
          tipo: 'SUBESTIMADO',
          nota: `Custo-benefício: ${a.custoBeneficio.toFixed(2)} pts/C$`,
          score: a.custoBeneficio * 10,
          fonte: 'auto',
        })),
    ];

    // Ordenar por score e limitar
    const top = oportunidades
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    console.log(`[Oportunidades] Encontradas ${top.length} oportunidades`);

    return new Response(JSON.stringify({
      success: true,
      rodada: currentRound,
      data: top,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Oportunidades] Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
