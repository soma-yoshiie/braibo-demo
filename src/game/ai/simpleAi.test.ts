import { describe, expect, it } from 'vitest';
import type { MatchState, PlayerId, TeamId, TurnPlans, Vec } from '../types';
import { createMatch, ballHolder, playersOf } from '../engine/match';
import { resolveTurn } from '../engine/resolve';
import { createRng } from '../engine/rng';
import { legalMoveTargets } from '../rules/moves';
import { estimatePass, estimateShot } from '../rules/estimates';
import { isOffsidePosition } from '../rules/offside';
import { vecEq } from '../rules/geometry';
import { planAiTurn } from './simpleAi';
import { held, scene } from '../testUtils';

const at = (x: number, y: number): Vec => ({ x, y });

function withPositions(
  base: MatchState,
  pos: Record<PlayerId, Vec>,
  ball: MatchState['ball'],
): MatchState {
  return {
    ...base,
    players: base.players.map((p) => (pos[p.id] ? { ...p, pos: pos[p.id] } : p)),
    ball,
  };
}

function checkPlan(state: MatchState, team: TeamId, seed: number): void {
  const plan = planAiTurn(state, team, createRng(seed));
  expect(plan.team).toBe(team);
  const mine = playersOf(state, team);
  const dests = new Map<PlayerId, Vec>();
  for (const p of mine) dests.set(p.id, plan.moves[p.id] ?? p.pos);
  for (const id of Object.keys(plan.moves)) expect(mine.some((p) => p.id === id)).toBe(true);
  const seen = new Set<string>();
  for (const p of mine) {
    const d = dests.get(p.id) as Vec;
    if (!vecEq(d, p.pos)) expect(legalMoveTargets(state, p.id).some((t) => vecEq(t, d))).toBe(true);
    const k = `${d.x},${d.y}`;
    expect(seen.has(k)).toBe(false);
    seen.add(k);
  }
  for (const p of mine) {
    const d = dests.get(p.id) as Vec;
    for (const q of mine) {
      if (q.id !== p.id && vecEq(dests.get(q.id) as Vec, q.pos)) expect(vecEq(d, q.pos)).toBe(false);
    }
  }
  const holder = ballHolder(state);
  if (holder && holder.team === team) {
    const a = plan.ballAction ?? { kind: 'keep' };
    if (a.kind === 'pass' || a.kind === 'cross') {
      const t = mine.find((p) => p.id === a.targetId);
      expect(t).toBeDefined();
      expect(t?.id).not.toBe(holder.id);
    }
  } else {
    expect(plan.ballAction === undefined || plan.ballAction.kind === 'keep').toBe(true);
  }
}

