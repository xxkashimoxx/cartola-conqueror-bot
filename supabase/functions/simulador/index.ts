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
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { teams } = await req.json();

    if (!teams || !Array.isArray(teams) || teams.length < 2 || teams.length > 3) {
      return new Response(JSON.stringify({ error: 'Envie entre 2 e 3 times para comparar' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Posições por setor
    const defensePositions = [1, 2, 3]; // GOL, ZAG, LAT
    const midfieldPositions = [4]; // MEI
    const attackPositions = [5]; // ATA
    const techPositions = [6]; // TEC

    const results = await Promise.all(teams.map(async (team: { playerIds: number[], name?: string }, index: number) => {
      if (!team.playerIds || !Array.isArray(team.playerIds)) {
        return {
          teamIndex: index,
          teamName: team.name || `Time ${index + 1}`,
          expectedPointsTotal: 0,
          totalPrice: 0,
          sectors: { defense: 0, midfield: 0, attack: 0, tech: 0 },
          players: [],
        };
      }

      const { data: players, error } = await supabase
        .from('atletas')
        .select(`
          id,
          apelido,
          nome,
          media,
          preco,
          posicao_id,
          foto_url,
          clube_id,
          clubes (abreviacao, escudo_url)
        `)
        .in('id', team.playerIds);

      if (error) {
        console.error('Erro ao buscar jogadores:', error);
        return {
          teamIndex: index,
          teamName: team.name || `Time ${index + 1}`,
          expectedPointsTotal: 0,
          totalPrice: 0,
          sectors: { defense: 0, midfield: 0, attack: 0, tech: 0 },
          players: [],
        };
      }

      let defensePoints = 0;
      let midfieldPoints = 0;
      let attackPoints = 0;
      let techPoints = 0;
      let totalPrice = 0;

      const playersData = (players || []).map((p: any) => {
        const media = p.media || 0;
        const preco = p.preco || 0;
        totalPrice += preco;

        if (defensePositions.includes(p.posicao_id)) {
          defensePoints += media;
        } else if (midfieldPositions.includes(p.posicao_id)) {
          midfieldPoints += media;
        } else if (attackPositions.includes(p.posicao_id)) {
          attackPoints += media;
        } else if (techPositions.includes(p.posicao_id)) {
          techPoints += media;
        }

        return {
          id: p.id,
          apelido: p.apelido,
          media,
          preco,
          posicao_id: p.posicao_id,
          foto_url: p.foto_url,
          clube: p.clubes?.abreviacao || '',
          escudo_url: p.clubes?.escudo_url || '',
        };
      });

      const expectedPointsTotal = defensePoints + midfieldPoints + attackPoints + techPoints;

      return {
        teamIndex: index,
        teamName: team.name || `Time ${index + 1}`,
        expectedPointsTotal: Math.round(expectedPointsTotal * 100) / 100,
        totalPrice: Math.round(totalPrice * 100) / 100,
        sectors: {
          defense: Math.round(defensePoints * 100) / 100,
          midfield: Math.round(midfieldPoints * 100) / 100,
          attack: Math.round(attackPoints * 100) / 100,
          tech: Math.round(techPoints * 100) / 100,
        },
        players: playersData,
      };
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro no simulador:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
