import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Atleta {
  id: number;
  nome: string;
  apelido: string;
  foto: string | null;
  posicao_id: number;
  clube_id: number;
  preco: number;
  media: number;
  pontuacao_rodada: number;
  variacao_preco: number;
  jogos: number;
  status_id: number;
}

interface Clube {
  id: number;
  nome: string;
  abreviacao: string;
  escudo: string | null;
}

interface Posicao {
  id: number;
  nome: string;
  abreviacao: string;
}

interface PlayerResult {
  id: number;
  nome: string;
  apelido: string;
  foto: string | null;
  posicao: string;
  posicao_id: number;
  clube: string;
  clube_id: number;
  escudo: string | null;
  preco: number;
  media: number;
  pontuacao_rodada: number;
  score: number;
  motivo: string;
}

type EstiloJogo = 'AGRESSIVO' | 'CONSERVADOR' | 'PATRIMONIO' | 'LIGA_CLASSICA' | 'TIRO_CURTO';

// Formação padrão: 4-3-3 (1 GOL, 2 LAT, 2 ZAG, 3 MEI, 3 ATA, 1 TEC)
const FORMACAO = {
  1: 1,  // Goleiro
  2: 2,  // Lateral
  3: 2,  // Zagueiro
  4: 3,  // Meia
  5: 3,  // Atacante
  6: 1,  // Técnico
};

