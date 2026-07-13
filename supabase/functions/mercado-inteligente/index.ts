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
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    const url = new URL(req.url);
    const plan = url.searchParams.get('plan') || 'FREE';

    // Descobrir rodada atual antes de qualquer processamento pesado
    const { data: mercadoStatusEarly } = await supabase
      .from('mercado_status')
      .select('rodada_atual')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    const rodadaAtualCache = mercadoStatusEarly?.rodada_atual || 1;

    // Cache por rodada
    const force = shouldForceRefresh(req);
    const cacheKey = `mercado_inteligente_${plan}`;
    const cachedResp = await readCache(supabase, {
      cacheKey,
      rodada: rodadaAtualCache,
      ttlSeconds: 600,
      forceRefresh: force,
    });
    if (cachedResp.hit && cachedResp.payload) {
      return new Response(JSON.stringify({ ...cachedResp.payload, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar atletas com dados relevantes para análise de mercado
    const { data: atletas, error } = await supabase
      .from('atletas')
      .select(`
        id,
        apelido,
        nome,
        preco,
        variacao_preco,
        media,
        pontos_num,
        jogos,
        foto_url,
        posicao_id,
        status_id,
        clube_id,
        clubes (nome, abreviacao, escudo_url),
        posicoes (nome, abreviacao)
      `)
      .gt('jogos', 0)
      .order('media', { ascending: false });

    if (error) {
      console.error('Erro ao buscar atletas:', error);
      throw error;
    }

    // Buscar próximas partidas para análise de mandante/visitante
    const { data: mercadoStatus } = await supabase
      .from('mercado_status')
      .select('rodada_atual')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    const rodadaAtual = mercadoStatus?.rodada_atual || 1;

    const { data: partidas } = await supabase
      .from('partidas')
      .select('time_casa_id, time_fora_id, xg_casa, xg_fora, clean_sheet_casa, clean_sheet_fora')
      .eq('rodada', rodadaAtual);

    // Mapear times em casa/fora e seus xG
    const timesEmCasa = new Set((partidas || []).map(p => p.time_casa_id));
    const timesFora = new Set((partidas || []).map(p => p.time_fora_id));

    // Análise de Valorização
    // Critérios: preço baixo (<10), média boa (>4), jogando em casa, variação positiva recente
    const valorizarCandidates = (atletas || [])
      .filter(a => {
        const preco = a.preco || 0;
        const media = a.media || 0;
        const variacao = a.variacao_preco || 0;
        const emCasa = timesEmCasa.has(a.clube_id);
        const statusBom = a.status_id === 7; // Provável
        
        // Score de valorização
        const scoreValorizacao = 
          (preco < 8 ? 3 : preco < 12 ? 2 : preco < 15 ? 1 : 0) + // Preço baixo
          (media > 6 ? 3 : media > 4 ? 2 : media > 2 ? 1 : 0) + // Boa média
          (emCasa ? 2 : 0) + // Mandante
          (variacao > 0 ? 1 : 0) + // Já valorizando
          (statusBom ? 1 : 0); // Provável
        
        return scoreValorizacao >= 5 && preco > 0;
      })
      .map((a: any) => ({
        ...a,
        clube: a.clubes?.abreviacao || '',
        clube_nome: a.clubes?.nome || '',
        escudo_url: a.clubes?.escudo_url || '',
        posicao: a.posicoes?.abreviacao || '',
        posicao_nome: a.posicoes?.nome || '',
        emCasa: timesEmCasa.has(a.clube_id),
        motivo: gerarMotivoValorizacao(a, timesEmCasa.has(a.clube_id)),
        tipo: 'valorizar' as const,
      }))
      .sort((a, b) => {
        // Ordenar por custo-benefício (média / preço)
        const cbA = (a.media || 0) / (a.preco || 1);
        const cbB = (b.media || 0) / (b.preco || 1);
        return cbB - cbA;
      })
      .slice(0, 10);

    // Análise de Desvalorização (armadilhas)
    // Critérios: preço alto (>15), média caindo, visitante, variação negativa
    const desvalorizarCandidates = (atletas || [])
      .filter(a => {
        const preco = a.preco || 0;
        const media = a.media || 0;
        const variacao = a.variacao_preco || 0;
        const visitante = timesFora.has(a.clube_id);
        const statusRuim = a.status_id !== 7; // Não é provável
        
        // Score de desvalorização
        const scoreDesvalorizacao = 
          (preco > 20 ? 3 : preco > 15 ? 2 : preco > 12 ? 1 : 0) + // Preço alto
          (media < 4 ? 2 : media < 6 ? 1 : 0) + // Média baixa para o preço
          (visitante ? 2 : 0) + // Visitante
          (variacao < 0 ? 2 : 0) + // Já desvalorizando
          (statusRuim ? 1 : 0); // Dúvida/Contundido
        
        return scoreDesvalorizacao >= 4 && preco > 10;
      })
      .map((a: any) => ({
        ...a,
        clube: a.clubes?.abreviacao || '',
        clube_nome: a.clubes?.nome || '',
        escudo_url: a.clubes?.escudo_url || '',
        posicao: a.posicoes?.abreviacao || '',
        posicao_nome: a.posicoes?.nome || '',
        visitante: timesFora.has(a.clube_id),
        motivo: gerarMotivoDesvalorizacao(a, timesFora.has(a.clube_id)),
        tipo: 'desvalorizar' as const,
      }))
      .sort((a, b) => (b.preco || 0) - (a.preco || 0))
      .slice(0, 10);

    // Aplicar restrições por plano
    let valorizar = valorizarCandidates;
    let desvalorizar = desvalorizarCandidates;
    let planRequired = null;

    if (plan === 'FREE') {
      valorizar = valorizarCandidates.slice(0, 3);
      desvalorizar = []; // FREE não vê desvalorização
      planRequired = 'PRO';
    }

    console.log(`Mercado Inteligente: ${valorizar.length} valorizar, ${desvalorizar.length} desvalorizar (plano: ${plan})`);

    return new Response(JSON.stringify({
      valorizar,
      desvalorizar,
      rodada: rodadaAtual,
      planRequired,
      totalValorizar: valorizarCandidates.length,
      totalDesvalorizar: desvalorizarCandidates.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro no mercado inteligente:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function gerarMotivoValorizacao(atleta: any, emCasa: boolean): string {
  const motivos: string[] = [];
  
  if ((atleta.preco || 0) < 10) motivos.push('Preço acessível');
  if ((atleta.media || 0) > 5) motivos.push('Boa média');
  if (emCasa) motivos.push('Joga em casa');
  if ((atleta.variacao_preco || 0) > 0) motivos.push('Em tendência de alta');
  if (atleta.status_id === 7) motivos.push('Provável titular');
  
  return motivos.slice(0, 3).join(' • ') || 'Bom custo-benefício';
}

function gerarMotivoDesvalorizacao(atleta: any, visitante: boolean): string {
  const motivos: string[] = [];
  
  if ((atleta.preco || 0) > 15) motivos.push('Preço inflacionado');
  if ((atleta.variacao_preco || 0) < 0) motivos.push('Em queda');
  if (visitante) motivos.push('Joga fora');
  if (atleta.status_id !== 7) motivos.push('Dúvida para jogar');
  if ((atleta.media || 0) < 5) motivos.push('Média baixa');
  
  return motivos.slice(0, 3).join(' • ') || 'Risco de desvalorização';
}
