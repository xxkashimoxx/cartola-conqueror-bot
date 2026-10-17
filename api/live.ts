import { ownerOnly } from "../server/owner.js";

// Consulta segura e sem cache às parciais oficiais; nunca reutiliza pontos de uma rodada anterior.
export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET obrigatório" });
  if (!ownerOnly(req, res)) return;
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const a = await fetch("https://api.cartolafc.globo.com/mercado/status", {
      signal: AbortSignal.timeout(9000),
      headers: { Accept: "application/json" },
    });
    if (!a.ok) throw new Error("Status do mercado indisponível");
    const mercado: any = await a.json();
    const rodada = Number(mercado.rodada_atual);
    if (!Number.isSafeInteger(rodada) || rodada < 1 || rodada > 38) throw new Error("Rodada inválida");
    const base = {
      success: true, temporada: mercado.temporada, rodada,
      bolaRolando: !!mercado.bola_rolando, status_mercado: mercado.status_mercado,
      atualizado_em: new Date().toISOString()
    };
    // Com o mercado aberto, o endpoint de parciais pode devolver a rodada anterior.
    // Retornar vazio evita exibir pontos antigos como se fossem atuais.
    if (Number(mercado.status_mercado) === 1) {
      return res.status(200).json({ ...base, scores: [], parciaisDisponiveis: false });
    }
    const b = await fetch("https://api.cartolafc.globo.com/atletas/pontuados", {
      signal: AbortSignal.timeout(9000),
      headers: { Accept: "application/json" },
    });
    if (!b.ok) throw new Error("Pontuações parciais indisponíveis");
    const parciais: any = await b.json();
    const list = Object.entries(parciais.atletas || {});
    const scores = list.map(([id, atleta]: [string, any]) => ({
      atleta_id: Number(id), pontos: Number(atleta.pontuacao) || 0,
      scout: atleta.scout || {}, jogou: atleta.entrou_em_campo === true || atleta.entrou_em_campo === 1,
      atualizado_em: new Date().toISOString()
    })).filter((atleta) => Number.isSafeInteger(atleta.atleta_id) && atleta.atleta_id > 0);
    return res.status(200).json({ ...base, scores, parciaisDisponiveis: scores.length > 0 });
  } catch (err) {
    console.error("Live Cartola", err);
    return res.status(503).json({ success: false, error: "Parciais oficiais temporariamente indisponíveis" });
  }
}
