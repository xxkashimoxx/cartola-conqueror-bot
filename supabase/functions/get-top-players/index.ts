import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AtletaPontuacao {
  atleta_id: number;
  rodada: number;
  pontos: number;
}

interface Atleta {
  id: number;
  apelido: string;
  nome: string;
  media: number | null;
  pontos_num: number | null;
  preco: number | null;
  jogos: number | null;
  variacao_preco: number | null;
  status_id: number | null;
  foto_url: string | null;
  posicao_id: number | null;
  clube_id: number | null;
  clube: {
    nome: string;
    abreviacao: string;
    escudo_url: string | null;
  } | null;
  posicao: {
    nome: string;
    abreviacao: string;
  } | null;
}

// Calcula o desvio padrão das pontuações (consistência)
function calcularDesvioPadrao(pontuacoes: number[]): number {
  if (pontuacoes.length < 2) return 0;
  const media = pontuacoes.reduce((a, b) => a + b, 0) / pontuacoes.length;
  const variancia = pontuacoes.reduce((acc, val) => acc + Math.pow(val - media, 2), 0) / pontuacoes.length;
  return Math.sqrt(variancia);
}

// Calcula média ponderada das últimas rodadas (mais recentes têm mais peso)
function calcularMediaPonderada(pontuacoes: { rodada: number; pontos: number }[]): number {
  if (pontuacoes.length === 0) return 0;
  
  // Ordena por rodada descendente (mais recente primeiro)
  const ordenadas = [...pontuacoes].sort((a, b) => b.rodada - a.rodada);
  
  let somaTotal = 0;
  let somaPesos = 0;
  
  ordenadas.forEach((p, index) => {
    // Peso decrescente: rodadas mais recentes têm mais peso
    const peso = Math.max(1, 10 - index);
    somaTotal += p.pontos * peso;
    somaPesos += peso;
  });
  
  return somaPesos > 0 ? somaTotal / somaPesos : 0;
}

// Calcula a tendência de forma (últimas 5 rodadas vs 5 anteriores)
function calcularTendencia(pontuacoes: { rodada: number; pontos: number }[]): 'up' | 'down' | 'stable' {
  if (pontuacoes.length < 6) return 'stable';
  
  const ordenadas = [...pontuacoes].sort((a, b) => b.rodada - a.rodada);
  
  const ultimas5 = ordenadas.slice(0, 5);
  const anteriores5 = ordenadas.slice(5, 10);
  
  if (anteriores5.length === 0) return 'stable';
  
  const mediaUltimas = ultimas5.reduce((a, b) => a + b.pontos, 0) / ultimas5.length;
  const mediaAnteriores = anteriores5.reduce((a, b) => a + b.pontos, 0) / anteriores5.length;
  
  const diferenca = mediaUltimas - mediaAnteriores;
  
  if (diferenca > 1.5) return 'up';
  if (diferenca < -1.5) return 'down';
  return 'stable';
}

// Calcula a regularidade (% de jogos com pontuação positiva)
function calcularRegularidade(pontuacoes: number[]): number {
  if (pontuacoes.length === 0) return 0;
  const positivas = pontuacoes.filter(p => p > 0).length;
  return (positivas / pontuacoes.length) * 100;
}

