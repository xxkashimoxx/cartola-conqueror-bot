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

    console.log(`[Ausências] Buscando rodada: ${rodada}`);

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

    // Buscar ausências da rodada
    const { data: ausencias, error } = await supabase
      .from('ausencias')
      .select(`
        *,
        atleta:atletas(
          id, apelido, nome, foto_url, preco, media,
          posicao:posicoes(id, nome, abreviacao),
          clube:clubes(id, nome, abreviacao, escudo_url)
        )
      `)
      .eq('rodada', currentRound)
      .order('probabilidade', { ascending: false });

    if (error) throw error;

    // Também buscar atletas com status de dúvida/lesão do Cartola (status 2, 3, 5)
    // Status: 2 = Dúvida, 3 = Suspenso, 5 = Contundido
    const { data: atletasRisco } = await supabase
      .from('atletas')
      .select(`
        id, apelido, nome, foto_url, preco, media, status_id,
        posicao:posicoes(id, nome, abreviacao),
        clube:clubes(id, nome, abreviacao, escudo_url)
      `)
      .in('status_id', [2, 3, 5])
      .order('media', { ascending: false });

    // Mapear status para tipo de ausência
    const statusToTipo: Record<number, string> = {
      2: 'DESCANSO', // Dúvida
      3: 'SUSPENSAO',
      5: 'LESAO',
    };

    const statusToNota: Record<number, string> = {
      2: 'Situação incerta - pode não jogar',
      3: 'Suspenso pela rodada',
      5: 'Contundido - fora da partida',
    };

    // Combinar dados manuais + automáticos
    const ausenciasFormatadas = [
      ...(ausencias || []).map(a => ({
        id: a.id,
        atleta: a.atleta,
        tipo: a.tipo,
        nota: a.nota,
        probabilidade: a.probabilidade,
        fonte: 'manual',
      })),
      ...(atletasRisco || [])
        .filter(a => !ausencias?.some(aus => aus.atleta_id === a.id))
        .map(a => ({
          id: `auto-${a.id}`,
          atleta: a,
          tipo: statusToTipo[a.status_id] || 'DESCANSO',
          nota: statusToNota[a.status_id] || 'Status incerto',
          probabilidade: a.status_id === 5 ? 0.95 : a.status_id === 3 ? 1.0 : 0.6,
          fonte: 'cartola',
        })),
    ];

    console.log(`[Ausências] Encontradas ${ausenciasFormatadas.length} ausências`);

    return new Response(JSON.stringify({
      success: true,
      rodada: currentRound,
      data: ausenciasFormatadas,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Ausências] Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
