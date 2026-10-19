import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeLineup, projections } from '../src/lib/lineupOptimizer.ts';

const base = [1, 2, 3, 4, 5, 6].flatMap((pos) =>
  Array.from({ length: { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 1 }[pos] }, (_, i) => ({
    id: pos * 100 + i, posicao_id: pos, clube_id: 1, preco: 5, media: 5, jogos: 10, status_id: 7,
  })));

test('selects twelve distinct probable starters within the actual budget', () => {
  const extras = [
    { ...base[0], id: 999, preco: 15, media: 12 },
    { ...base[0], id: 998, preco: 1, media: 30, status_id: 5 },
  ];
  const pool = [...base, ...extras];
  const scores = projections(pool, [], [], 'balanceada');
  const team = optimizeLineup(pool, scores, 70);
  assert.equal(team.length, 12);
  assert.equal(new Set(team.map((a) => a.id)).size, 12);
  assert.ok(team.every((a) => a.status_id === 7));
  assert.ok(team.reduce((n, a) => n + a.preco, 0) <= 70);
  assert.equal(team[0].id, 999);
  assert.deepEqual(optimizeLineup(pool, scores, 40), []);
});

test('recent negative scores count, while matches and modes affect projection', () => {
  const a = { ...base[0], media: 6 };
  const history = [
    { atleta_id: a.id, rodada: 3, pontos: -2 },
    { atleta_id: a.id, rodada: 2, pontos: 12 },
    { atleta_id: a.id, rodada: 1, pontos: 10 },
  ];
  const baseline = projections([a], history, [], 'balanceada').get(a.id);
  const home = projections([a], history, [{ time_casa_id: 1, time_fora_id: 2, xg_casa: 2, xg_fora: 0.6 }], 'balanceada').get(a.id);
  assert.ok(baseline < 6.5);
  assert.ok(home > baseline);
  assert.ok(projections([a], history, [], 'ofensiva').get(a.id) > baseline);
  assert.ok(projections([a], history, [], 'defensiva').get(a.id) < baseline);
});
