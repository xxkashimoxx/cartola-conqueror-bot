import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartolaClube {
  id: number;
  nome: string;
  abreviacao: string;
  escudos?: {
    '60x60'?: string;
  };
}

interface CartolaAtleta {
  atleta_id: number;
  nome: string;
  apelido: string;
  clube_id: number;
  posicao_id: number;
  preco_num: number;
  variacao_num: number;
  media_num: number;
  jogos_num: number;
  pontos_num: number;
  foto?: string;
  status_id: number;
}

interface CartolaMercado {
  rodada_atual: number;
  status_mercado: number;
  times_escalados?: number;
  fechamento?: {
    timestamp?: number;
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

    console.log('Iniciando sincronização com API do Cartola FC...');

    // 1. Buscar status do mercado
    console.log('Buscando status do mercado...');
    const mercadoResponse = await fetch('https://api.cartolafc.globo.com/mercado/status');
    
    if (!mercadoResponse.ok) {
      throw new Error(`Erro ao buscar status do mercado: ${mercadoResponse.status}`);
    }
    
    const mercadoData: CartolaMercado = await mercadoResponse.json();
    console.log(`Rodada atual: ${mercadoData.rodada_atual}, Status: ${mercadoData.status_mercado}`);

    // Salvar status do mercado
    const { error: mercadoError } = await supabase
      .from('mercado_status')
      .insert({
        rodada_atual: mercadoData.rodada_atual,
        status_mercado: mercadoData.status_mercado,
        fechamento: mercadoData.fechamento?.timestamp 
          ? new Date(mercadoData.fechamento.timestamp * 1000).toISOString()
          : null,
      });

    if (mercadoError) {
      console.error('Erro ao salvar status do mercado:', mercadoError);
    }

    // 2. Buscar atletas do mercado
    console.log('Buscando atletas do mercado...');
    const atletasResponse = await fetch('https://api.cartolafc.globo.com/atletas/mercado');
    
    if (!atletasResponse.ok) {
      throw new Error(`Erro ao buscar atletas: ${atletasResponse.status}`);
    }
    
    const atletasData = await atletasResponse.json();

    // 3. Processar e salvar clubes
    console.log('Processando clubes...');
    const clubes: CartolaClube[] = Object.values(atletasData.clubes || {});
    
    if (clubes.length > 0) {
      const clubesFormatados = clubes.map(clube => ({
        id: clube.id,
        nome: clube.nome,
        abreviacao: clube.abreviacao,
        escudo_url: clube.escudos?.['60x60'] || null,
      }));

      const { error: clubesError } = await supabase
        .from('clubes')
        .upsert(clubesFormatados, { onConflict: 'id' });

      if (clubesError) {
        console.error('Erro ao salvar clubes:', clubesError);
      } else {
        console.log(`${clubesFormatados.length} clubes salvos`);
      }
    }

    // 4. Processar e salvar atletas
    console.log('Processando atletas...');
    const atletas: CartolaAtleta[] = Object.values(atletasData.atletas || {});
    
    if (atletas.length > 0) {
      const atletasFormatados = atletas.map(atleta => ({
        id: atleta.atleta_id,
        nome: atleta.nome,
        apelido: atleta.apelido,
        clube_id: atleta.clube_id,
        posicao_id: atleta.posicao_id,
        preco: atleta.preco_num,
        variacao_preco: atleta.variacao_num,
        media: atleta.media_num,
        jogos: atleta.jogos_num,
        pontos_num: atleta.pontos_num,
        foto_url: atleta.foto || null,
        status_id: atleta.status_id,
      }));

      // Processar em lotes de 500
      const batchSize = 500;
      for (let i = 0; i < atletasFormatados.length; i += batchSize) {
        const batch = atletasFormatados.slice(i, i + batchSize);
        const { error: atletasError } = await supabase
          .from('atletas')
          .upsert(batch, { onConflict: 'id' });

        if (atletasError) {
          console.error(`Erro ao salvar lote ${i / batchSize + 1}:`, atletasError);
        } else {
          console.log(`Lote ${i / batchSize + 1}: ${batch.length} atletas salvos`);
        }
      }
      
      console.log(`Total de ${atletasFormatados.length} atletas processados`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronização concluída com sucesso',
        rodada: mercadoData.rodada_atual,
        clubes: clubes.length,
        atletas: atletas.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro na sincronização:', error);
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