describe('planAiTurn', () => {
  it('always produces legal, non-colliding plans over a whole AI-vs-AI match', () => {
    let state = createMatch({ firstKickoff: 'red' });
    const rngA = createRng(7);
    const rngB = createRng(8);
    const rngR = createRng(9);
    while (state.phase !== 'finished') {
      checkPlan(state, 'red', state.turn);
      checkPlan(state, 'blue', state.turn + 100);
      const plans: TurnPlans = {
        blue: planAiTurn(state, 'blue', rngA),
        red: planAiTurn(state, 'red', rngB),
      };
      state = resolveTurn(state, plans, rngR).after;
    }
    expect(state.turn).toBe(state.maxTurns + 1);
    expect(state.phase).toBe('finished');
  });

  it('plans legally on loose balls and when the enemy holds', () => {
    const base = createMatch();
    for (const ball of [
      { kind: 'loose', pos: { x: 3, y: 4 } } as const,
      { kind: 'loose', pos: { x: 0, y: 9 } } as const,
      { kind: 'held', playerId: 'red-1' } as const,
      { kind: 'held', playerId: 'blue-0' } as const,
    ])
      for (const team of ['blue', 'red'] as const) checkPlan({ ...base, ball }, team, 3);
  });

  it('only moves its own players', () => {
    const state = createMatch();
    for (const team of ['blue', 'red'] as const) {
      const plan = planAiTurn(state, team, createRng(1));
      for (const id of Object.keys(plan.moves)) expect(id.startsWith(team)).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    const state = createMatch({ firstKickoff: 'red' });
    const a = planAiTurn(state, 'red', createRng(42));
    const b = planAiTurn(state, 'red', createRng(42));
    expect(a).toEqual(b);
  });

  it('shoots when the carrier stands right in front of an open goal', () => {
    const base = createMatch();
    const state = withPositions(
      base,
      { 'red-0': { x: 3, y: 8 }, 'red-1': { x: 0, y: 5 }, 'red-2': { x: 6, y: 5 }, 'red-3': { x: 1, y: 3 }, 'red-4': { x: 5, y: 2 } },
      { kind: 'held', playerId: 'red-0' },
    );
    const moved = { ...state, players: state.players.map((p) => (p.id.startsWith('blue') ? { ...p, pos: { x: p.index, y: p.index } } : p)) };
    expect(estimateShot(moved, 'red-0').pGoal).toBeGreaterThan(0.6);
    const plan = planAiTurn(moved, 'red', createRng(5));
    expect(plan.ballAction?.kind).toBe('shoot');
  });

  it('puts a defender on the shot line when the enemy carrier is in front of goal', () => {
    const base = createMatch();
    const state = withPositions(
      base,
      {
        'blue-0': { x: 3, y: 3 },
        'blue-1': { x: 0, y: 6 },
        'blue-2': { x: 6, y: 6 },
        'blue-3': { x: 1, y: 7 },
        'blue-4': { x: 5, y: 8 },
        'red-0': { x: 5, y: 1 },
        'red-1': { x: 0, y: 1 },
        'red-2': { x: 6, y: 3 },
        'red-3': { x: 2, y: 0 },
        'red-4': { x: 4, y: 0 },
      },
      { kind: 'held', playerId: 'blue-0' },
    );
    const plan = planAiTurn(state, 'red', createRng(11), { randomness: 0 });
    const finals = playersOf(state, 'red').map((p) => plan.moves[p.id] ?? p.pos);
    const onLine = finals.some((d) => d.x === 3 && d.y <= 2);
    expect(onLine).toBe(true);
  });

  it('goes for a reachable loose ball', () => {
    const base = createMatch();
    const ball = { x: 3, y: 4 };
    const state = withPositions(base, {}, { kind: 'loose', pos: ball });
    for (const team of ['blue', 'red'] as const) {
      const plan = planAiTurn(state, team, createRng(2));
      const reachable = playersOf(state, team).filter((p) => legalMoveTargets(state, p.id).some((t) => vecEq(t, ball)));
      if (reachable.length === 0) continue;
      expect(playersOf(state, team).some((p) => { const d = plan.moves[p.id]; return d && vecEq(d, ball); })).toBe(true);
    }
    // explicit reachable case: blue striker at (3,5) -> (3,4)
    const plan = planAiTurn(state, 'blue', createRng(2));
    expect(plan.moves['blue-0']).toEqual(ball);
  });

  it('marks an unmarked receiver in front of goal (red defending, blue striker at (3,2))', () => {
    const base = createMatch();
    const state = withPositions(
      base,
      {
        'blue-0': { x: 3, y: 2 },
        'blue-1': { x: 1, y: 3 },
        'blue-2': { x: 6, y: 6 },
        'blue-3': { x: 5, y: 7 },
        'blue-4': { x: 3, y: 8 },
        'red-0': { x: 5, y: 3 },
        'red-1': { x: 0, y: 1 },
        'red-2': { x: 6, y: 5 },
        'red-3': { x: 4, y: 1 },
        'red-4': { x: 2, y: 0 },
      },
      { kind: 'held', playerId: 'blue-1' },
    );
    const plan = planAiTurn(state, 'red', createRng(3), { randomness: 0 });
    const finals = playersOf(state, 'red').map((p) => plan.moves[p.id] ?? p.pos);
    const covers = finals.some(
      (d) =>
        (d.x === 3 && d.y < 2) || // on the receiver's shot line
        (d.x === 2 && (d.y === 2 || d.y === 3)) || // on the pass lane
        (Math.max(Math.abs(d.x - 3), Math.abs(d.y - 2)) <= 1 && !vecEq(d, { x: 3, y: 2 })), // adjacent
    );
    expect(covers).toBe(true);
  });

  it('scores against a team that never moves, and AI-vs-AI stays balanced', () => {
    const idle = (team: TeamId) => ({ team, moves: {}, ballAction: { kind: 'keep' as const } });
    let idleGoals = 0;
    let blueWins = 0;
    let redWins = 0;
    const N = 300;
    for (let s = 0; s < N; s++) {
      const r = createRng(1000 + s);
      let st = createMatch();
      while (st.phase !== 'finished') st = resolveTurn(st, { blue: idle('blue'), red: planAiTurn(st, 'red', r) }, r).after;
      idleGoals += st.score.red;
      st = createMatch({ firstKickoff: s % 2 === 0 ? 'blue' : 'red' }); // alternate kickoff for fairness
      while (st.phase !== 'finished')
        st = resolveTurn(st, { blue: planAiTurn(st, 'blue', r), red: planAiTurn(st, 'red', r) }, r).after;
      if (st.score.blue > st.score.red) blueWins++;
      else if (st.score.red > st.score.blue) redWins++;
    }
    console.log(`AI(red) vs idle: ${(idleGoals / N).toFixed(2)} goals/match; AI-vs-AI wins blue ${blueWins} red ${redWins}`);
    expect(idleGoals / N).toBeGreaterThanOrEqual(1.2);
    expect(Math.abs(blueWins - redWins)).toBeLessThanOrEqual(0.3 * Math.max(blueWins, redWins)) // 300 matches => sd of the gap is ~14 wins;
  }, 120_000);

  it('never passes to an offside receiver', () => {
    const base = createMatch();
    const state = withPositions(
      base,
      {
        'red-0': { x: 3, y: 4 },
        'red-1': { x: 3, y: 8 }, // beyond the last blue defender
        'red-2': { x: 1, y: 3 },
        'red-3': { x: 5, y: 3 },
        'red-4': { x: 3, y: 1 },
        'blue-0': { x: 2, y: 5 },
        'blue-1': { x: 4, y: 5 },
        'blue-2': { x: 0, y: 6 },
        'blue-3': { x: 6, y: 6 },
        'blue-4': { x: 3, y: 6 },
      },
      { kind: 'held', playerId: 'red-0' },
    );
    const foes: Vec[] = playersOf(state, 'blue').map((p) => p.pos);
    for (let seed = 0; seed < 25; seed++) {
      const plan = planAiTurn(state, 'red', createRng(seed));
      const a = plan.ballAction;
      if (a && (a.kind === 'pass' || a.kind === 'cross')) {
        const t = playersOf(state, 'red').find((p) => p.id === a.targetId)!;
        const tp = plan.moves[t.id] ?? t.pos;
        const cp = plan.moves['red-0'] ?? { x: 3, y: 4 };
        expect(isOffsidePosition('red', tp, cp, foes)).toBe(false);
      }
    }
  });

  it('uses a lofted pass over a defender blocking a 6-cell lane', () => {
    const base = createMatch();
    const state = withPositions(
      base,
      {
        'red-0': { x: 3, y: 1 },
        'red-1': { x: 3, y: 7 },
        'red-2': { x: 0, y: 0 },
        'red-3': { x: 6, y: 0 },
        'red-4': { x: 0, y: 1 },
        'blue-0': { x: 3, y: 4 },
        'blue-1': { x: 1, y: 3 },
        'blue-2': { x: 5, y: 3 },
        'blue-3': { x: 2, y: 6 },
        'blue-4': { x: 3, y: 9 },
      },
      { kind: 'held', playerId: 'red-0' },
    );
    const g = estimatePass(state, 'red-0', 'red-1', undefined, undefined, undefined, 'ground');
    const l = estimatePass(state, 'red-0', 'red-1', undefined, undefined, undefined, 'lofted');
    expect(l.pComplete).toBeGreaterThan(g.pComplete);
    for (let seed = 0; seed < 20; seed++) {
      const a = planAiTurn(state, 'red', createRng(seed), { randomness: 0 }).ballAction;
      if (a?.kind === 'pass' && a.targetId === 'red-1') expect(a.style).toBe('lofted');
    }
  });
});

describe('early through pass (v0.5)', () => {
  it('only sends onside runners; the carrier stays; the target is the runner\'s destination; legacy never plans one', () => {
    let seen = 0;
    for (const mode of ['early', 'legacy'] as const) {
      for (let seed = 1; seed <= 8; seed++) {
        const rng = createRng(seed);
        let st = createMatch({ throughPass: mode });
        while (st.phase !== 'finished') {
          const holder = ballHolder(st);
          const plans = { blue: planAiTurn(st, 'blue', rng), red: planAiTurn(st, 'red', rng) };
          const a = holder ? plans[holder.team].ballAction : undefined;
          if (holder && a?.kind === 'spacePass') {
            expect(mode).toBe('early');
            seen++;
            const plan = plans[holder.team];
            expect(plan.moves[holder.id]).toBeUndefined();
            const runner = playersOf(st, holder.team).find((p) => plan.moves[p.id] && vecEq(plan.moves[p.id] as Vec, a.target));
            expect(runner).toBeDefined();
            const foes = playersOf(st, holder.team === 'blue' ? 'red' : 'blue').map((p) => p.pos);
            expect(isOffsidePosition(holder.team, (runner as { pos: Vec }).pos, holder.pos, foes)).toBe(false);
          }
          st = resolveTurn(st, plans, rng).after;
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  }, 60_000);
});

describe('offside trap (v0.8)', () => {
  const seeds = Array.from({ length: 80 }, (_, i) => i + 1);
  const declares = (s: MatchState, team: TeamId) => seeds.filter((seed) => planAiTurn(s, team, createRng(seed)).trap === true).length;
  // red line y=3 (red-4); blue-1 level with it on y=3 = onside now, offside once the line steps up. Blue carrier can reach it.
  const threat = scene(
    { 'blue-0': at(3, 6), 'blue-1': at(1, 3), 'red-4': at(5, 3), 'red-3': at(6, 6) },
    held('blue-0'),
    { trap: true },
  );

  it('declares in a threatening spot, but not every time; the same seed gives the same plan', () => {
    const n = declares(threat, 'red');
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(seeds.length);
    expect(planAiTurn(threat, 'red', createRng(7))).toEqual(planAiTurn(threat, 'red', createRng(7)));
  });

  it('declared plans keep the participants out of the move list', () => {
    const seed = seeds.find((sd) => planAiTurn(threat, 'red', createRng(sd)).trap === true) as number;
    const plan = planAiTurn(threat, 'red', createRng(seed));
    expect(plan.moves['red-4']).toBeUndefined();
  });

  it('never declares when it cannot (own ball, loose ball, cooldown, switch off) or nobody can be caught', () => {
    expect(declares(scene({ 'red-0': at(3, 3), 'blue-1': at(1, 3) }, held('red-0'), { trap: true }), 'red')).toBe(0);
    expect(declares(scene({ 'blue-0': at(3, 6), 'blue-1': at(1, 3), 'red-4': at(5, 3) }, { kind: 'loose', pos: at(3, 5) }, { trap: true }), 'red')).toBe(0);
    expect(declares({ ...threat, turn: 2, trapReady: { blue: 1, red: 4 } }, 'red')).toBe(0);
    expect(declares({ ...threat, trap: false }, 'red')).toBe(0);
    // every blue is far behind the line: nobody to catch
    const safe = scene({ 'blue-0': at(3, 8), 'blue-1': at(1, 8), 'blue-2': at(2, 9), 'blue-3': at(4, 9), 'blue-4': at(5, 9), 'red-4': at(5, 3) }, held('blue-0'), { trap: true });
    expect(declares(safe, 'red')).toBe(0);
  });

  it('attackers discount a foot pass to a receiver level with the line, only while the opponent may declare', () => {
    // blue-1 is level with the red line (y=3), blue-0 carries; count how often blue passes to blue-1 while it stays level.
    const base = { 'blue-0': at(3, 6), 'blue-1': at(1, 3), 'red-4': at(5, 3), 'red-3': at(6, 6), 'blue-2': at(0, 9), 'blue-3': at(1, 9), 'blue-4': at(2, 9) };
    const passesToLevel = (opts: { trap: boolean; turn?: number; trapReady?: Record<TeamId, number> }): number => {
      const st = scene(base, held('blue-0'), opts);
      let n = 0;
      for (let seed = 1; seed <= 120; seed++) {
        const plan = planAiTurn(st, 'blue', createRng(seed));
        const a = plan.ballAction;
        const dest = plan.moves['blue-1'] ?? at(1, 3);
        if (a && (a.kind === 'pass' || a.kind === 'cross') && a.targetId === 'blue-1' && dest.y === 3) n++;
      }
      return n;
    };
    const guarded = passesToLevel({ trap: true });
    const free = passesToLevel({ trap: false });
    const cooling = passesToLevel({ trap: true, turn: 2, trapReady: { blue: 1, red: 9 } });
    expect(free).toBeGreaterThan(0);
    expect(cooling).toBe(free); // the opponent cannot declare: no discount
    expect(guarded).toBeLessThanOrEqual(free); // a discount (weight 0.06), never a reason to pass more
  });

  it('a whole match with trap and halves on stays legal', () => {
    const rng = createRng(5);
    let s = createMatch({ trap: true, halves: true });
    while (s.phase !== 'finished') {
      const p = { blue: planAiTurn(s, 'blue', rng), red: planAiTurn(s, 'red', rng) };
      s = resolveTurn(s, p, rng).after;
    }
    expect(s.turn).toBe(21);
  });
});
