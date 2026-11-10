import { describe, expect, it } from 'vitest';
import type { TurnEvent, Vec } from '../types';
import { resolveTurn } from './resolve';
import { ballHolder, getPlayer } from './match';
import { fixedRng } from './rng';
import { describeEvent } from './log';
import { estimateThroughPass } from '../rules/estimates';
import { held, plans, scene } from '../testUtils';

const ev = <T extends TurnEvent['type']>(events: TurnEvent[], type: T) =>
  events.filter((e): e is Extract<TurnEvent, { type: T }> => e.type === type);

const draws = (values: number[]) => {
  const inner = fixedRng(values);
  let n = 0;
  return { rng: { next: () => (n++, inner.next()) }, count: () => n };
};

const sp = (x: number, y: number, style?: 'ground' | 'lofted') =>
  ({ ballAction: { kind: 'spacePass', target: { x, y }, ...(style ? { style } : {}) } }) as const;
const at = (x: number, y: number): Vec => ({ x, y });

// Unspecified reds are parked at (6,9) (6,8) (6,7) (6,6) (6,5); unspecified blues at column 0.
describe('early through pass (v0.5)', () => {
  describe('(a) running onto the ball behind the line', () => {
    const pos = { 'blue-0': at(3, 6), 'blue-1': at(1, 4), 'red-4': at(5, 3), 'red-3': at(6, 6) };
    it('onside at the start, receives behind the line: complete, even if the defence steps up', () => {
      const s = scene(pos, held('blue-0'));
      const d = draws([0.0]);
      const r = resolveTurn(s, plans({ ...sp(1, 2), moves: { 'blue-1': at(1, 2) } }, { moves: { 'red-4': at(5, 4) } }), d.rng);
      expect(ev(r.events, 'offside')).toHaveLength(0);
      expect(ev(r.events, 'pass')[0]).toMatchObject({
        space: true, early: true, outcome: 'complete', receiverId: 'blue-1', from: at(3, 6), to: at(1, 2),
      });
      expect(ballHolder(r.after)?.id).toBe('blue-1');
      expect(getPlayer(r.after, 'blue-1').flags.receivedPassTurn).toBe(1);
      expect(getPlayer(r.after, 'blue-1').pos).toEqual(at(1, 2));
      expect(d.count()).toBe(1);
      // event order: moves, then the pass
      const types = r.events.map((e) => e.type);
      expect(types.indexOf('move')).toBeLessThan(types.indexOf('pass'));
      expect(describeEvent(ev(r.events, 'pass')[0] as TurnEvent, r.after)).toContain('スルーパス');
    });
    it('legacy mode judges the same plan on final positions: offside', () => {
      const s = scene(pos, held('blue-0'), { throughPass: 'legacy' });
      const r = resolveTurn(s, plans({ ...sp(1, 2), moves: { 'blue-1': at(1, 2) } }), fixedRng([0.0]));
      expect(ev(r.events, 'offside')[0]).toMatchObject({ receiverId: 'blue-1' });
      expect(ev(r.events, 'offside')[0]?.early).toBeUndefined();
    });
  });

  describe('(b) offside position at the start', () => {
    it('is offside (early: true); the ball goes to the nearest defender; the kick roll was still spent', () => {
      const s = scene({ 'blue-0': at(3, 6), 'blue-1': at(3, 2), 'red-4': at(5, 3), 'red-3': at(6, 6) }, held('blue-0'));
      const d = draws([0.0]);
      const r = resolveTurn(s, plans(sp(3, 2)), d.rng);
      expect(ev(r.events, 'offside')[0]).toMatchObject({
        early: true, receiverId: 'blue-1', toPlayerId: 'red-4', from: at(3, 6), to: at(3, 2), style: 'ground',
      });
      expect(ev(r.events, 'pass')).toHaveLength(0);
      expect(ballHolder(r.after)?.id).toBe('red-4');
      expect(getPlayer(r.after, 'red-4').flags.wonBallTurn).toBeUndefined();
      expect(d.count()).toBe(1); // accuracy only
      expect(describeEvent(ev(r.events, 'offside')[0] as TurnEvent, r.after)).toContain('（蹴った時点の位置で）');
    });
    it('a defender who drops back so the receiver would be onside at the end: still offside (start line counts)', () => {
      const s = scene({ 'blue-0': at(3, 6), 'blue-1': at(3, 2), 'red-4': at(5, 3), 'red-3': at(6, 6) }, held('blue-0'));
      const r = resolveTurn(s, plans(sp(3, 2), { moves: { 'red-4': at(5, 2) } }), fixedRng([0.0]));
      expect(getPlayer(r.after, 'red-4').pos).toEqual(at(5, 2)); // really moved: final line y=2, blue-1 (y=2) would be level
      expect(ev(r.events, 'offside')[0]).toMatchObject({ early: true, receiverId: 'blue-1' });
      expect(ev(r.events, 'pass')).toHaveLength(0);
    });
  });

  describe('(c) the kicker does not move', () => {
    const s = scene({ 'blue-0': at(3, 6), 'red-4': at(4, 6) }, held('blue-0'));
    it('ignores its move order; an enemy entering its cell causes no duel and no draw', () => {
      const d = draws([0.0]);
      const r = resolveTurn(s, plans({ ...sp(3, 2), moves: { 'blue-0': at(3, 5) } }, { moves: { 'red-4': at(3, 6) } }), d.rng);
      expect(getPlayer(r.after, 'blue-0').pos).toEqual(at(3, 6));
      expect(getPlayer(r.after, 'red-4').pos).toEqual(at(3, 6));
      expect(ev(r.events, 'duel')).toHaveLength(0);
      expect(ev(r.events, 'move').find((e) => e.playerId === 'blue-0')).toBeUndefined();
      expect(r.after.ball).toEqual({ kind: 'loose', pos: at(3, 2) });
      expect(d.count()).toBe(1);
    });
    it('a teammate moving into the kicker\'s cell is bounced back', () => {
      const s2 = scene({ 'blue-0': at(3, 6), 'blue-1': at(2, 6) }, held('blue-0'));
      const r = resolveTurn(s2, plans({ ...sp(3, 2), moves: { 'blue-1': at(3, 6) } }), fixedRng([0.0]));
      expect(ev(r.events, 'bounce')[0]).toMatchObject({ playerId: 'blue-1' });
      expect(getPlayer(r.after, 'blue-1').pos).toEqual(at(2, 6));
    });
  });

  describe('(d) the lane uses start positions', () => {
    it('an enemy that moves ONTO the lane does not cut it', () => {
      const s = scene({ 'blue-0': at(3, 6), 'red-4': at(4, 3) }, held('blue-0'));
      const d = draws([0.0]);
      const r = resolveTurn(s, plans(sp(3, 2)), d.rng); // no mover: sanity (nobody on lane)
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'loose' });
      const d2 = draws([0.0]);
      const r2 = resolveTurn(s, plans(sp(3, 2), { moves: { 'red-4': at(3, 4) } }), d2.rng);
      expect(ev(r2.events, 'pass')[0]).toMatchObject({ outcome: 'loose', early: true });
      expect(d2.count()).toBe(1);
    });
    it('an enemy that starts ON the lane and moves away still cuts it', () => {
      const s = scene({ 'blue-0': at(3, 6), 'red-4': at(3, 4) }, held('blue-0'));
      const d = draws([0.0]);
      const r = resolveTurn(s, plans(sp(3, 2), { moves: { 'red-4': at(4, 4) } }), d.rng);
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'intercepted', interceptorId: 'red-4', early: true });
      expect(ballHolder(r.after)?.id).toBe('red-4');
      expect(getPlayer(r.after, 'red-4').pos).toEqual(at(4, 4));
      expect(getPlayer(r.after, 'red-4').flags.wonBallTurn).toBe(1);
      expect(d.count()).toBe(1);
    });
  });

  describe('(e) who is on the target cell afterwards', () => {
    it('enemy only -> toEnemy', () => {
      const s = scene({ 'blue-0': at(3, 6), 'red-4': at(4, 3) }, held('blue-0'));
      const d = draws([0.0]);
      const r = resolveTurn(s, plans(sp(3, 2), { moves: { 'red-4': at(3, 2) } }), d.rng);
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'toEnemy', receiverId: 'red-4', early: true });
      expect(ballHolder(r.after)?.id).toBe('red-4');
      expect(getPlayer(r.after, 'red-4').flags.wonBallTurn).toBe(1);
      expect(d.count()).toBe(1);
    });
    const both = scene({ 'blue-0': at(3, 6), 'blue-1': at(2, 3), 'red-4': at(4, 3) }, held('blue-0'));
    const bothPlans = plans({ ...sp(3, 2), moves: { 'blue-1': at(3, 2) } }, { moves: { 'red-4': at(3, 2) } });
    it('teammate + enemy: one tight-marker roll; miss -> complete', () => {
      const d = draws([0.0, 0.99]);
      const r = resolveTurn(both, bothPlans, d.rng);
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'complete', receiverId: 'blue-1' });
      expect(d.count()).toBe(2);
    });
    it('teammate + enemy: marker hit -> intercepted', () => {
      const d = draws([0.0, 0.0]);
      const r = resolveTurn(both, bothPlans, d.rng);
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'intercepted', interceptorId: 'red-4' });
      expect(ballHolder(r.after)?.id).toBe('red-4');
      expect(d.count()).toBe(2);
    });
    it('nobody -> loose ball on the target', () => {
      const r = resolveTurn(scene({ 'blue-0': at(3, 6) }, held('blue-0')), plans(sp(3, 2)), fixedRng([0.0]));
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'loose', loosePos: at(3, 2) });
      expect(r.after.ball).toEqual({ kind: 'loose', pos: at(3, 2) });
    });
  });

  describe('(f) inaccurate kick', () => {
    it('scatters next to the target, judged on final positions', () => {
      const s = scene({ 'blue-0': at(3, 6) }, held('blue-0'));
      const d = draws([0.99, 0.0]);
      const r = resolveTurn(s, plans(sp(3, 2)), d.rng);
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'failed', early: true });
      expect(r.after.ball.kind).toBe('loose');
      if (r.after.ball.kind === 'loose') {
        expect(Math.max(Math.abs(r.after.ball.pos.x - 3), Math.abs(r.after.ball.pos.y - 2))).toBe(1);
      }
      expect(d.count()).toBe(2);
    });
  });

  describe('(g) unusable target: normal keep turn, actionCancelled after the moves (like legacy)', () => {
    for (const [label, t, reason] of [
      ['out of range', sp(3, 0), 'outOfRange'],
      ['off the board', sp(9, 9), 'invalidTarget'],
      ['own cell', sp(3, 6), 'invalidTarget'],
    ] as const) {
      it(label, () => {
        const s = scene({ 'blue-0': at(3, 6), 'red-4': at(4, 5) }, held('blue-0'));
        const d = draws([0.0]);
        const r = resolveTurn(s, plans({ ...t, moves: { 'blue-0': at(3, 5) } }, { moves: { 'red-4': at(3, 5) } }), d.rng);
        expect(ev(r.events, 'actionCancelled')).toHaveLength(1);
        expect(r.events[r.events.length - 1]).toMatchObject({ type: 'actionCancelled', action: 'pass', reason });
        expect(r.events.map((e) => e.type).indexOf('duel')).toBeLessThan(r.events.length - 1);
        expect(ev(r.events, 'pass')).toHaveLength(0);
        expect(getPlayer(r.after, 'blue-0').pos).toEqual(at(3, 5)); // the move order is honoured
        expect(ballHolder(r.after)?.id).toBe('blue-0');
        expect(d.count()).toBe(1); // the duel only
      });
    }
    it('losing the ball in the duel: no actionCancelled', () => {
      const s = scene({ 'blue-0': at(3, 6), 'red-4': at(4, 5) }, held('blue-0'));
      const r = resolveTurn(s, plans({ ...sp(3, 0), moves: { 'blue-0': at(3, 5) } }, { moves: { 'red-4': at(3, 5) } }), fixedRng([0.99]));
      expect(ballHolder(r.after)?.id).toBe('red-4');
      expect(ev(r.events, 'actionCancelled')).toHaveLength(0);
    });
  });

  describe('(h) rng order: lane -> accuracy -> tight marker (one roll per defender)', () => {
    // red-1 stands on the lane at the start; red-4 starts beside it and steps onto the target.
    const mk = (markerMoves: 'red-1' | 'red-4') =>
      [
        scene({ 'blue-0': at(3, 6), 'blue-1': at(3, 5), 'red-1': at(3, 4), 'red-4': at(4, 3) }, held('blue-0')),
        plans({ ...sp(3, 3), moves: { 'blue-1': at(3, 3) } }, { moves: { [markerMoves]: at(3, 3) } }),
      ] as const;
    it('a lane roller who ends on the target is NOT rolled again: complete after 2 draws', () => {
      const [s, pl] = mk('red-1');
      const d = draws([0.99, 0.0, 0.0]);
      const r = resolveTurn(s, pl, d.rng);
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'complete', receiverId: 'blue-1', early: true });
      expect(ev(r.events, 'pass')[0]?.marked).toBeUndefined();
      expect(d.count()).toBe(2);
    });
    it('another defender on the target: lane miss, accuracy ok, marker hit -> intercepted, marked: true, 3 draws', () => {
      const [s, pl] = mk('red-4');
      const d = draws([0.99, 0.0, 0.0]);
      const r = resolveTurn(s, pl, d.rng);
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'intercepted', interceptorId: 'red-4', marked: true });
      expect(ballHolder(r.after)?.id).toBe('red-4');
      expect(d.count()).toBe(3);
    });
    it('marker miss -> complete after 3 draws', () => {
      const [s, pl] = mk('red-4');
      const d = draws([0.99, 0.0, 0.99]);
      const r = resolveTurn(s, pl, d.rng);
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'complete', receiverId: 'blue-1' });
      expect(d.count()).toBe(3);
    });
    it('a lane cut is not marked and stops everything after 1 draw', () => {
      const [s, pl] = mk('red-4');
      const d = draws([0.0]);
      const r = resolveTurn(s, pl, d.rng);
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'intercepted', interceptorId: 'red-1' });
      expect(ev(r.events, 'pass')[0]?.marked).toBeUndefined();
      expect(d.count()).toBe(1);
    });
    it('lane miss then accuracy miss -> scatter draw (3 draws), no marker roll', () => {
      const [s, pl] = mk('red-4');
      const d = draws([0.99, 0.99, 0.0]);
      const r = resolveTurn(s, pl, d.rng);
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'failed' });
      expect(d.count()).toBe(3);
    });
  });

  describe('lofted early through pass', () => {
    it('only defenders near the kicker / the landing point can cut it (ground would be cut mid-lane)', () => {
      const s = scene({ 'blue-0': at(3, 7), 'red-4': at(3, 4) }, held('blue-0'));
      const g = draws([0.0]);
      expect(ev(resolveTurn(s, plans(sp(3, 2, 'ground')), g.rng).events, 'pass')[0]).toMatchObject({ outcome: 'intercepted' });
      const l = draws([0.0]);
      const r = resolveTurn(s, plans(sp(3, 2, 'lofted')), l.rng);
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'loose', style: 'lofted', early: true });
      expect(l.count()).toBe(1); // accuracy only
    });
    it('a defender within 1.5 of the kicker still cuts it', () => {
      const s = scene({ 'blue-0': at(3, 7), 'red-4': at(3, 6) }, held('blue-0'));
      const r = resolveTurn(s, plans(sp(3, 2, 'lofted')), fixedRng([0.0]));
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'intercepted', interceptorId: 'red-4' });
    });
    it('tight marker on the landing cell uses the aerial stat; marked: true', () => {
      const s = scene({ 'blue-0': at(3, 7), 'blue-1': at(2, 3), 'red-4': at(4, 3) }, held('blue-0'));
      const d = draws([0.0, 0.0]);
      const r = resolveTurn(s, plans({ ...sp(3, 2, 'lofted'), moves: { 'blue-1': at(3, 2) } }, { moves: { 'red-4': at(3, 2) } }), d.rng);
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'intercepted', interceptorId: 'red-4', marked: true, style: 'lofted' });
      expect(d.count()).toBe(2);
    });
  });

  describe('estimateThroughPass', () => {
    it('range, offside of the named receiver, no tight markers, current positions only', () => {
      const s = scene({ 'blue-0': at(3, 7), 'blue-1': at(3, 2), 'red-4': at(5, 3) }, held('blue-0'));
      expect(estimateThroughPass(s, 'blue-0', at(3, 2)).inRange).toBe(true);
      const far = estimateThroughPass(s, 'blue-0', at(3, 1));
      expect(far.inRange).toBe(false);
      expect(far.pComplete).toBe(0);
      expect(estimateThroughPass(s, 'blue-0', at(3, 1), 'lofted').inRange).toBe(true);
      expect(estimateThroughPass(s, 'blue-0', at(3, 7)).inRange).toBe(false); // own cell
      const off = estimateThroughPass(s, 'blue-0', at(3, 2), 'ground', 'blue-1');
      expect(off.offside).toBe(true);
      expect(off.pComplete).toBe(0);
      expect(estimateThroughPass(s, 'blue-0', at(3, 2), 'ground').offside).toBe(false);
      // an enemy standing on the target cell is not a lane interceptor (no tight marker)
      const marked = scene({ 'blue-0': at(3, 7), 'red-4': at(3, 2) }, held('blue-0'));
      expect(estimateThroughPass(marked, 'blue-0', at(3, 2)).interceptors).toHaveLength(0);
      // an enemy on the lane now counts, wherever it is going next turn
      const lane = scene({ 'blue-0': at(3, 7), 'red-4': at(3, 4) }, held('blue-0'));
      const e = estimateThroughPass(lane, 'blue-0', at(3, 2));
      expect(e.interceptors.map((i) => i.playerId)).toEqual(['red-4']);
      expect(e.pComplete).toBeCloseTo(e.pAccurate * (1 - e.pIntercepted), 10);
    });
  });

  describe('other actions are unaffected', () => {
    it('a normal pass in early mode is still kicked after movement', () => {
      const s = scene({ 'blue-0': at(3, 6), 'blue-1': at(1, 4), 'red-4': at(5, 3) }, held('blue-0'));
      const r = resolveTurn(s, plans({ moves: { 'blue-1': at(1, 2) }, ballAction: { kind: 'pass', targetId: 'blue-1' } }), fixedRng([0.0]));
      expect(ev(r.events, 'offside')[0]).toMatchObject({ receiverId: 'blue-1' });
      expect(ev(r.events, 'offside')[0]?.early).toBeUndefined();
    });
  });
});
