export type Strategy = "balanceada" | "ofensiva" | "defensiva";

export interface Candidate {
  id: number;
  posicao_id: number | null;
  clube_id: number | null;
  preco: number | null;
  media: number | null;
  jogos: number | null;
  status_id: number | null;
}

export interface Matchup {
  time_casa_id: number | null;
  time_fora_id: number | null;
  xg_casa: number | null;
  xg_fora: number | null;
}

export interface HistoryPoint { atleta_id: number; rodada: number; pontos: number }

export const FORMATION: Record<number, number> = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 1 };

const price = (a: Candidate) => Math.round(Number(a.preco) * 100);

export function projections<T extends Candidate>(athletes: T[], history: HistoryPoint[], matches: Matchup[], strategy: Strategy): Map<number, number> {
  const recent = new Map<number, HistoryPoint[]>();
  for (const point of history) {
    const list = recent.get(point.atleta_id) ?? [];
    list.push(point);
    recent.set(point.atleta_id, list);
  }
  const matchup = new Map<number, { home: boolean; ownXg: number; rivalXg: number }>();
  for (const m of matches) {
    if (m.time_casa_id != null) matchup.set(m.time_casa_id, { home: true, ownXg: Number(m.xg_casa), rivalXg: Number(m.xg_fora) });
    if (m.time_fora_id != null) matchup.set(m.time_fora_id, { home: false, ownXg: Number(m.xg_fora), rivalXg: Number(m.xg_casa) });
  }
  return new Map(athletes.map((a) => {
    const season = Math.max(0, Number(a.media) || 0);
    const points = (recent.get(a.id) ?? []).sort((x, y) => y.rodada - x.rodada).slice(0, 5).map((p) => Number(p.pontos));
    const weights = [5, 4, 3, 2, 1];
    const recentAverage = points.length ? points.reduce((sum, p, i) => sum + p * weights[i], 0) / weights.slice(0, points.length).reduce((x, y) => x + y, 0) : season;
    // Small samples stay close to the full season; negative scouts remain part of the sample.
    const formWeight = Math.min(0.45, points.length * 0.09);
    let expected = season * (1 - formWeight) + recentAverage * formWeight;
    const fixture = matchup.get(a.clube_id ?? -1);
    if (fixture) {
      const attack = Number.isFinite(fixture.ownXg) ? Math.max(-0.2, Math.min(0.2, (fixture.ownXg - 1) * 0.12)) : 0;
      const defense = Number.isFinite(fixture.rivalXg) ? Math.max(-0.2, Math.min(0.2, (1 - fixture.rivalXg) * 0.12)) : 0;
      expected *= 1 + (fixture.home ? 0.04 : -0.02) + (a.posicao_id === 1 || a.posicao_id === 2 || a.posicao_id === 3 ? defense : attack);
    }
    const upside = points.length >= 3 ? Math.sqrt(points.reduce((sum, p) => sum + (p - recentAverage) ** 2, 0) / points.length) : 0;
    // The modes change the risk preference, not a fictitious position/price bonus.
    const risk = strategy === "ofensiva" ? 0.12 : strategy === "defensiva" ? -0.12 : 0;
    return [a.id, Math.max(0, expected + risk * Math.min(8, upside))];
  }));
}

interface State<T> { picks: T[]; cost: number; score: number }

export function optimizeLineup<T extends Candidate>(athletes: T[], values: Map<number, number>, budget: number): T[] {
  const cap = Math.round(budget * 100);
  if (!Number.isFinite(cap) || cap <= 0) return [];
  const fixtures: T[][] = [];
  for (const [position, count] of Object.entries(FORMATION)) {
    const candidates = athletes.filter((a) => a.posicao_id === Number(position) && a.status_id === 7 &&
      (a.jogos ?? 0) >= 1 && Number.isFinite(Number(a.preco)) && price(a) > 0 && price(a) <= cap);
    // Keep strong and affordable candidates so a budget tradeoff remains possible.
    const best = [...candidates].sort((a, b) => (values.get(b.id) ?? 0) - (values.get(a.id) ?? 0)).slice(0, 24);
    const cheap = [...candidates].sort((a, b) => price(a) - price(b)).slice(0, 12);
    const pool = [...new Map([...best, ...cheap].map((a) => [a.id, a])).values()];
    if (pool.length < count) return [];
    for (let slot = 0; slot < count; slot++) fixtures.push(pool);
  }
  let states: State<T>[] = [{ picks: [], cost: 0, score: 0 }];
  for (const pool of fixtures) {
    const buckets = new Map<number, State<T>>();
    for (const state of states) for (const a of pool) {
      const cost = state.cost + price(a);
      if (cost > cap || state.picks.some((p) => p.id === a.id)) continue;
      const score = state.score + (values.get(a.id) ?? 0);
      // At each 20 cent cost bucket retain the best roster. Final validation uses exact cents.
      const key = Math.ceil(cost / 20);
      const previous = buckets.get(key);
      if (!previous || score > previous.score || (score === previous.score && cost < previous.cost))
        buckets.set(key, { picks: [...state.picks, a], cost, score });
    }
    states = [...buckets.values()].sort((a, b) => b.score - a.score).slice(0, 1200);
    if (!states.length) return [];
  }
  return states[0].picks.sort((a, b) => (a.posicao_id ?? 0) - (b.posicao_id ?? 0));
}