// Calcula o "Score de Potencial" baseado em múltiplos fatores técnicos
function calcularScorePotencial(
  atleta: Atleta,
  pontuacoesHistoricas: { rodada: number; pontos: number }[]
): {
  scorePotencial: number;
  mediaPonderada: number;
  consistencia: number;
  tendencia: 'up' | 'down' | 'stable';
  regularidade: number;
  probabilidadeAlta: number;
} {
  const pontos = pontuacoesHistoricas.map(p => p.pontos);
  
  // 1. Média Ponderada (rodadas recentes valem mais)
  const mediaPonderada = calcularMediaPonderada(pontuacoesHistoricas);
  
  // 2. Consistência (inverso do desvio padrão normalizado)
  const desvioPadrao = calcularDesvioPadrao(pontos);
  const mediaSimples = atleta.media || 0;
  const coeficienteVariacao = mediaSimples > 0 ? desvioPadrao / mediaSimples : 1;
  const consistencia = Math.max(0, 100 - (coeficienteVariacao * 50));
  
  // 3. Tendência de Forma
  const tendencia = calcularTendencia(pontuacoesHistoricas);
  
  // 4. Regularidade (% de jogos positivos)
  const regularidade = calcularRegularidade(pontos);
  
  // 5. Número de jogos (experiência/ritmo de jogo)
  const jogos = atleta.jogos || 0;
  const bonusJogos = Math.min(10, jogos * 0.3); // Bônus por ter mais jogos, max 10
  
  // 6. Fator posição (ajuste por posição - atacantes e meias tendem a pontuar mais)
  let fatorPosicao = 1;
  if (atleta.posicao_id === 5) fatorPosicao = 1.05; // Atacante
  else if (atleta.posicao_id === 4) fatorPosicao = 1.03; // Meia
  else if (atleta.posicao_id === 1) fatorPosicao = 0.95; // Goleiro
  
  // 7. Fator tendência
  let bonusTendencia = 0;
  if (tendencia === 'up') bonusTendencia = 5;
  else if (tendencia === 'down') bonusTendencia = -3;
  
  // 8. Custo-benefício (valor por C$)
  const preco = atleta.preco || 1;
  const valorPorCartoleta = mediaSimples / preco;
  const bonusCustoBeneficio = Math.min(5, valorPorCartoleta * 0.5);
  
  // FÓRMULA FINAL DO SCORE DE POTENCIAL
  // Pesos: MediaPonderada(40%), Consistencia(25%), Regularidade(20%), Extras(15%)
  const scorePotencial = (
    (mediaPonderada * 4.0) +           // 40% - Performance recente
    (consistencia * 0.25) +             // 25% - Consistência
    (regularidade * 0.20) +             // 20% - Regularidade
    bonusJogos +                        // Bônus jogos
    bonusTendencia +                    // Bônus/penalidade tendência
    bonusCustoBeneficio                 // Bônus custo-benefício
  ) * fatorPosicao;
  
  // Probabilidade de alta pontuação (>média do jogador)
  const pontosAcimaDaMedia = pontos.filter(p => p > mediaSimples).length;
  const probabilidadeAlta = pontos.length > 0 
    ? (pontosAcimaDaMedia / pontos.length) * 100 
    : 50;
  
  return {
    scorePotencial,
    mediaPonderada,
    consistencia,
    tendencia,
    regularidade,
    probabilidadeAlta,
  };
}

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

    console.log(`Buscando top ${limit} jogadores com análise técnica${posicao ? ` na posição ${posicao}` : ''}`);

    // 1. Buscar todos os atletas com seus dados básicos
    let atletasQuery = supabase
      .from('atletas')
      .select(`
        *,
        clube:clubes(nome, abreviacao, escudo_url),
        posicao:posicoes(nome, abreviacao)
      `)
      .gt('jogos', 2) // Apenas jogadores com mais de 2 jogos (dados suficientes)
      .not('media', 'is', null);

    if (posicao) {
      atletasQuery = atletasQuery.eq('posicao_id', posicao);
    }

    const { data: atletas, error: atletasError } = await atletasQuery;

    if (atletasError) {
      throw atletasError;
    }

    if (!atletas || atletas.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [],
          count: 0,
          message: 'Nenhum atleta encontrado com dados suficientes'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 2. Buscar histórico de pontuações dos últimos 10 rodadas para análise
    const atletaIds = atletas.map(a => a.id);
    
    const { data: pontuacoesData, error: pontuacoesError } = await supabase
      .from('atleta_pontuacoes')
      .select('atleta_id, rodada, pontos')
      .in('atleta_id', atletaIds)
      .order('rodada', { ascending: false });

    if (pontuacoesError) {
      console.error('Erro ao buscar pontuações:', pontuacoesError);
    }

    // 3. Organizar pontuações por atleta
    const pontuacoesPorAtleta = new Map<number, { rodada: number; pontos: number }[]>();
    
    if (pontuacoesData) {
      pontuacoesData.forEach((p: AtletaPontuacao) => {
        const existing = pontuacoesPorAtleta.get(p.atleta_id) || [];
        existing.push({ rodada: p.rodada, pontos: p.pontos });
        pontuacoesPorAtleta.set(p.atleta_id, existing);
      });
    }

    console.log(`Processando ${atletas.length} atletas com ${pontuacoesData?.length || 0} pontuações históricas`);

    // 4. Calcular score de potencial para cada atleta
    const atletasComAnalise = atletas.map((atleta: Atleta) => {
      const pontuacoesHistoricas = pontuacoesPorAtleta.get(atleta.id) || [];
      
      const analise = calcularScorePotencial(atleta, pontuacoesHistoricas);
      
      return {
        ...atleta,
        ...analise,
        historico: pontuacoesHistoricas.slice(0, 10), // Últimas 10 rodadas
      };
    });

    // 5. Ordenar por Score de Potencial (maior para menor)
    atletasComAnalise.sort((a, b) => b.scorePotencial - a.scorePotencial);

    // 6. Selecionar os top jogadores
    const topAtletas = atletasComAnalise.slice(0, limit);

    // 7. Formatar resposta
    const atletasFormatados = topAtletas.map((atleta, index) => ({
      id: atleta.id,
      rank: index + 1,
      name: atleta.apelido,
      fullName: atleta.nome,
      position: atleta.posicao?.nome || 'Desconhecido',
      positionAbbr: atleta.posicao?.abreviacao || 'N/A',
      team: atleta.clube?.abreviacao || 'N/A',
      teamName: atleta.clube?.nome || 'Desconhecido',
      shield: atleta.clube?.escudo_url,
      photo: atleta.foto_url,
      price: atleta.preco,
      // Métricas técnicas
      predictedScore: Number(atleta.mediaPonderada.toFixed(2)),
      probability: Number(Math.min(95, Math.max(40, atleta.probabilidadeAlta)).toFixed(1)),
      trend: atleta.tendencia,
      // Dados base
      average: atleta.media,
      games: atleta.jogos,
      totalPoints: atleta.pontos_num,
      // Métricas avançadas
      potentialScore: Number(atleta.scorePotencial.toFixed(2)),
      consistency: Number(atleta.consistencia.toFixed(1)),
      regularity: Number(atleta.regularidade.toFixed(1)),
      weightedAverage: Number(atleta.mediaPonderada.toFixed(2)),
      historico: atleta.historico,
    }));

    console.log(`Retornando ${atletasFormatados.length} jogadores ordenados por potencial técnico`);

    return new Response(
      JSON.stringify({
        success: true,
        data: atletasFormatados,
        count: atletasFormatados.length,
        criterios: {
          descricao: 'Ranking baseado em análise técnica de futebol',
          fatores: [
            'Média ponderada (rodadas recentes valem mais) - 40%',
            'Consistência (menor variação de pontuação) - 25%',
            'Regularidade (% de jogos com pontuação positiva) - 20%',
            'Tendência de forma (últimas 5 vs 5 anteriores)',
            'Custo-benefício (pontos por cartoleta)',
            'Ajuste por posição e número de jogos',
          ],
        },
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
