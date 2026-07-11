// Sincroniza pontuações ao vivo (parciais) dos atletas durante a rodada em andamento.
// Roda a cada ~2min via cron.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartolaMercado {
  rodada_atual: number;
  status_mercado: number; // 1 = aberto, 2 = fechado, 3 = manutencao, 4 = encerrado, 6 = atualizacao
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1) Status do mercado
    const mercadoRes = await fetch('https://api.cartolafc.globo.com/mercado/status');
    if (!mercadoRes.ok) throw new Error(`mercado/status ${mercadoRes.status}`);
    const mercado: CartolaMercado = await mercadoRes.json();
    const rodada = mercado.rodada_atual;

    // 2) Só faz sentido buscar parciais quando o mercado está fechado (jogos rolando).
    //    status 2 = fechado (rodada em andamento). Aceitamos também 4 (encerrado) para
    //    pegar a última rodada finalizada com pontuações consolidadas.
    const rodadaEmAndamento = mercado.status_mercado === 2 || mercado.status_mercado === 4 || mercado.status_mercado === 6;

    if (!rodadaEmAndamento) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'mercado_aberto',
          status_mercado: mercado.status_mercado,
          rodada,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3) Pontuações ao vivo
    const pontRes = await fetch('https://api.cartolafc.globo.com/atletas/pontuados');
    if (!pontRes.ok) throw new Error(`atletas/pontuados ${pontRes.status}`);
    const pontData = await pontRes.json();

    const rodadaApi: number = pontData.rodada || rodada;
    const atletasRaw = pontData.atletas || {};

    const rows: any[] = [];
    for (const [id, a] of Object.entries<any>(atletasRaw)) {
      const atletaId = Number(id);
      if (!Number.isFinite(atletaId)) continue;
      const pontos = Number(a?.pontuacao ?? 0);
      const scout = a?.scout ?? null;
      const jogou = Boolean(a?.entrou_em_campo ?? (scout && Object.keys(scout).length > 0) ?? false);
      rows.push({
        atleta_id: atletaId,
        rodada: rodadaApi,
        pontos,
        scout,
        jogou,
        atualizado_em: new Date().toISOString(),
      });
    }

    let upserted = 0;
    const batch = 500;
    for (let i = 0; i < rows.length; i += batch) {
      const slice = rows.slice(i, i + batch);
      const { error } = await supabase
        .from('atleta_parciais')
        .upsert(slice, { onConflict: 'atleta_id,rodada' });
      if (error) {
        console.error('upsert parciais erro:', error);
      } else {
        upserted += slice.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        rodada: rodadaApi,
        status_mercado: mercado.status_mercado,
        atualizados: upserted,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('sync-parciais erro:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
