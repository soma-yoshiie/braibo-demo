import { describe, expect, it } from 'vitest';
import type { FieldPosition, MatchState, TeamId, TurnEvent, Vec } from '../types';
import { createMatch, ballHolder, getPlayer, kickoffState } from './match';
import { resolveTurn } from './resolve';
import { fixedRng } from './rng';
import { describeEvent } from './log';
import { getCharacter } from '../data/characters';
import { FORMATION, fieldSlotOrder, layoutField } from '../data/formations';
import { RULES } from '../rules/config';
import { keeperSaveProbability } from '../rules/probability';
import { estimateCross, estimateShot } from '../rules/estimates';
import { held, plans, scene } from '../testUtils';

const ev = <T extends TurnEvent['type']>(events: TurnEvent[], type: T) =>
  events.filter((e): e is Extract<TurnEvent, { type: T }> => e.type === type);
const at = (x: number, y: number): Vec => ({ x, y });
const cheb = (a: Vec, b: Vec) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const POOL: Record<FieldPosition, string[]> = {
  FW: ['st_kakeru', 'st_raiga', 'st_ouga', 'wg_hayate', 'ls_kou'],
  MF: ['wg_sora', 'wg_tsubame', 'ls_taiga', 'ls_iori', 'ic_jin'],
  DF: ['ic_shinobu', 'ic_rei', 'df_daigo', 'df_gou', 'df_genbu'],
};
/** All 21 (FW, MF, DF) head counts that add up to 5. */
const COMBOS: [number, number, number][] = [];
for (let fw = 0; fw <= 5; fw++) for (let mf = 0; mf <= 5 - fw; mf++) COMBOS.push([fw, mf, 5 - fw - mf]);
const field = ([fw, mf, df]: [number, number, number]): string[] => [...POOL.DF.slice(0, df), ...POOL.FW.slice(0, fw), ...POOL.MF.slice(0, mf)];

