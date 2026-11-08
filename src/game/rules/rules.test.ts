import { describe, expect, it } from 'vitest';
import { cellsOnSegment, laneOffset, neighbors8, inBounds } from './geometry';
import { availableMoveTargets, isLegalMove, legalMoveTargets } from './moves';
import { estimateCross, estimatePass, estimateShot, isCrossValid } from './estimates';
import { duelWinProbability, passMaxDistance, shotGoalProbability } from './probability';
import { held, plans, scene } from '../testUtils';
import { getCharacter } from '../data/characters';

const keys = (vs: { x: number; y: number }[]) => vs.map((v) => `${v.x},${v.y}`).sort();

describe('geometry', () => {
  it('cellsOnSegment on a straight line', () => {
    const cells = cellsOnSegment({ x: 3, y: 5 }, { x: 3, y: 2 }, 0.6);
    expect(cells.map((c) => c.cell)).toEqual([
      { x: 3, y: 4 },
      { x: 3, y: 3 },
    ]);
    expect(cells.every((c) => c.offset === 0)).toBe(true);
  });
  it('cellsOnSegment on a diagonal line', () => {
    const cells = cellsOnSegment({ x: 0, y: 0 }, { x: 3, y: 3 }, 0.6);
    expect(keys(cells.map((c) => c.cell))).toEqual(['1,1', '2,2']);
    // wider lane picks up the neighbours at 0.707
    const wide = cellsOnSegment({ x: 0, y: 0 }, { x: 3, y: 3 }, 0.8);
    expect(wide.length).toBeGreaterThan(2);
  });
  it('cellsOnSegment handles off-board goal target', () => {
    const cells = cellsOnSegment({ x: 3, y: 2 }, { x: 3, y: -0.5 }, 0.6);
    expect(cells.map((c) => c.cell)).toEqual([
      { x: 3, y: 1 },
      { x: 3, y: 0 },
    ]);
  });
  it('laneOffset and bounds', () => {
    const r = laneOffset({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(r.offset).toBe(0);
    expect(r.t).toBeCloseTo(0.25);
    expect(laneOffset({ x: 2, y: 1 }, { x: 0, y: 0 }, { x: 4, y: 0 }).offset).toBe(1);
    expect(neighbors8({ x: 0, y: 0 })).toHaveLength(3);
    expect(neighbors8({ x: 3, y: 5 })).toHaveLength(8);
    expect(inBounds({ x: 7, y: 0 })).toBe(false);
  });
});

describe('moves', () => {
  it('blue striker targets', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 } }, held('blue-0'));
    expect(keys(legalMoveTargets(s, 'blue-0'))).toEqual(
      ['3,4', '3,3', '2,4', '4,4', '2,5', '4,5', '3,6'].sort(),
    );
  });
  it('red is mirrored', () => {
    const s = scene({ 'red-0': { x: 3, y: 4 } }, held('red-0'));
    expect(keys(legalMoveTargets(s, 'red-0'))).toEqual(
      ['3,5', '3,6', '2,5', '4,5', '2,4', '4,4', '3,3'].sort(),
    );
  });
  it('respects board edges', () => {
    const s = scene({ 'blue-0': { x: 0, y: 0 } }, held('blue-0'));
    expect(keys(legalMoveTargets(s, 'blue-0'))).toEqual(['0,1', '1,0']);
  });
  it('interceptor diagonal slide and counter bonus', () => {
    const pos = { 'blue-3': { x: 3, y: 6 } };
    const plain = scene(pos, held('blue-0'), { turn: 5 });
    expect(keys(legalMoveTargets(plain, 'blue-3'))).toContain('1,4');
    expect(keys(legalMoveTargets(plain, 'blue-3'))).not.toContain('0,3');
    const counter = scene(pos, held('blue-0'), { turn: 5, flags: { 'blue-3': { wonBallTurn: 4 } } });
    expect(keys(legalMoveTargets(counter, 'blue-3'))).toContain('0,3');
    const stale = scene(pos, held('blue-0'), { turn: 5, flags: { 'blue-3': { wonBallTurn: 3 } } });
    expect(keys(legalMoveTargets(stale, 'blue-3'))).not.toContain('0,3');
  });
  it('isLegalMove accepts stay and rejects unreachable', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 } }, held('blue-0'));
    expect(isLegalMove(s, 'blue-0', { x: 3, y: 5 })).toBe(true);
    expect(isLegalMove(s, 'blue-0', { x: 3, y: 3 })).toBe(true);
    expect(isLegalMove(s, 'blue-0', { x: 3, y: 2 })).toBe(false);
  });
  it('availableMoveTargets removes teammate reservations but not enemies', () => {
    const s = scene(
      { 'blue-0': { x: 3, y: 5 }, 'blue-1': { x: 2, y: 5 }, 'blue-2': { x: 5, y: 6 }, 'red-0': { x: 3, y: 4 } },
      held('blue-0'),
    );
    const plan = plans({ moves: { 'blue-2': { x: 4, y: 5 } } }).blue;
    const av = keys(availableMoveTargets(s, plan, 'blue-0'));
    expect(av).not.toContain('2,5'); // blue-1 stays there
    expect(av).not.toContain('4,5'); // blue-2 planned there
    expect(av).toContain('3,4'); // enemy-occupied cell stays selectable
  });
});