const POSICAO_NAMES: Record<number, string> = {
  1: 'Goleiro',
  2: 'Lateral',
  3: 'Zagueiro',
  4: 'Meia',
  5: 'Atacante',
  6: 'Técnico',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { estilo, cartoletas = 100 } = await req.json() as { estilo: EstiloJogo; cartoletas?: number };

    if (!estilo) {
      return new Response(
        JSON.stringify({ success: false, error: 'Estilo é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Gerando escalação para estilo: ${estilo}, cartoletas: ${cartoletas}`);

    // Buscar atletas disponíveis (status 7 = Provável)
    const { data: atletas, error: atletasError } = await supabase
      .from('atletas')
      .select('*')
      .eq('status_id', 7)
      .gt('jogos', 0);

    if (atletasError) {
      console.error('Erro ao buscar atletas:', atletasError);
      throw atletasError;
    }

    if (!atletas || atletas.length === 0) {
      // Se não houver atletas com status 7, buscar todos com jogos > 0
      const { data: todosAtletas, error: todosError } = await supabase
        .from('atletas')
        .select('*')
        .gt('jogos', 0);
      
      if (todosError) throw todosError;
      if (!todosAtletas || todosAtletas.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nenhum atleta disponível' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      atletas.push(...todosAtletas);
    }

    // Buscar clubes e posições
    const [{ data: clubes }, { data: posicoes }] = await Promise.all([
      supabase.from('clubes').select('*'),
      supabase.from('posicoes').select('*'),
    ]);

    const clubesMap = new Map((clubes || []).map((c: Clube) => [c.id, c]));
    const posicoesMap = new Map((posicoes || []).map((p: Posicao) => [p.id, p]));

    // Calcular score baseado no estilo
    const calcularScore = (atleta: Atleta): { score: number; motivo: string } => {
      const media = atleta.media || 0;
      const preco = atleta.preco || 1;
      const variacao = atleta.variacao_preco || 0;
      const jogos = atleta.jogos || 0;
      const ultimaPont = atleta.pontuacao_rodada || 0;

      switch (estilo) {
        case 'AGRESSIVO':
          // Prioriza alta pontuação recente, ignora consistência
          const scoreAgressivo = (ultimaPont * 3) + (media * 2) + (variacao > 0 ? variacao * 2 : 0);
          return { 
            score: scoreAgressivo, 
            motivo: `Alta pontuação: ${ultimaPont.toFixed(1)}pts última rodada` 
          };

        case 'CONSERVADOR':
          // Prioriza média alta e consistência (muitos jogos)
          const scoreConservador = (media * 3) + (jogos * 0.5) + (ultimaPont * 0.5);
          return { 
            score: scoreConservador, 
            motivo: `Consistente: ${media.toFixed(1)} média em ${jogos} jogos` 
          };

        case 'PATRIMONIO':
          // Prioriza valorização (variação de preço positiva)
          const scorePatrimonio = (variacao * 5) + (media * 1.5) + (ultimaPont > 0 ? ultimaPont : 0);
          return { 
            score: scorePatrimonio, 
            motivo: `Valorizando: ${variacao > 0 ? '+' : ''}${variacao.toFixed(2)} C$` 
          };

        case 'LIGA_CLASSICA':
          // Balanceado entre custo-benefício e média
          const custoBeneficio = media / preco;
          const scoreLigaClassica = (custoBeneficio * 10) + (media * 2) + (jogos * 0.3);
          return { 
            score: scoreLigaClassica, 
            motivo: `Custo-benefício: ${custoBeneficio.toFixed(2)} pts/C$` 
          };

        case 'TIRO_CURTO':
          // Foco em jogadores baratos com bom potencial
          const isBom = media >= 4;
          const isBarato = preco <= 8;
          const scoreTiroCurto = (isBom && isBarato ? 20 : 0) + 
                                 (15 - preco) + 
                                 (media * 2) + 
                                 (ultimaPont * 1.5);
          return { 
            score: scoreTiroCurto, 
            motivo: `Econômico: C$ ${preco.toFixed(1)} com ${media.toFixed(1)} de média` 
          };

        default:
          return { score: media, motivo: 'Média geral' };
      }
    };

    // Agrupar atletas por posição e calcular scores
    const atletasPorPosicao: Map<number, Array<Atleta & { score: number; motivo: string }>> = new Map();
    
    for (const atleta of atletas) {
      const { score, motivo } = calcularScore(atleta);
      const posicaoId = atleta.posicao_id;
      
      if (!atletasPorPosicao.has(posicaoId)) {
        atletasPorPosicao.set(posicaoId, []);
      }
      
      atletasPorPosicao.get(posicaoId)!.push({ ...atleta, score, motivo });
    }

    // Ordenar cada posição por score
    for (const [posicaoId, atletasList] of atletasPorPosicao) {
      atletasList.sort((a, b) => b.score - a.score);
    }

    // Montar escalação respeitando limite de cartoletas
    const escalacao: PlayerResult[] = [];
    let gastoTotal = 0;

    // Primeiro passo: selecionar os melhores de cada posição
    for (const [posicaoId, quantidade] of Object.entries(FORMACAO)) {
      const posId = parseInt(posicaoId);
      const atletasPosicao = atletasPorPosicao.get(posId) || [];
      
      let selecionados = 0;
      for (const atleta of atletasPosicao) {
        if (selecionados >= quantidade) break;
        
        // Verificar se cabe no orçamento
        if (gastoTotal + atleta.preco <= cartoletas) {
          const clube = clubesMap.get(atleta.clube_id);
          const posicao = posicoesMap.get(atleta.posicao_id);
          
          escalacao.push({
            id: atleta.id,
            nome: atleta.nome,
            apelido: atleta.apelido,
            foto: atleta.foto,
            posicao: posicao?.nome || POSICAO_NAMES[atleta.posicao_id] || 'Desconhecido',
            posicao_id: atleta.posicao_id,
            clube: clube?.abreviacao || 'N/A',
            clube_id: atleta.clube_id,
            escudo: clube?.escudo || null,
            preco: atleta.preco,
            media: atleta.media,
            pontuacao_rodada: atleta.pontuacao_rodada,
            score: atleta.score,
            motivo: atleta.motivo,
          });
          
          gastoTotal += atleta.preco;
          selecionados++;
        }
      }
    }

    // Calcular estatísticas da escalação
    const pontosPrevistos = escalacao.reduce((sum, p) => sum + p.media, 0);
    const mediaGeral = escalacao.length > 0 ? pontosPrevistos / escalacao.length : 0;

    console.log(`Escalação gerada: ${escalacao.length} jogadores, ${gastoTotal.toFixed(1)} C$`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          estilo,
          escalacao,
          estatisticas: {
            totalJogadores: escalacao.length,
            gastoTotal: parseFloat(gastoTotal.toFixed(2)),
            cartoletas,
            saldoRestante: parseFloat((cartoletas - gastoTotal).toFixed(2)),
            pontosPrevistos: parseFloat(pontosPrevistos.toFixed(2)),
            mediaGeral: parseFloat(mediaGeral.toFixed(2)),
          },
          descricaoEstilo: getDescricaoEstilo(estilo),
        },
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro no gerador de estilo:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function getDescricaoEstilo(estilo: EstiloJogo): { titulo: string; descricao: string; icone: string } {
  switch (estilo) {
    case 'AGRESSIVO':
      return {
        titulo: 'Modo Agressivo',
        descricao: 'Prioriza jogadores com alta pontuação recente. Alto risco, alto retorno.',
        icone: '🔥',
      };
    case 'CONSERVADOR':
      return {
        titulo: 'Modo Conservador',
        descricao: 'Foca em jogadores consistentes com boa média e muitos jogos.',
        icone: '🛡️',
      };
    case 'PATRIMONIO':
      return {
        titulo: 'Modo Patrimônio',
        descricao: 'Busca jogadores em valorização para aumentar seu patrimônio.',
        icone: '📈',
      };
    case 'LIGA_CLASSICA':
      return {
        titulo: 'Modo Liga Clássica',
        descricao: 'Equilibra custo-benefício e performance para ligas de pontos corridos.',
        icone: '⚖️',
      };
    case 'TIRO_CURTO':
      return {
        titulo: 'Modo Tiro Curto',
        descricao: 'Jogadores baratos com bom potencial para maximizar cartoletas.',
        icone: '🎯',
      };
    default:
      return {
        titulo: 'Modo Padrão',
        descricao: 'Seleção baseada na média geral.',
        icone: '⚽',
      };
  }
}