describe('layoutField / fieldSlotOrder', () => {
  it('there are 21 compositions', () => {
    expect(COMBOS).toHaveLength(21);
  });

  it.each(COMBOS)('FW %i / MF %i / DF %i: ordered FW, MF, DF; both phases: no overlap, on the board, rows by position, slot 0 most central', (fw, mf, df) => {
    const ids = field([fw, mf, df]); // given in a scrambled order (DF first)
    const order = fieldSlotOrder(ids);
    expect(order).toHaveLength(5);
    expect(new Set(order).size).toBe(5);
    const posOf = order.map((id) => getCharacter(id).position);
    expect(posOf).toEqual([...Array(fw).fill('FW'), ...Array(mf).fill('MF'), ...Array(df).fill('DF')]);
    for (const phase of ['kick', 'defend'] as const) {
      const cells = layoutField(order, phase);
      expect(cells).toEqual(layoutField(order, phase)); // deterministic
      expect(cells).toHaveLength(5);
      expect(new Set(cells.map((c) => `${c.x},${c.y}`)).size).toBe(5);
      const rows = phase === 'kick' ? FORMATION.rows : FORMATION.defendRows;
      const mfCols = cells.filter((_, i) => posOf[i] === 'MF').map((c) => c.x);
      cells.forEach((c, i) => {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x).toBeLessThanOrEqual(6);
        // 'defend': a DF that shares a column with a MF steps back (the two rows coincide)
        const drop = phase === 'defend' && posOf[i] === 'DF' && mfCols.includes(c.x) ? FORMATION.defendDrop : 0;
        expect(c.y).toBe(rows[posOf[i] as FieldPosition] + drop);
      });
      // every row uses exactly the columns of the table; slot 0 has the column nearest to the centre of its row
      for (const pos of ['FW', 'MF', 'DF'] as const) {
        const xs = cells.filter((_, i) => posOf[i] === pos).map((c) => c.x);
        if (xs.length > 0) expect([...xs].sort((p, q) => p - q)).toEqual(FORMATION.cols[pos][xs.length as 1 | 2 | 3 | 4 | 5]);
      }
      const front = posOf[0] as FieldPosition;
      const frontXs = cells.filter((_, i) => posOf[i] === front).map((c) => c.x);
      expect(Math.abs((cells[0] as Vec).x - 3)).toBe(Math.min(...frontXs.map((x) => Math.abs(x - 3))));
    }
    expect(layoutField(order)).toEqual(layoutField(order, 'kick')); // the phase is optional
  });

  it('defend layout: a DF on a MF cell steps back to row 8 (examples)', () => {
    const lay = (fw: number, mf: number, df: number) => {
      const order = fieldSlotOrder(field([fw, mf, df]));
      return layoutField(order, 'defend').map((c) => `${c.x},${c.y}`);
    };
    // FW 1, MF 1, DF 3: MF (3,7); DF (1,7) (3,8) (5,7)
    expect(lay(1, 1, 3)).toEqual(['3,6', '3,7', '1,7', '3,8', '5,7']);
    // standard 1-2-2: MF (1,7) (5,7), DF (2,7) (4,7): nobody drops
    expect(lay(1, 2, 2)).toEqual(['3,6', '1,7', '5,7', '2,7', '4,7']);
    // MF 2, DF 3: DF columns 1 and 5 share cells with the MFs
    expect(lay(0, 2, 3)).toEqual(['1,7', '5,7', '1,8', '3,7', '5,8']);
    // MF 3, DF 1: DF (3,7) shares a cell with the middle MF
    expect(lay(1, 3, 1).slice(1)).toEqual(['1,7', '3,7', '5,7', '3,8']);
    // kick layout has distinct rows, no dropping
    expect(layoutField(fieldSlotOrder(field([1, 1, 3])), 'kick').map((c) => c.y)).toEqual([5, 6, 7, 7, 7]);
  });

  it.each(COMBOS)('FW %i / MF %i / DF %i: either team kicks: slot 0 on the spot, kick vs defend layouts, nobody adjacent across', (fw, mf, df) => {
    const lineup = { field: field([fw, mf, df]), gk: 'gk_tsukasa' };
    const order = fieldSlotOrder(lineup.field);
    for (const first of ['blue', 'red'] as TeamId[]) {
      const m = createMatch({ lineups: { blue: lineup, red: lineup }, firstKickoff: first });
      const kicker = getPlayer(m, `${first}-0`);
      expect(kicker.pos).toEqual(first === 'blue' ? at(3, 5) : at(3, 4));
      expect(ballHolder(m)?.id).toBe(`${first}-0`);
      // slot 0 is a FW if there is one, else a MF, else a DF
      const want = fw > 0 ? 'FW' : mf > 0 ? 'MF' : 'DF';
      expect(getCharacter(kicker.charId).position).toBe(want);
      expect(new Set(m.players.map((p) => `${p.pos.x},${p.pos.y}`)).size).toBe(10); // no overlap, so nobody on the spot
      for (const p of m.players) {
        expect(p.pos.x).toBeGreaterThanOrEqual(0);
        expect(p.pos.x).toBeLessThanOrEqual(6);
        expect(p.pos.y).toBeGreaterThanOrEqual(0);
        expect(p.pos.y).toBeLessThanOrEqual(9);
      }
      // no blue / red pair touches (8-neighbourhood)
      for (const b of m.players.filter((p) => p.team === 'blue')) for (const r of m.players.filter((p) => p.team === 'red')) expect(cheb(b.pos, r.pos)).toBeGreaterThanOrEqual(2);
      // the kicking team stands in the 'kick' layout (slot 0 on the spot), the other one at its homes = 'defend' layout
      const flip = (v: Vec, team: TeamId): Vec => (team === 'blue' ? v : { x: 6 - v.x, y: 9 - v.y });
      const kickCells = layoutField(order, 'kick');
      const defendCells = layoutField(order, 'defend');
      for (const p of m.players) {
        const mine = p.team === first;
        const expected = mine ? (p.index === 0 ? FORMATION.kickoffSpot : (kickCells[p.index] as Vec)) : (defendCells[p.index] as Vec);
        expect(p.pos).toEqual(flip(expected, p.team));
        if (!mine) expect(p.pos).toEqual(m.homes?.[p.id]);
      }
    }
  });

  it('kickoffState after a goal / half time puts everybody back by the same rule', () => {
    const m = createMatch({ lineups: { blue: { field: field([1, 2, 2]), gk: 'gk_tsukasa' }, red: { field: field([0, 3, 2]), gk: 'rv_jou' } } });
    const moved: MatchState = { ...m, players: m.players.map((p) => ({ ...p, pos: at(0, 0), flags: { wonBallTurn: 1 } })) };
    const k = kickoffState(moved, 'red');
    expect(getPlayer(k, 'red-0').pos).toEqual(at(3, 4));
    expect(getCharacter(getPlayer(k, 'red-0').charId).position).toBe('MF'); // red has no FW
    expect(getPlayer(k, 'blue-0').pos).toEqual(m.homes?.['blue-0']);
    expect(k.players.every((p) => Object.keys(p.flags).length === 0)).toBe(true);
    expect(ballHolder(k)?.id).toBe('red-0');
    expect(k.keepers).toEqual(m.keepers);
  });

  it('a whole match with lineups keeps the rules: goal resets to homes, half time too', () => {
    let s = createMatch({ lineups: { blue: { field: field([1, 2, 2]), gk: 'gk_tsukasa' }, red: { field: field([2, 1, 2]), gk: 'rv_jou' } } });
    const homes = s.homes;
    s = { ...s, turn: 10 };
    const r = resolveTurn(s, plans(), fixedRng([0.5]));
    expect(ev(r.events, 'halfTime')).toHaveLength(1);
    expect(getPlayer(r.after, 'red-0').pos).toEqual(at(3, 4)); // red kicks the second half
    expect(getPlayer(r.after, 'blue-3').pos).toEqual(homes?.['blue-3']);
  });
});