describe('probability and estimates', () => {
  it('duel clamps and carrier bonus', () => {
    expect(duelWinProbability(50, 50)).toBe(0.5);
    expect(duelWinProbability(50, 50, { carrierIsA: true })).toBeCloseTo(0.55);
    expect(duelWinProbability(100, 1)).toBe(0.85);
    expect(duelWinProbability(1, 100)).toBe(0.15);
  });
  it('passMaster extends range', () => {
    expect(passMaxDistance([])).toBe(6);
    expect(passMaxDistance(['passMaster'])).toBe(8);
  });
  it('shot stat blend', () => {
    const st = getCharacter('striker').stats;
    const near = shotGoalProbability(2, 0, st, [], { oneTouchActive: false });
    const far = shotGoalProbability(5, 0, st, [], { oneTouchActive: false });
    expect(near).toBeGreaterThan(far);
    const withOt = shotGoalProbability(2, 0, st, ['oneTouch'], { oneTouchActive: true });
    expect(withOt).toBeGreaterThan(near);
  });
  it('estimateShot decreases with distance and blockers raise pBlocked', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 } }, held('blue-0'));
    const near = estimateShot(s, 'blue-0', { x: 3, y: 2 }, {});
    const far = estimateShot(s, 'blue-0', { x: 3, y: 5 }, {});
    expect(near.pGoal).toBeGreaterThan(far.pGoal);
    expect(near.pBlocked).toBe(0);
    const blocked = estimateShot(s, 'blue-0', { x: 3, y: 2 }, { 'red-4': { x: 3, y: 1 } });
    expect(blocked.blockers.map((b) => b.playerId)).toEqual(['red-4']);
    expect(blocked.pBlocked).toBeGreaterThan(0.9);
    expect(blocked.pGoal).toBeLessThan(near.pGoal);
    expect(blocked.pGoal).toBeCloseTo(blocked.pGoalIfUnblocked * (1 - blocked.pBlocked));
  });
  it('estimatePass range and interceptors', () => {
    const s = scene({ 'blue-0': { x: 3, y: 9 }, 'blue-1': { x: 3, y: 1 }, 'red-3': { x: 3, y: 5 } }, held('blue-0'));
    const e = estimatePass(s, 'blue-0', 'blue-1');
    expect(e.inRange).toBe(false);
    expect(e.pComplete).toBe(0);
    const s2 = scene({ 'blue-0': { x: 3, y: 5 }, 'blue-1': { x: 3, y: 2 }, 'red-3': { x: 3, y: 3 } }, held('blue-0'));
    const e2 = estimatePass(s2, 'blue-0', 'blue-1');
    expect(e2.interceptors).toHaveLength(1);
    expect(e2.pComplete).toBeCloseTo(e2.pAccurate * (1 - e2.pIntercepted));
  });
  it('isCrossValid and estimateCross', () => {
    expect(isCrossValid('blue', { x: 1, y: 3 }, { x: 3, y: 1 })).toBe(true);
    expect(isCrossValid('blue', { x: 3, y: 3 }, { x: 3, y: 1 })).toBe(false); // not wide
    expect(isCrossValid('blue', { x: 1, y: 3 }, { x: 5, y: 1 })).toBe(false); // target not central
    expect(isCrossValid('blue', { x: 1, y: 6 }, { x: 3, y: 4 })).toBe(false); // outside zone
    expect(isCrossValid('red', { x: 5, y: 6 }, { x: 3, y: 8 })).toBe(true);
    const s = scene({ 'blue-1': { x: 1, y: 3 }, 'blue-0': { x: 3, y: 1 }, 'red-4': { x: 2, y: 1 } }, held('blue-1'));
    const c = estimateCross(s, 'blue-1', 'blue-0');
    expect(c.valid).toBe(true);
    expect(c.defenderId).toBe('red-4');
    expect(c.pWinAerial).toBeLessThan(0.5);
    expect(c.pGoal).toBeCloseTo(c.pDelivery * c.pWinAerial * c.pHeaderGoal);
  });
});
