export const BENCH_POSITIONS = [1, 2, 3, 4, 5] as const;

export type AthleteInfo = {
  id: number;
  posicao_id: number;
  preco: number;
  apelido: string;
  clube_id: number | null;
  status_id?: number | null;
};
export type AthletePoint = { points: number; played: boolean | null };
export type Fixture = { kickoff: number | null; finished: boolean };
export type Substitution = { outId: number; inId: number; position: number; captain: boolean };

export function validateBench(starters: number[], bench: number[], athletes: Map<number, AthleteInfo>): string | null {
  if (bench.length !== 5 || bench.some(id => !Number.isSafeInteger(id) || id <= 0))
    return "Escalone cinco reservas válidos, um por posição.";
  if (new Set([...starters, ...bench]).size !== starters.length + 5)
    return "O banco não pode repetir titulares ou outros reservas.";
  for (let index = 0; index < BENCH_POSITIONS.length; index++) {
    const position = BENCH_POSITIONS[index];
    const athlete = athletes.get(bench[index]);
    const startersAtPosition = starters.map(id => athletes.get(id)).filter(a => a?.posicao_id === position);
    if (!athlete || athlete.posicao_id !== position || !startersAtPosition.length)
      return "Cada reserva deve ocupar a posição correspondente ao titular.";
    if (athlete.status_id !== 7)
      return `${athlete.apelido} não está com status provável no mercado.`;
    const cheapest = Math.min(...startersAtPosition.map(a => Number(a!.preco)));
    if (Math.round(athlete.preco * 100) > Math.round(cheapest * 100))
      return `${athlete.apelido} custa mais que o titular mais barato da posição (C$ ${cheapest.toFixed(2)}).`;
  }
  return null;
}

// The regular Cartola bench can replace one confirmed absence per position.
// With simultaneous matches: captain, then the higher-priced starter, then name.
export function resolveBench(
  starters: number[], captainId: number | null, bench: number[],
  points: Map<number, AthletePoint>, athletes: Map<number, AthleteInfo>,
  fixtures: Map<number, Fixture>, roundFinished: boolean,
): Substitution[] {
  const substitutions: Substitution[] = [];
  for (let index = 0; index < BENCH_POSITIONS.length; index++) {
    const position = BENCH_POSITIONS[index];
    const reserveId = bench[index];
    const reserve = athletes.get(reserveId);
    const reservePoints = points.get(reserveId);
    if (!reserve || reserve.posicao_id !== position || !reservePoints || reservePoints.played === false || reservePoints.points <= 0)
      continue;
    const absent = starters.filter(id => {
      const athlete = athletes.get(id);
      if (athlete?.posicao_id !== position) return false;
      const fixture = fixtures.get(athlete.clube_id ?? 0);
      if (!fixture?.finished && !roundFinished) return false;
      const result = points.get(id);
      return !result || result.played === false;
    });
    absent.sort((a, b) => {
      const first = athletes.get(a)!, second = athletes.get(b)!;
      const aTime = fixtures.get(first.clube_id ?? 0)?.kickoff ?? Number.POSITIVE_INFINITY;
      const bTime = fixtures.get(second.clube_id ?? 0)?.kickoff ?? Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return aTime - bTime;
      if (a === captainId) return -1;
      if (b === captainId) return 1;
      if (first.preco !== second.preco) return second.preco - first.preco;
      return first.apelido.localeCompare(second.apelido, "pt-BR");
    });
    if (absent.length) substitutions.push({outId: absent[0], inId: reserveId, position, captain: absent[0] === captainId});
  }
  return substitutions;
}