describe('keeper save', () => {
  const stats = getCharacter('gk_tsukasa').stats; // block 60, aerial 68
  it('keeperSaveProbability: formula, farther is easier, clamped at both ends', () => {
    const k = RULES.keeper;
    expect(keeperSaveProbability('shot', 2, stats)).toBeCloseTo(k.base + k.perCell * 2 + (60 - 50) / k.statDivisor, 10);
    expect(keeperSaveProbability('shot', 4, stats)).toBeGreaterThan(keeperSaveProbability('shot', 2, stats));
    expect(keeperSaveProbability('header', 1, stats)).toBeCloseTo(k.headerBase + (68 - 50) / k.statDivisor, 10);
    expect(keeperSaveProbability('header', 1, stats)).toBe(keeperSaveProbability('header', 9, stats)); // distance is irrelevant
    const awful = { ...stats, block: 1, aerial: 1 };
    const god = { ...stats, block: 99, aerial: 99 };
    expect(keeperSaveProbability('shot', 0, awful)).toBe(k.min);
    expect(keeperSaveProbability('header', 0, awful)).toBe(k.min);
    expect(keeperSaveProbability('shot', 20, god)).toBe(k.max);
    expect(keeperSaveProbability('header', 20, { ...god, aerial: 1000 })).toBe(k.max);
  });

  const shooter = { 'blue-0': at(3, 2) };
  const shoot = { ballAction: { kind: 'shoot' } } as const;
  const run = (keepers: { red?: string } | undefined, r: number) =>
    resolveTurn(scene(shooter, held('blue-0'), keepers ? { keepers } : {}), plans(shoot), fixedRng([r]));

  it('one draw: goal below pShot(1-pSave), saved up to pShot, then off target; goal kick for save and miss', () => {
    const none = run(undefined, 0.999);
    const pShot = ev(none.events, 'shot')[0]?.pGoal as number;
    expect(pShot).toBeGreaterThan(0);
    expect(ev(none.events, 'shot')[0]?.pSave).toBeUndefined();
    const pSave = keeperSaveProbability('shot', Math.hypot(0, 2.5), stats);
    const goal = run({ red: 'gk_tsukasa' }, pShot * (1 - pSave) - 1e-9);
    expect(ev(goal.events, 'shot')[0]).toMatchObject({ outcome: 'goal', pSave });
    expect(ev(goal.events, 'shot')[0]?.pGoal).toBeCloseTo(pShot * (1 - pSave), 10);
    expect(ev(goal.events, 'goal')).toHaveLength(1);
    const edge = run({ red: 'gk_tsukasa' }, pShot * (1 - pSave));
    expect(ev(edge.events, 'shot')[0]?.outcome).toBe('saved'); // exactly on the boundary is not a goal
    const mid = run({ red: 'gk_tsukasa' }, pShot - 1e-9);
    expect(ev(mid.events, 'shot')[0]?.outcome).toBe('saved');
    expect(ev(mid.events, 'goalKick')).toHaveLength(1);
    expect(ev(mid.events, 'goal')).toHaveLength(0);
    expect(mid.after.score).toEqual({ blue: 0, red: 0 });
    expect(describeEvent(ev(mid.events, 'shot')[0] as TurnEvent, mid.after)).toContain('セーブ');
    const miss = run({ red: 'gk_tsukasa' }, pShot + 1e-9);
    expect(ev(miss.events, 'shot')[0]?.outcome).toBe('missed');
    expect(ev(miss.events, 'goalKick')).toHaveLength(1);
  });

  it('without a keeper the same draw gives exactly the old goal / miss (no saved ever)', () => {
    const pShot = ev(run(undefined, 0.999).events, 'shot')[0]?.pGoal as number;
    for (const r of [0, pShot - 1e-9, pShot, pShot + 1e-9, 0.999]) {
      const o = ev(run(undefined, r).events, 'shot')[0];
      expect(o?.outcome).toBe(r < pShot ? 'goal' : 'missed');
    }
  });

  it('a better keeper saves more: cutoff moves with the block stat', () => {
    const lo = run({ red: 'gk_tsukasa' }, 0).events;
    const pLo = ev(lo, 'shot')[0]?.pSave as number;
    const pHi = ev(run({ red: 'gk_mikoto' }, 0).events, 'shot')[0]?.pSave as number;
    expect(pHi).toBeGreaterThan(pLo);
  });

  it('header: one draw, saved by the keeper aerial', () => {
    const pos = { 'blue-1': at(1, 3), 'blue-0': at(3, 1), 'red-4': at(2, 1) };
    const cross = { ballAction: { kind: 'cross', targetId: 'blue-0' } } as const;
    const base = (r: number, keepers?: { red: string }) =>
      resolveTurn(scene(pos, held('blue-1'), keepers ? { keepers } : {}), plans(cross), fixedRng([0.0, 0.1, r]));
    const pH = ev(base(0.999).events, 'shot')[0]?.pGoal as number;
    const pSave = keeperSaveProbability('header', 1.5, stats);
    expect(ev(base(pH * (1 - pSave) - 1e-9, { red: 'gk_tsukasa' }).events, 'shot')[0]).toMatchObject({ kind: 'header', outcome: 'goal', pSave });
    const saved = base(pH - 1e-9, { red: 'gk_tsukasa' });
    expect(ev(saved.events, 'shot')[0]?.outcome).toBe('saved');
    expect(ev(saved.events, 'goal')).toHaveLength(0);
    expect(ev(base(pH + 1e-9, { red: 'gk_tsukasa' }).events, 'shot')[0]?.outcome).toBe('missed');
    expect(ev(base(pH - 1e-9).events, 'shot')[0]?.outcome).toBe('goal'); // no keeper: as before
  });

  it('estimates include the keeper; no keeper = pSave 0 and the old numbers', () => {
    const s0 = scene(shooter, held('blue-0'));
    const s1 = scene(shooter, held('blue-0'), { keepers: { red: 'gk_tsukasa' } });
    const a = estimateShot(s0, 'blue-0');
    const b = estimateShot(s1, 'blue-0');
    expect(a.pSave).toBe(0);
    expect(b.pSave).toBeCloseTo(keeperSaveProbability('shot', a.distance, stats), 10);
    expect(b.pGoalIfUnblocked).toBeCloseTo(a.pGoalIfUnblocked * (1 - b.pSave), 10);
    expect(b.pGoal).toBeCloseTo(a.pGoal * (1 - b.pSave), 10);
    // the estimate matches what the engine reports
    const r = resolveTurn(s1, plans(shoot), fixedRng([0.999]));
    expect(ev(r.events, 'shot')[0]?.pGoal).toBeCloseTo(b.pGoalIfUnblocked, 10);
    const pos = { 'blue-1': at(1, 3), 'blue-0': at(3, 1) };
    const c0 = estimateCross(scene(pos, held('blue-1')), 'blue-1', 'blue-0');
    const c1 = estimateCross(scene(pos, held('blue-1'), { keepers: { red: 'gk_tsukasa' } }), 'blue-1', 'blue-0');
    expect(c1.pHeaderGoal).toBeCloseTo(c0.pHeaderGoal * (1 - keeperSaveProbability('header', 1.5, stats)), 10);
  });

  it('only the defending team keeper counts', () => {
    const s = scene(shooter, held('blue-0'), { keepers: { blue: 'gk_mikoto' } });
    expect(estimateShot(s, 'blue-0').pSave).toBe(0);
  });
});
