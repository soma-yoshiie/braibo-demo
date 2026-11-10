import { getCharacter } from '../data/characters';
import { aerialDefender, estimateCross, estimatePass, estimateShot } from '../rules/estimates';
import { RULES } from '../rules/config';
import { duelWinProbability } from '../rules/probability';
import { getEffectiveStats, legalMoveTargets } from '../rules/moves';
import { planAiTurn } from '../ai/simpleAi';
import { interceptProbability } from '../rules/probability';
import { describe, expect, it } from 'vitest';
import { resolveMovement, resolveTurn } from './resolve';
import { createMatch, ballHolder, getPlayer } from './match';
import { createRng, fixedRng } from './rng';
import { describeEvent } from './log';
import { held, plans, scene } from '../testUtils';
import type { MatchState, TurnEvent } from '../types';

/** Pre-v0.5 space-pass behaviour (kick after movement). */
const legacy = { throughPass: 'legacy' } as const;

const ev = <T extends TurnEvent['type']>(events: TurnEvent[], type: T) =>
  events.filter((e): e is Extract<TurnEvent, { type: T }> => e.type === type);

describe('createMatch', () => {
  it('builds the initial state', () => {
    const m = createMatch();
    expect(m.players).toHaveLength(10);
    expect(m.players[0]?.id).toBe('blue-0');
    expect(m.players[5]?.id).toBe('red-0');
    expect(getPlayer(m, 'blue-0').pos).toEqual({ x: 3, y: 5 });
    expect(getPlayer(m, 'red-0').pos).toEqual({ x: 3, y: 3 }); // kickoff gap
    expect(ballHolder(m)?.id).toBe('blue-0');
    expect(m.turn).toBe(1);
    expect(m.phase).toBe('planning');
    expect(createMatch({ firstKickoff: 'red', maxTurns: 3 })).toMatchObject({ maxTurns: 3, kickoffTeam: 'red' });
  });
});

describe('movement', () => {
  it('moves players and treats illegal moves as staying', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'blue-1': { x: 1, y: 6 } }, held('blue-0'));
    const r = resolveTurn(s, plans({ moves: { 'blue-0': { x: 3, y: 4 }, 'blue-1': { x: 6, y: 0 } } }), fixedRng([0.5]));
    expect(getPlayer(r.after, 'blue-0').pos).toEqual({ x: 3, y: 4 });
    expect(getPlayer(r.after, 'blue-1').pos).toEqual({ x: 1, y: 6 });
    expect(r.after.turn).toBe(2);
    expect(r.before).toBe(s);
  });

  it('same-team conflict: stayer beats lower index mover', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'blue-1': { x: 1, y: 7 }, 'blue-3': { x: 2, y: 7 } }, held('blue-0'));
    const r = resolveTurn(s, plans({ moves: { 'blue-1': { x: 2, y: 7 } } }), fixedRng([0.5]));
    expect(getPlayer(r.after, 'blue-1').pos).toEqual({ x: 1, y: 7 });
    expect(getPlayer(r.after, 'blue-3').pos).toEqual({ x: 2, y: 7 });
    expect(ev(r.events, 'bounce')).toEqual([
      { type: 'bounce', playerId: 'blue-1', from: { x: 2, y: 7 }, to: { x: 1, y: 7 }, reason: 'teammate' },
    ]);
  });

  it('same-team conflict: ball holder has priority over a stayer-free mover', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'blue-3': { x: 2, y: 7 } }, held('blue-0'));
    // both move to (3,6): striker (back) and interceptor (+1,-1 range 2 -> (3,6))
    const r = resolveTurn(s, plans({ moves: { 'blue-0': { x: 3, y: 6 }, 'blue-3': { x: 3, y: 6 } } }), fixedRng([0.5]));
    expect(getPlayer(r.after, 'blue-0').pos).toEqual({ x: 3, y: 6 });
    expect(getPlayer(r.after, 'blue-3').pos).toEqual({ x: 2, y: 7 });
  });

  it('carrier-cell duel: attacker wins, both stay in the cell', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'red-0': { x: 3, y: 3 } }, held('blue-0'));
    const r = resolveTurn(s, plans({ moves: { 'blue-0': { x: 3, y: 3 } } }), fixedRng([0.1]));
    const d = ev(r.events, 'duel')[0];
    expect(d).toMatchObject({ kind: 'ground', aId: 'blue-0', bId: 'red-0', winnerId: 'blue-0', forBall: true });
    expect(d?.loose).toBeUndefined();
    expect(d?.pAWins).toBeCloseTo(0.55);
    expect(getPlayer(r.after, 'blue-0').pos).toEqual({ x: 3, y: 3 });
    expect(getPlayer(r.after, 'red-0').pos).toEqual({ x: 3, y: 3 });
    expect(ev(r.events, 'displace')).toHaveLength(0);
    expect(ev(r.events, 'bounce')).toHaveLength(0);
    expect(ballHolder(r.after)?.id).toBe('blue-0');
  });

  it('carrier-cell duel: defender wins, gets the ball and wonBallTurn, loser stays', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'red-0': { x: 3, y: 3 } }, held('blue-0'));
    const r = resolveTurn(s, plans({ moves: { 'blue-0': { x: 3, y: 3 } } }), fixedRng([0.9]));
    expect(getPlayer(r.after, 'blue-0').pos).toEqual({ x: 3, y: 3 });
    expect(getPlayer(r.after, 'red-0').pos).toEqual({ x: 3, y: 3 });
    expect(ballHolder(r.after)?.id).toBe('red-0');
    expect(getPlayer(r.after, 'red-0').flags.wonBallTurn).toBe(1);
    expect(ev(r.events, 'bounce')).toHaveLength(0);
    expect(r.events.map((e) => e.type).filter((t) => ['duel', 'move'].includes(t))).toEqual(['duel', 'move']);
  });

  it('opponents sharing a cell without the ball: no event, no rng', () => {
    const s = scene({ 'blue-0': { x: 3, y: 8 }, 'blue-1': { x: 2, y: 6 }, 'red-1': { x: 2, y: 5 } }, held('blue-0'));
    let draws = 0;
    const rng = { next: () => (draws++, 0.5) };
    const r = resolveTurn(s, plans({ moves: { 'blue-1': { x: 2, y: 5 } } }), rng);
    expect(getPlayer(r.after, 'blue-1').pos).toEqual({ x: 2, y: 5 });
    expect(getPlayer(r.after, 'red-1').pos).toEqual({ x: 2, y: 5 });
    expect(ev(r.events, 'duel')).toHaveLength(0);
    expect(ev(r.events, 'bounce')).toHaveLength(0);
    expect(draws).toBe(0);
  });

  it('two opponents already sharing a cell: both stay, duel only if one holds the ball', () => {
    const shared = { 'blue-1': { x: 2, y: 5 }, 'red-1': { x: 2, y: 5 } };
    const noBall = resolveTurn(scene({ ...shared, 'blue-0': { x: 3, y: 8 } }, held('blue-0')), plans(), fixedRng([0.5]));
    expect(ev(noBall.events, 'duel')).toHaveLength(0);
    const withBall = resolveTurn(scene({ ...shared, 'blue-0': { x: 3, y: 8 } }, held('blue-1')), plans(), fixedRng([0.9]));
    const d = ev(withBall.events, 'duel')[0];
    expect(d).toMatchObject({ forBall: true, aId: 'blue-1', bId: 'red-1', winnerId: 'red-1' });
    expect(ballHolder(withBall.after)?.id).toBe('red-1');
  });

  it('at most one rng draw in the movement phase', () => {
    const s = scene(
      { 'blue-0': { x: 3, y: 5 }, 'red-0': { x: 3, y: 3 }, 'blue-1': { x: 1, y: 7 }, 'red-1': { x: 1, y: 6 } },
      held('blue-0'),
    );
    let draws = 0;
    const rng = { next: () => (draws++, 0.5) };
    resolveTurn(s, plans({ moves: { 'blue-0': { x: 3, y: 3 }, 'blue-1': { x: 1, y: 6 } } }), rng);
    expect(draws).toBe(1);
  });

  it('swap with the ball carrier runs a ball-only duel and keeps the swap', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'red-0': { x: 3, y: 4 } }, held('blue-0'));
    const r = resolveTurn(
      s,
      plans({ moves: { 'blue-0': { x: 3, y: 4 } } }, { moves: { 'red-0': { x: 3, y: 5 } } }),
      fixedRng([0.9]),
    );
    expect(getPlayer(r.after, 'blue-0').pos).toEqual({ x: 3, y: 4 });
    expect(getPlayer(r.after, 'red-0').pos).toEqual({ x: 3, y: 5 });
    expect(ballHolder(r.after)?.id).toBe('red-0');
    expect(ev(r.events, 'duel')[0]).toMatchObject({ forBall: true, pos: { x: 3, y: 4 }, winnerId: 'red-0' });
  });

  it('contested loose ball: duel with loose flag (no carrier bonus), then pickup by the winner', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'red-0': { x: 3, y: 3 } }, { kind: 'loose', pos: { x: 3, y: 4 } });
    const mv = plans({ moves: { 'blue-0': { x: 3, y: 4 } } }, { moves: { 'red-0': { x: 3, y: 4 } } });
    const r = resolveTurn(s, mv, fixedRng([0.9]));
    const d = ev(r.events, 'duel')[0];
    expect(d).toMatchObject({ loose: true, forBall: true, aId: 'blue-0', bId: 'red-0', winnerId: 'red-0' });
    expect(d?.pAWins).toBeCloseTo(0.5);
    expect(ballHolder(r.after)?.id).toBe('red-0');
    expect(getPlayer(r.after, 'red-0').flags.wonBallTurn).toBe(1);
    expect(getPlayer(r.after, 'blue-0').pos).toEqual({ x: 3, y: 4 });
    expect(getPlayer(r.after, 'red-0').pos).toEqual({ x: 3, y: 4 });
    const types = r.events.map((e) => e.type);
    expect(types.indexOf('duel')).toBeLessThan(types.indexOf('move'));
    expect(types.indexOf('move')).toBeLessThan(types.indexOf('pickup'));
    expect(ev(r.events, 'pickup')).toEqual([{ type: 'pickup', playerId: 'red-0', pos: { x: 3, y: 4 } }]);
    expect(describeEvent(d as TurnEvent, r.after)).toContain('こぼれ球');
  });

  it('uncontested loose ball: plain pickup, no duel, no rng', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'red-0': { x: 3, y: 3 } }, { kind: 'loose', pos: { x: 3, y: 4 } });
    let draws = 0;
    const r = resolveTurn(s, plans({ moves: { 'blue-0': { x: 3, y: 4 } } }), { next: () => (draws++, 0.5) });
    expect(ev(r.events, 'duel')).toHaveLength(0);
    expect(ev(r.events, 'pickup')).toEqual([{ type: 'pickup', playerId: 'blue-0', pos: { x: 3, y: 4 } }]);
    expect(draws).toBe(0);
  });

  it('displaced stayer goes to a completely empty cell and no duel follows', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'blue-1': { x: 2, y: 5 }, 'red-1': { x: 2, y: 4 } }, held('blue-0'));
    // blue-0 (holder) moves onto its stationary teammate blue-1 -> blue-1 displaced
    const r = resolveTurn(s, plans({ moves: { 'blue-0': { x: 2, y: 5 } } }), fixedRng([0.5]));
    expect(ev(r.events, 'duel')).toHaveLength(0);
    const d = ev(r.events, 'displace')[0];
    expect(d?.playerId).toBe('blue-1');
    expect(r.after.players.filter((p) => p.pos.x === d?.to.x && p.pos.y === d?.to.y)).toHaveLength(1);
  });

  it('a genuine swap yields exactly one duel', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'red-0': { x: 3, y: 4 } }, held('blue-0'));
    const r = resolveTurn(
      s,
      plans({ moves: { 'blue-0': { x: 3, y: 4 } } }, { moves: { 'red-0': { x: 3, y: 5 } } }),
      fixedRng([0.0, 0.99]),
    );
    expect(ev(r.events, 'duel')).toHaveLength(1);
    expect(ballHolder(r.after)?.id).toBe('blue-0');
  });

  it('loose ball is picked up by the player who ends on it', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 } }, { kind: 'loose', pos: { x: 3, y: 3 } });
    const r = resolveTurn(s, plans({ moves: { 'blue-0': { x: 3, y: 3 } } }), fixedRng([0.5]));
    expect(ballHolder(r.after)?.id).toBe('blue-0');
    expect(ev(r.events, 'pickup')).toEqual([{ type: 'pickup', playerId: 'blue-0', pos: { x: 3, y: 3 } }]);
  });
});

describe('passes', () => {
  const base = { 'blue-0': { x: 3, y: 5 }, 'blue-1': { x: 3, y: 2 }, 'red-4': { x: 6, y: 0 } };
  const pass = { ballAction: { kind: 'pass', targetId: 'blue-1' } } as const;

  it('complete', () => {
    const r = resolveTurn(scene(base, held('blue-0')), plans(pass), fixedRng([0.5]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'complete' });
    expect(ballHolder(r.after)?.id).toBe('blue-1');
    expect(getPlayer(r.after, 'blue-1').flags.receivedPassTurn).toBe(1);
  });
  it('intercepted', () => {
    const s = scene({ ...base, 'red-3': { x: 3, y: 3 } }, held('blue-0'));
    const r = resolveTurn(s, plans(pass), fixedRng([0.0]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'intercepted', interceptorId: 'red-3' });
    expect(ballHolder(r.after)?.id).toBe('red-3');
    expect(getPlayer(r.after, 'red-3').flags.wonBallTurn).toBe(1);
  });
  it('failed pass leaves a loose ball next to the target', () => {
    const r = resolveTurn(scene(base, held('blue-0')), plans(pass), fixedRng([0.99, 0.0]));
    const p = ev(r.events, 'pass')[0];
    expect(p).toMatchObject({ outcome: 'failed', loosePos: { x: 2, y: 1 } });
    expect(r.after.ball).toEqual({ kind: 'loose', pos: { x: 2, y: 1 } });
  });
  it('out of range pass does nothing', () => {
    const s = scene({ 'blue-0': { x: 3, y: 9 }, 'blue-1': { x: 3, y: 1 } }, held('blue-0'));
    const r = resolveTurn(s, plans(pass), fixedRng([0.0]));
    expect(ev(r.events, 'pass')).toHaveLength(0);
    expect(ballHolder(r.after)?.id).toBe('blue-0');
  });
  it('uses final positions (receiver moves into range)', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'blue-1': { x: 3, y: 2 }, 'red-4': { x: 6, y: 0 } }, held('blue-0'));
    const r = resolveTurn(s, plans({ ...pass, moves: { 'blue-1': { x: 3, y: 1 } } }), fixedRng([0.5]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ to: { x: 3, y: 1 }, outcome: 'complete' });
  });
});

describe('actionCancelled', () => {
  it('receiver bounced out of range -> cancelled, ball stays', () => {
    const s = scene({ 'blue-0': { x: 3, y: 9 }, 'blue-1': { x: 3, y: 2 } }, held('blue-0'));
    const r = resolveTurn(s, plans({ ballAction: { kind: 'pass', targetId: 'blue-1' } }), fixedRng([0.0]));
    expect(ev(r.events, 'pass')).toHaveLength(0);
    expect(ev(r.events, 'actionCancelled')).toEqual([
      { type: 'actionCancelled', playerId: 'blue-0', action: 'pass', reason: 'outOfRange' },
    ]);
    expect(ballHolder(r.after)?.id).toBe('blue-0');
    expect(describeEvent(ev(r.events, 'actionCancelled')[0] as TurnEvent, s)).toContain('中止');
  });
  it('invalid target (not a teammate)', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 } }, held('blue-0'));
    const r = resolveTurn(s, plans({ ballAction: { kind: 'pass', targetId: 'red-0' } }), fixedRng([0.0]));
    expect(ev(r.events, 'actionCancelled')[0]).toMatchObject({ reason: 'invalidTarget', action: 'pass' });
    expect(ballHolder(r.after)?.id).toBe('blue-0');
  });
});

describe('kickoff gap', () => {
  it('pulls the non-kicking striker back', () => {
    const blue = createMatch({ firstKickoff: 'blue' });
    expect(getPlayer(blue, 'blue-0').pos).toEqual({ x: 3, y: 5 });
    expect(getPlayer(blue, 'red-0').pos).toEqual({ x: 3, y: 3 });
    const red = createMatch({ firstKickoff: 'red' });
    expect(getPlayer(red, 'red-0').pos).toEqual({ x: 3, y: 4 });
    expect(getPlayer(red, 'blue-0').pos).toEqual({ x: 3, y: 6 });
  });
});

describe('crosses', () => {
  const pos = { 'blue-1': { x: 1, y: 3 }, 'blue-0': { x: 3, y: 1 }, 'red-4': { x: 2, y: 1 } };
  const cross = { ballAction: { kind: 'cross', targetId: 'blue-0' } } as const;

  it('delivery, aerial won, header goal, kickoff reset', () => {
    const r = resolveTurn(scene(pos, held('blue-1')), plans(cross), fixedRng([0.0, 0.1, 0.0]));
    expect(ev(r.events, 'duel')[0]).toMatchObject({ kind: 'aerial', winnerId: 'blue-0' });
    expect(ev(r.events, 'cross')[0]).toMatchObject({ outcome: 'won', defenderId: 'red-4' });
    expect(ev(r.events, 'shot')[0]).toMatchObject({ kind: 'header', outcome: 'goal', shooterId: 'blue-0' });
    expect(ev(r.events, 'goal')[0]).toEqual({ type: 'goal', team: 'blue', scorerId: 'blue-0' });
    expect(r.afterAction.score.blue).toBe(1);
    expect(getPlayer(r.afterAction, 'blue-0').pos).toEqual({ x: 3, y: 1 });
    expect(r.after.score).toEqual({ blue: 1, red: 0 });
    expect(ballHolder(r.after)?.id).toBe('red-0');
    expect(r.after.kickoffTeam).toBe('red');
    expect(getPlayer(r.after, 'blue-0').pos).toEqual({ x: 3, y: 6 });
    expect(getPlayer(r.after, 'red-0').pos).toEqual({ x: 3, y: 4 });
    expect(ev(r.events, 'kickoff')[0]).toEqual({ type: 'kickoff', team: 'red' });
  });
  it('aerial lost gives the ball to the defender', () => {
    const r = resolveTurn(scene(pos, held('blue-1')), plans(cross), fixedRng([0.0, 0.9]));
    expect(ev(r.events, 'cross')[0]).toMatchObject({ outcome: 'lost' });
    expect(ballHolder(r.after)?.id).toBe('red-4');
    expect(ev(r.events, 'shot')).toHaveLength(0);
  });
  it('failed delivery gives a loose ball', () => {
    const r = resolveTurn(scene(pos, held('blue-1')), plans(cross), fixedRng([0.99, 0.0]));
    expect(ev(r.events, 'cross')[0]).toMatchObject({ outcome: 'failed' });
    expect(r.after.ball.kind).toBe('loose');
  });
  it('invalid cross is processed as a pass', () => {
    const s = scene({ 'blue-1': { x: 3, y: 6 }, 'blue-0': { x: 3, y: 3 }, 'red-4': { x: 6, y: 0 } }, held('blue-1'));
    const r = resolveTurn(s, plans({ ballAction: { kind: 'cross', targetId: 'blue-0' } }), fixedRng([0.5]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'complete' });
    expect(ev(r.events, 'cross')).toHaveLength(0);
  });
});

describe('shots', () => {
  const pos = { 'blue-0': { x: 3, y: 2 } };
  const shoot = { ballAction: { kind: 'shoot' } } as const;

  it('blocked', () => {
    const s = scene({ ...pos, 'red-4': { x: 3, y: 1 } }, held('blue-0'));
    const r = resolveTurn(s, plans(shoot), fixedRng([0.0]));
    expect(ev(r.events, 'shot')[0]).toMatchObject({ outcome: 'blocked', blockerId: 'red-4' });
    expect(ballHolder(r.after)?.id).toBe('red-4');
    expect(r.after.score.blue).toBe(0);
  });
  it('goal', () => {
    const r = resolveTurn(scene(pos, held('blue-0')), plans(shoot), fixedRng([0.0]));
    expect(r.after.score).toEqual({ blue: 1, red: 0 });
    expect(ballHolder(r.after)?.id).toBe('red-0');
    expect(getPlayer(r.after, 'red-0').pos).toEqual({ x: 3, y: 4 });
    expect(getPlayer(r.after, 'blue-0').pos).toEqual({ x: 3, y: 6 });
  });
  it('missed -> goal kick to the defender nearest their goal', () => {
    const s = scene({ ...pos, 'red-4': { x: 2, y: 0 } }, held('blue-0'));
    const r = resolveTurn(s, plans(shoot), fixedRng([0.99]));
    expect(ev(r.events, 'shot')[0]).toMatchObject({ outcome: 'missed' });
    expect(ev(r.events, 'goalKick')[0]).toMatchObject({ team: 'red', playerId: 'red-4' });
    expect(ballHolder(r.after)?.id).toBe('red-4');
  });
  it('shoots from the post-movement position', () => {
    const s = scene({ 'blue-0': { x: 3, y: 4 }, 'red-4': { x: 3, y: 1 } }, held('blue-0'));
    // moving to (3,2) puts red-4 on the lane at distance 1 -> blocked with low roll
    const r = resolveTurn(s, plans({ ...shoot, moves: { 'blue-0': { x: 3, y: 2 } } }), fixedRng([0.0]));
    expect(ev(r.events, 'shot')[0]).toMatchObject({ outcome: 'blocked', from: { x: 3, y: 2 } });
  });
  it('no shot if the carrier lost the ball in a duel', () => {
    const s = scene({ 'blue-0': { x: 3, y: 4 }, 'red-0': { x: 3, y: 3 } }, held('blue-0'));
    const r = resolveTurn(s, plans({ ...shoot, moves: { 'blue-0': { x: 3, y: 3 } } }), fixedRng([0.99]));
    expect(ev(r.events, 'shot')).toHaveLength(0);
    expect(ballHolder(r.after)?.id).toBe('red-0');
  });
});

describe('match end, purity, determinism, log', () => {
  it('ends with a draw / winner at maxTurns', () => {
    const draw = resolveTurn(createMatch({ maxTurns: 1 }), plans(), fixedRng([0.5]));
    expect(draw.after.phase).toBe('finished');
    expect(ev(draw.events, 'matchEnd')[0]).toMatchObject({ winner: 'draw' });
    const s = scene({ 'blue-0': { x: 3, y: 2 } }, held('blue-0'), { maxTurns: 1 });
    const win = resolveTurn(s, plans({ ballAction: { kind: 'shoot' } }), fixedRng([0.0]));
    expect(win.after.phase).toBe('finished');
    expect(ev(win.events, 'matchEnd')[0]).toMatchObject({ winner: 'blue', score: { blue: 1, red: 0 } });
    const mid = resolveTurn(createMatch(), plans(), fixedRng([0.5]));
    expect(mid.after.phase).toBe('planning');
  });
  it('does not mutate inputs and is deterministic per seed', () => {
    const s: MatchState = scene(
      { 'blue-0': { x: 3, y: 5 }, 'blue-1': { x: 3, y: 2 }, 'red-3': { x: 3, y: 3 }, 'red-0': { x: 3, y: 4 } },
      held('blue-0'),
    );
    const p = plans({ ballAction: { kind: 'pass', targetId: 'blue-1' }, moves: { 'blue-0': { x: 3, y: 4 } } });
    const snapS = JSON.stringify(s);
    const snapP = JSON.stringify(p);
    const a = resolveTurn(s, p, createRng(42));
    const b = resolveTurn(s, p, createRng(42));
    expect(JSON.stringify(s)).toBe(snapS);
    expect(JSON.stringify(p)).toBe(snapP);
    expect(a).toEqual(b);
  });
  it('describes events in Japanese', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'blue-1': { x: 3, y: 2 }, 'red-3': { x: 3, y: 3 }, 'red-4': { x: 6, y: 0 } }, held('blue-0'));
    const r = resolveTurn(s, plans({ ballAction: { kind: 'pass', targetId: 'blue-1' } }), fixedRng([0.0]));
    const lines = r.events.map((e) => describeEvent(e, s)).filter(Boolean);
    expect(lines).toContain('赤 インターセプター がゴロパスをカット！');
    const g = describeEvent({ type: 'goal', team: 'blue', scorerId: 'blue-0' }, s);
    expect(g).toBe('GOAL! 青 ストライカー');
  });
});

describe('space pass', () => {
  const base = { 'blue-0': { x: 3, y: 5 }, 'blue-1': { x: 2, y: 2 }, 'red-4': { x: 6, y: 0 } };
  const sp = (x: number, y: number) => ({ ballAction: { kind: 'spacePass', target: { x, y } } }) as const;

  it('completes to a teammate who moved onto the target cell', () => {
    const r = resolveTurn(scene(base, held('blue-0'), legacy), plans({ ...sp(3, 2), moves: { 'blue-1': { x: 3, y: 2 } } }), fixedRng([0.5]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ space: true, outcome: 'complete', receiverId: 'blue-1' });
    expect(ballHolder(r.after)?.id).toBe('blue-1');
    expect(getPlayer(r.after, 'blue-1').flags.receivedPassTurn).toBe(1);
    expect(describeEvent(ev(r.events, 'pass')[0] as TurnEvent, r.after)).toContain('スペースへゴロパス');
  });
  it('goes to an enemy standing on the target', () => {
    const s = scene({ ...base, 'red-3': { x: 3, y: 2 } }, held('blue-0'), legacy);
    const r = resolveTurn(s, plans(sp(3, 2)), fixedRng([0.99, 0.5]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ space: true, outcome: 'toEnemy', receiverId: 'red-3' });
    expect(ballHolder(r.after)?.id).toBe('red-3');
    expect(getPlayer(r.after, 'red-3').flags.wonBallTurn).toBe(1);
  });
  it('is loose on an empty cell', () => {
    const r = resolveTurn(scene(base, held('blue-0'), legacy), plans(sp(3, 2)), fixedRng([0.5]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ space: true, outcome: 'loose', loosePos: { x: 3, y: 2 } });
    expect(r.after.ball).toEqual({ kind: 'loose', pos: { x: 3, y: 2 } });
    expect(describeEvent(ev(r.events, 'pass')[0] as TurnEvent, r.after)).toContain('ルーズボール (3,2)');
  });
  it('can be intercepted on the lane', () => {
    const s = scene({ ...base, 'red-3': { x: 3, y: 3 } }, held('blue-0'), legacy);
    const r = resolveTurn(s, plans(sp(3, 1)), fixedRng([0.0]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ space: true, outcome: 'intercepted', interceptorId: 'red-3' });
    expect(ballHolder(r.after)?.id).toBe('red-3');
  });
  it('inaccurate pass scatters next to the target', () => {
    const r = resolveTurn(scene(base, held('blue-0'), legacy), plans(sp(3, 2)), fixedRng([0.99, 0.0]));
    const p = ev(r.events, 'pass')[0];
    expect(p).toMatchObject({ space: true, outcome: 'failed' });
    expect(r.after.ball.kind).toBe('loose');
    if (r.after.ball.kind === 'loose') {
      expect(Math.max(Math.abs(r.after.ball.pos.x - 3), Math.abs(r.after.ball.pos.y - 2))).toBe(1);
    }
  });
  it('out of range is cancelled and the ball stays', () => {
    const s = scene({ 'blue-0': { x: 3, y: 9 }, 'blue-1': { x: 0, y: 1 } }, held('blue-0'), legacy);
    const r = resolveTurn(s, plans(sp(3, 1)), fixedRng([0.0]));
    expect(ev(r.events, 'actionCancelled')[0]).toMatchObject({ action: 'pass', reason: 'outOfRange' });
    expect(ballHolder(r.after)?.id).toBe('blue-0');
  });
  it('target equal to own cell or off-board is cancelled', () => {
    for (const t of [sp(3, 5), sp(9, 9)]) {
      const r = resolveTurn(scene(base, held('blue-0'), legacy), plans(t), fixedRng([0.0]));
      expect(ev(r.events, 'actionCancelled')[0]).toMatchObject({ reason: 'invalidTarget' });
      expect(ballHolder(r.after)?.id).toBe('blue-0');
    }
  });
});

describe('lofted passes', () => {
  const lob = { ballAction: { kind: 'pass', targetId: 'blue-1', style: 'lofted' } } as const;
  const far = { 'blue-0': { x: 3, y: 9 }, 'blue-1': { x: 3, y: 2 }, 'red-4': { x: 6, y: 0 } }; // distance 7

  it('ignores a mid-lane interceptor', () => {
    const s = scene({ ...far, 'red-3': { x: 3, y: 6 } }, held('blue-0'));
    const r = resolveTurn(s, plans(lob), fixedRng([0.0]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ style: 'lofted', outcome: 'complete' });
    expect(ballHolder(r.after)?.id).toBe('blue-1');
  });
  it('is intercepted by a defender adjacent to the target (aerial stat)', () => {
    const s = scene({ ...far, 'red-3': { x: 3, y: 3 } }, held('blue-0'));
    const r = resolveTurn(s, plans(lob), fixedRng([0.0]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'intercepted', interceptorId: 'red-3', style: 'lofted' });
    const e = estimatePass(s, 'blue-0', 'blue-1', undefined, undefined, undefined, 'lofted');
    const def = getCharacter(getPlayer(s, 'red-3').charId).stats;
    expect(e.interceptors[0]?.pIntercept).toBeCloseTo(interceptProbability(def.aerial, 0));
  });
  it('is intercepted by a defender adjacent to the passer (intercept stat)', () => {
    const s = scene({ ...far, 'red-3': { x: 3, y: 8 } }, held('blue-0'));
    const r = resolveTurn(s, plans(lob), fixedRng([0.0]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'intercepted', interceptorId: 'red-3' });
    const e = estimatePass(s, 'blue-0', 'blue-1', undefined, undefined, undefined, 'lofted');
    const def = getCharacter(getPlayer(s, 'red-3').charId).stats;
    expect(e.interceptors[0]?.pIntercept).toBeCloseTo(interceptProbability(def.intercept, 0));
  });
  it('max distance: 8 accepted, 9 cancelled; ground 6 cancelled', () => {
    const ok = scene({ 'blue-0': { x: 3, y: 9 }, 'blue-1': { x: 3, y: 1 }, 'red-4': { x: 6, y: 0 } }, held('blue-0'));
    expect(ev(resolveTurn(ok, plans(lob), fixedRng([0.5])).events, 'pass')[0]).toMatchObject({ outcome: 'complete' });
    const no = scene({ 'blue-0': { x: 3, y: 9 }, 'blue-1': { x: 3, y: 0 }, 'red-4': { x: 6, y: 0 } }, held('blue-0'));
    const r = resolveTurn(no, plans(lob), fixedRng([0.5]));
    expect(ev(r.events, 'pass')).toHaveLength(0);
    expect(ev(r.events, 'actionCancelled')[0]).toMatchObject({ reason: 'outOfRange' });
    const g = scene({ 'blue-0': { x: 3, y: 9 }, 'blue-1': { x: 3, y: 3 }, 'red-4': { x: 6, y: 0 } }, held('blue-0'));
    const rg = resolveTurn(g, plans({ ballAction: { kind: 'pass', targetId: 'blue-1' } }), fixedRng([0.5]));
    expect(ev(rg.events, 'actionCancelled')[0]).toMatchObject({ reason: 'outOfRange' });
  });
  it('uses the lofted accuracy (roll between lofted and ground accuracy fails the lob only)', () => {
    const s = scene({ 'blue-0': { x: 3, y: 6 }, 'blue-1': { x: 3, y: 2 }, 'red-4': { x: 6, y: 0 } }, held('blue-0'));
    const g = estimatePass(s, 'blue-0', 'blue-1');
    const l = estimatePass(s, 'blue-0', 'blue-1', undefined, undefined, undefined, 'lofted');
    expect(l.pAccurate).toBeLessThan(g.pAccurate);
    const roll = (g.pAccurate + l.pAccurate) / 2;
    const rg = resolveTurn(s, plans({ ballAction: { kind: 'pass', targetId: 'blue-1' } }), fixedRng([roll]));
    expect(ev(rg.events, 'pass')[0]).toMatchObject({ style: 'ground', outcome: 'complete' });
    const rl = resolveTurn(s, plans(lob), fixedRng([roll, 0.0]));
    expect(ev(rl.events, 'pass')[0]).toMatchObject({ style: 'lofted', outcome: 'failed' });
  });
  it('log distinguishes ground and lofted', () => {
    const s = scene({ 'blue-0': { x: 3, y: 6 }, 'blue-1': { x: 3, y: 2 }, 'red-4': { x: 6, y: 0 } }, held('blue-0'));
    const rl = resolveTurn(s, plans(lob), fixedRng([0.0]));
    expect(describeEvent(ev(rl.events, 'pass')[0] as TurnEvent, s)).toContain('浮き玉パス');
  });
});

describe('offside', () => {
  const off = { 'blue-0': { x: 3, y: 6 }, 'blue-1': { x: 3, y: 2 }, 'red-4': { x: 5, y: 3 }, 'red-3': { x: 1, y: 4 } };
  it('offside pass -> offside event, nearest defender gets the ball, no pass event, no rng', () => {
    const s = scene(off, held('blue-0'));
    const rng = fixedRng([]);
    const r = resolveTurn(s, plans({ ballAction: { kind: 'pass', targetId: 'blue-1' } }), rng);
    expect(ev(r.events, 'pass')).toHaveLength(0);
    expect(ev(r.events, 'offside')[0]).toEqual({
      type: 'offside', team: 'blue', passerId: 'blue-0', receiverId: 'blue-1', toPlayerId: 'red-4',
      from: { x: 3, y: 6 }, to: { x: 3, y: 2 }, style: 'ground',
    });
    expect(ballHolder(r.after)?.id).toBe('red-4');
    expect(getPlayer(r.after, 'red-4').flags.wonBallTurn).toBeUndefined();
    const line = describeEvent(ev(r.events, 'offside')[0] as TurnEvent, s);
    expect(line).toContain('オフサイド');
  });
  it('is judged on final positions (defence steps up -> onside)', () => {
    const s = scene({ ...off, 'red-4': { x: 5, y: 1 } }, held('blue-0'));
    const r = resolveTurn(s, plans({ ballAction: { kind: 'pass', targetId: 'blue-1' } }), fixedRng([0.5]));
    expect(ev(r.events, 'offside')).toHaveLength(0);
    expect(ev(r.events, 'pass')).toHaveLength(1);
  });
  it('offside cross', () => {
    const pos = { 'blue-1': { x: 1, y: 4 }, 'blue-0': { x: 3, y: 1 }, 'red-4': { x: 5, y: 3 } };
    const r = resolveTurn(scene(pos, held('blue-1')), plans({ ballAction: { kind: 'cross', targetId: 'blue-0' } }), fixedRng([]));
    expect(ev(r.events, 'offside')[0]).toMatchObject({ receiverId: 'blue-0', toPlayerId: 'red-4', style: 'lofted' });
    expect(ev(r.events, 'cross')).toHaveLength(0);
    expect(ballHolder(r.after)?.id).toBe('red-4');
  });
  it('space pass to a cell where an offside teammate stands -> offside', () => {
    const r = resolveTurn(
      scene(off, held('blue-0'), legacy),
      plans({ ballAction: { kind: 'spacePass', target: { x: 3, y: 2 } } }),
      fixedRng([]),
    );
    expect(ev(r.events, 'offside')[0]).toMatchObject({ receiverId: 'blue-1', toPlayerId: 'red-4' });
    expect(ev(r.events, 'pass')).toHaveLength(0);
  });
  it('space pass into an empty cell beyond the defence is NOT offside (loose ball)', () => {
    const r = resolveTurn(
      scene(off, held('blue-0'), legacy),
      plans({ ballAction: { kind: 'spacePass', target: { x: 2, y: 2 } } }),
      fixedRng([0.0]),
    );
    expect(ev(r.events, 'offside')).toHaveLength(0);
    expect(ev(r.events, 'pass')[0]).toMatchObject({ space: true, outcome: 'loose' });
  });
});

describe('v0.4 same-cell opponents during the ball action', () => {
  it('an enemy in the kicker\'s cell never intercepts a ground pass', () => {
    const pos = { 'blue-0': { x: 3, y: 5 }, 'red-0': { x: 3, y: 5 }, 'blue-1': { x: 3, y: 2 }, 'red-4': { x: 6, y: 0 } };
    const s = scene(pos, held('blue-0'));
    const pl = plans({ ballAction: { kind: 'pass', targetId: 'blue-1' } });
    const r = resolveTurn(s, pl, fixedRng([0.0, 0.0]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'complete' });
    expect(estimatePass(s, 'blue-0', 'blue-1').interceptors).toHaveLength(0);
  });

  it('an enemy in the kicker\'s cell does not block a shot', () => {
    const s = scene({ 'blue-0': { x: 3, y: 2 }, 'red-0': { x: 3, y: 2 } }, held('blue-0'));
    expect(estimateShot(s, 'blue-0').blockers).toHaveLength(0);
  });

  it('an enemy in the receiver\'s cell is rolled last (ground)', () => {
    const s = scene(
      { 'blue-0': { x: 3, y: 6 }, 'blue-1': { x: 3, y: 2 }, 'red-0': { x: 3, y: 2 }, 'red-1': { x: 3, y: 4 } },
      held('blue-0'),
    );
    const e = estimatePass(s, 'blue-0', 'blue-1');
    expect(e.interceptors.map((i) => i.playerId)).toEqual(['red-1', 'red-0']);
    const stats = getCharacter(getPlayer(s, 'red-0').charId).stats;
    expect(e.interceptors[1]?.pIntercept).toBeCloseTo(interceptProbability(stats.intercept, 0));
    // first roll misses, tight marker (second roll) succeeds
    const r = resolveTurn(s, plans({ ballAction: { kind: 'pass', targetId: 'blue-1' } }), fixedRng([0.999, 0.0]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'intercepted', interceptorId: 'red-0' });
    expect(ballHolder(r.after)?.id).toBe('red-0');
  });

  it('an enemy in the receiver\'s cell is rolled last (lofted, aerial stat)', () => {
    const s = scene({ 'blue-0': { x: 3, y: 9 }, 'blue-1': { x: 3, y: 2 }, 'red-0': { x: 3, y: 2 } }, held('blue-0'));
    const e = estimatePass(s, 'blue-0', 'blue-1', undefined, undefined, undefined, 'lofted');
    expect(e.interceptors.map((i) => i.playerId)).toEqual(['red-0']);
    const stats = getCharacter(getPlayer(s, 'red-0').charId).stats;
    expect(e.interceptors[0]?.pIntercept).toBeCloseTo(interceptProbability(stats.aerial, 0));
  });

  it('cross: aerial defender may stand in the receiver\'s own cell', () => {
    const s = scene({ 'blue-1': { x: 1, y: 3 }, 'blue-0': { x: 3, y: 1 }, 'red-4': { x: 3, y: 1 } }, held('blue-1'));
    expect(aerialDefender(s, 'blue', { x: 3, y: 1 }, { 'red-4': { x: 3, y: 1 } })?.id).toBe('red-4');
    const r = resolveTurn(s, plans({ ballAction: { kind: 'cross', targetId: 'blue-0' } }), fixedRng([0.0, 0.9]));
    expect(ev(r.events, 'cross')[0]).toMatchObject({ outcome: 'lost', defenderId: 'red-4' });
  });

  it('space pass to a cell shared by a teammate and an enemy: the teammate receives', () => {
    for (const order of [['red-3', 'blue-1'], ['blue-1', 'red-3']]) {
      const base = { 'blue-0': { x: 3, y: 5 }, 'red-4': { x: 6, y: 0 } };
      const pos: Record<string, { x: number; y: number }> = { ...base };
      for (const id of order) pos[id as string] = { x: 3, y: 2 };
      const s = scene(pos, held('blue-0'), legacy);
      // tight marker misses, accuracy succeeds
      const r = resolveTurn(s, plans({ ballAction: { kind: 'spacePass', target: { x: 3, y: 2 } } }), fixedRng([0.99, 0.0]));
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'complete', receiverId: 'blue-1' });
      expect(ballHolder(r.after)?.id).toBe('blue-1');
    }
  });
});

// ---------------------------------------------------------------------------
// v0.4 fix round: displace targets, kicker-cell cross, extra coverage
// ---------------------------------------------------------------------------
const draws = (values: number[]) => {
  const inner = fixedRng(values);
  let n = 0;
  return { rng: { next: () => (n++, inner.next()) }, count: () => n };
};
const phys = (s: MatchState, id: string) => getEffectiveStats(s, getPlayer(s, id)).physical;

describe('displace target (v0.4 fix)', () => {
  it('never picks a cell another player started on (later bounce cannot land there)', () => {
    // blue-0 (holder) moves onto stationary blue-1 at (2,5): blue-1 is displaced, nearest/own-goal-first
    // candidate is (2,6) = origin of red-4, who then loses a red conflict at (2,7) and bounces home.
    const s = scene(
      { 'blue-0': { x: 3, y: 5 }, 'blue-1': { x: 2, y: 5 }, 'red-4': { x: 2, y: 6 }, 'red-3': { x: 2, y: 7 } },
      held('blue-0'),
    );
    const r = resolveTurn(s, plans({ moves: { 'blue-0': { x: 2, y: 5 } } }, { moves: { 'red-4': { x: 2, y: 7 } } }), fixedRng([0.5]));
    expect(ev(r.events, 'bounce').map((b) => b.playerId)).toContain('red-4');
    const d = ev(r.events, 'displace');
    expect(d).toHaveLength(1);
    expect(d[0]?.playerId).toBe('blue-1');
    expect(d[0]?.to).not.toEqual({ x: 2, y: 6 });
    const cells = r.after.players.map((p) => `${p.team}:${p.pos.x},${p.pos.y}`);
    expect(new Set(cells).size).toBe(cells.length);
    // the displaced player shares its cell with nobody at all
    const bp = getPlayer(r.after, 'blue-1').pos;
    expect(r.after.players.filter((p) => p.pos.x === bp.x && p.pos.y === bp.y)).toHaveLength(1);
  });

  it('a player receives at most one displace event; the target is not any planned destination', () => {
    // red-0 stays at (3,3); red-1 plans to enter it, red-2 plans (3,2) (candidate toward own goal) but is bounced.
    const s = scene(
      { 'red-0': { x: 3, y: 3 }, 'red-1': { x: 3, y: 2 }, 'red-2': { x: 2, y: 1 }, 'red-3': { x: 4, y: 1 }, 'blue-0': { x: 3, y: 8 } },
      held('blue-0'),
    );
    const r = resolveTurn(
      s,
      plans({}, { moves: { 'red-1': { x: 3, y: 3 }, 'red-2': { x: 3, y: 2 }, 'red-3': { x: 3, y: 2 } } }),
      fixedRng([0.5]),
    );
    const per = new Map<string, number>();
    for (const e of ev(r.events, 'displace')) per.set(e.playerId, (per.get(e.playerId) ?? 0) + 1);
    for (const n of per.values()) expect(n).toBe(1);
    const cells = r.after.players.map((p) => `${p.team}:${p.pos.x},${p.pos.y}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

describe('cross: kicker-cell enemy (v0.4 fix)', () => {
  it('an enemy in the kicker\'s cell is not the aerial defender', () => {
    const s = scene({ 'blue-1': { x: 1, y: 2 }, 'red-2': { x: 1, y: 2 }, 'blue-0': { x: 2, y: 2 } }, held('blue-1'));
    const defs = { 'red-2': { x: 1, y: 2 } } as Record<string, { x: number; y: number }>;
    expect(aerialDefender(s, 'blue', { x: 2, y: 2 }, defs, { x: 1, y: 2 })).toBeUndefined();
    expect(aerialDefender(s, 'blue', { x: 2, y: 2 }, defs)?.id).toBe('red-2');
    expect(estimateCross(s, 'blue-1', 'blue-0').defenderId).toBeUndefined();
    const d = draws([0.0, 0.0, 0.99]); // carrier-cell duel (blue wins), delivery, header
    const r = resolveTurn(s, plans({ ballAction: { kind: 'cross', targetId: 'blue-0' } }), d.rng);
    expect(ev(r.events, 'duel').filter((e) => e.kind === 'aerial')).toHaveLength(0);
    expect(ev(r.events, 'cross')[0]).toMatchObject({ outcome: 'uncontested' });
  });
});

describe('ball duel roles and probabilities (v0.4)', () => {
  it('holder swaps with X while Y moves into the holder destination: one duel against Y, one draw', () => {
    const s = scene(
      { 'blue-0': { x: 3, y: 5 }, 'red-0': { x: 3, y: 4 }, 'red-1': { x: 3, y: 3 } },
      held('blue-0'),
    );
    const d = draws([0.5]);
    const r = resolveTurn(
      s,
      plans({ moves: { 'blue-0': { x: 3, y: 4 } } }, { moves: { 'red-0': { x: 3, y: 5 }, 'red-1': { x: 3, y: 4 } } }),
      d.rng,
    );
    expect(getPlayer(r.after, 'red-1').pos).toEqual({ x: 3, y: 4 });
    expect(getPlayer(r.after, 'red-0').pos).toEqual({ x: 3, y: 5 });
    const duels = ev(r.events, 'duel');
    expect(duels).toHaveLength(1);
    expect(duels[0]).toMatchObject({ aId: 'blue-0', bId: 'red-1', pos: { x: 3, y: 4 } });
    expect(d.count()).toBe(1);
  });

  it('holder stays, enemy moves in: A is the mover', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'red-0': { x: 3, y: 3 } }, held('blue-0'));
    const r = resolveTurn(s, plans({}, { moves: { 'red-0': { x: 3, y: 5 } } }), fixedRng([0.5]));
    const d = ev(r.events, 'duel')[0];
    expect(d).toMatchObject({ aId: 'red-0', bId: 'blue-0', forBall: true });
    expect(d?.pAWins).toBeCloseTo(1 - duelWinProbability(phys(s, 'blue-0'), phys(s, 'red-0'), { carrierIsA: true }));
  });

  it('red holder tackled by blue: A = blue (mover), carrier bonus goes to B', () => {
    const s = scene({ 'red-0': { x: 3, y: 5 }, 'blue-0': { x: 3, y: 7 } }, held('red-0'));
    const r = resolveTurn(s, plans({ moves: { 'blue-0': { x: 3, y: 5 } } }), fixedRng([0.5]));
    const d = ev(r.events, 'duel')[0];
    expect(d).toMatchObject({ aId: 'blue-0', bId: 'red-0' });
    expect(d?.pAWins).toBeCloseTo(1 - duelWinProbability(phys(s, 'red-0'), phys(s, 'blue-0'), { carrierIsA: true }));
  });

  it('both already share the cell and both stay: A = blue', () => {
    const shared = { 'blue-1': { x: 2, y: 5 }, 'red-1': { x: 2, y: 5 }, 'blue-0': { x: 3, y: 8 } };
    for (const holderId of ['blue-1', 'red-1']) {
      const s = scene(shared, held(holderId));
      const d = draws([0.5]);
      const r = resolveTurn(s, plans(), d.rng);
      const e = ev(r.events, 'duel')[0];
      expect(e).toMatchObject({ aId: 'blue-1', bId: 'red-1' });
      const expected =
        holderId === 'blue-1'
          ? duelWinProbability(phys(s, 'blue-1'), phys(s, 'red-1'), { carrierIsA: true })
          : 1 - duelWinProbability(phys(s, 'red-1'), phys(s, 'blue-1'), { carrierIsA: true });
      expect(e?.pAWins).toBeCloseTo(expected);
      expect(d.count()).toBe(1);
    }
  });

  it('swap duel where the holder loses: foe gets the ball and wonBallTurn, positions stay swapped', () => {
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'red-0': { x: 3, y: 4 } }, held('blue-0'), { turn: 4 });
    const r = resolveTurn(s, plans({ moves: { 'blue-0': { x: 3, y: 4 } } }, { moves: { 'red-0': { x: 3, y: 5 } } }), fixedRng([0.99]));
    expect(ballHolder(r.after)?.id).toBe('red-0');
    expect(getPlayer(r.after, 'red-0').flags.wonBallTurn).toBe(4);
    expect(getPlayer(r.after, 'blue-0').pos).toEqual({ x: 3, y: 4 });
    expect(getPlayer(r.after, 'red-0').pos).toEqual({ x: 3, y: 5 });
  });

  it('loose-ball duel winner gets wonBallTurn; an uncontested pickup does not', () => {
    const loose = { kind: 'loose', pos: { x: 3, y: 4 } } as const;
    const s = scene({ 'blue-0': { x: 3, y: 5 }, 'red-0': { x: 3, y: 3 } }, loose, { turn: 3 });
    const both = resolveTurn(s, plans({ moves: { 'blue-0': { x: 3, y: 4 } } }, { moves: { 'red-0': { x: 3, y: 4 } } }), fixedRng([0.0]));
    expect(ballHolder(both.after)?.id).toBe('blue-0');
    expect(getPlayer(both.after, 'blue-0').flags.wonBallTurn).toBe(3);
    const solo = resolveTurn(s, plans({ moves: { 'blue-0': { x: 3, y: 4 } } }), fixedRng([0.5]));
    expect(getPlayer(solo.after, 'blue-0').flags.wonBallTurn).toBeUndefined();
  });
});

describe('ball action after a won duel (v0.4)', () => {
  // blue-0 walks onto red-0 (carrier-cell duel, rng 0.0 = win) and then acts; red-3/red-4 deep to keep blue-1 onside.
  const pos = {
    'blue-0': { x: 3, y: 6 }, 'red-0': { x: 3, y: 4 }, 'blue-1': { x: 3, y: 2 },
    'red-4': { x: 6, y: 0 }, 'red-3': { x: 6, y: 1 },
  };
  const move = { 'blue-0': { x: 3, y: 4 } };

  for (const style of ['ground', 'lofted'] as const) {
    it(`${style} pass: the duel loser in the kicker's cell never intercepts`, () => {
      const s = scene(pos, held('blue-0'));
      const d = draws([0.0, 0.0]);
      const r = resolveTurn(s, plans({ moves: move, ballAction: { kind: 'pass', targetId: 'blue-1', style } }), d.rng);
      expect(ev(r.events, 'duel')[0]).toMatchObject({ winnerId: 'blue-0' });
      expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'complete', style });
      expect(d.count()).toBe(2); // duel + accuracy; no interception rolls
    });
  }

  it('shot: the duel loser in the kicker\'s cell never blocks', () => {
    const s = scene(pos, held('blue-0'));
    const d = draws([0.0, 0.0]);
    const r = resolveTurn(s, plans({ moves: move, ballAction: { kind: 'shoot' } }), d.rng);
    expect(ev(r.events, 'shot')[0]).toMatchObject({ outcome: 'goal' });
    expect(d.count()).toBe(2); // duel + goal roll
  });
});

describe('space pass cells (v0.4)', () => {
  const base = { 'blue-0': { x: 3, y: 5 }, 'red-4': { x: 6, y: 0 }, 'red-3': { x: 6, y: 1 } };
  const sp = { ballAction: { kind: 'spacePass', target: { x: 3, y: 2 } } } as const;
  it('enemy only: tight marker misses, accuracy passes -> toEnemy, two draws', () => {
    const s = scene({ ...base, 'red-2': { x: 3, y: 2 } }, held('blue-0'), legacy);
    const d = draws([0.99, 0.0]);
    const r = resolveTurn(s, plans(sp), d.rng);
    expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'toEnemy', receiverId: 'red-2' });
    expect(d.count()).toBe(2);
  });
  it('teammate + enemy: the tight marker is rolled and can intercept', () => {
    const s = scene({ ...base, 'blue-1': { x: 3, y: 2 }, 'red-2': { x: 3, y: 2 } }, held('blue-0'), legacy);
    const d = draws([0.0]);
    const r = resolveTurn(s, plans(sp), d.rng);
    expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'intercepted', interceptorId: 'red-2' });
    expect(ballHolder(r.after)?.id).toBe('red-2');
    expect(d.count()).toBe(1);
  });
});

describe('offside with a shared receiver cell (v0.4)', () => {
  it('the defender sharing the receiver\'s cell gets the ball, zero draws', () => {
    // With the default k=1 a sharer is always level with the last defender (onside), so use k=2 here.
    const cfg = RULES.offside as { lastDefenders: number };
    const saved = cfg.lastDefenders;
    cfg.lastDefenders = 2;
    try {
      const s = scene(
        { 'blue-0': { x: 3, y: 6 }, 'blue-1': { x: 3, y: 2 }, 'red-4': { x: 3, y: 2 }, 'red-3': { x: 1, y: 4 } },
        held('blue-0'),
      );
      const d = draws([]);
      const r = resolveTurn(s, plans({ ballAction: { kind: 'pass', targetId: 'blue-1' } }), d.rng);
      expect(ev(r.events, 'offside')[0]).toMatchObject({ receiverId: 'blue-1', toPlayerId: 'red-4' });
      expect(ballHolder(r.after)?.id).toBe('red-4');
      expect(d.count()).toBe(0);
    } finally {
      cfg.lastDefenders = saved;
    }
  });
});

describe('invariants over seeded random play (v0.4)', () => {
  it('holds over ~300 turns of AI and random plans', () => {
    const rank: Record<string, number> = { bounce: 0, displace: 0, duel: 1, move: 2, pickup: 3 };
    let turns = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const rng = createRng(seed);
      let state = createMatch({ maxTurns: 20 });
      while (state.phase !== 'finished') {
        const random = seed % 2 === 0;
        const mk = (team: 'blue' | 'red') => {
          if (!random) return planAiTurn(state, team, rng);
          const moves: Record<string, { x: number; y: number }> = {};
          for (const p of state.players.filter((q) => q.team === team)) {
            const t = legalMoveTargets(state, p.id);
            if (t.length > 0 && rng.next() < 0.8) moves[p.id] = t[Math.floor(rng.next() * t.length)] as { x: number; y: number };
          }
          return { team, moves, ballAction: { kind: 'keep' as const } };
        };
        const pl = { blue: mk('blue'), red: mk('red') };
        const mvEvents = resolveMovement(state, pl, createRng(seed * 1000 + turns)).events;
        const r = resolveTurn(state, pl, createRng(seed * 1000 + turns));
        turns++;
        const order = mvEvents.map((e) => rank[e.type] as number);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(mvEvents.filter((e) => e.type === 'duel').length).toBeLessThanOrEqual(1);
        for (const e of mvEvents) {
          if (e.type === 'bounce') expect(e.reason).toBe('teammate');
          if (e.type === 'duel') expect(e.forBall).toBe(true);
        }
        const dis = new Map<string, number>();
        for (const e of mvEvents) if (e.type === 'displace') dis.set(e.playerId, (dis.get(e.playerId) ?? 0) + 1);
        for (const n of dis.values()) expect(n).toBe(1);
        const seen = new Set<string>();
        for (const p of r.afterAction.players) {
          expect(p.pos.x >= 0 && p.pos.x < 7 && p.pos.y >= 0 && p.pos.y < 10).toBe(true);
          const k = `${p.team}:${p.pos.x},${p.pos.y}`;
          expect(seen.has(k)).toBe(false);
          seen.add(k);
        }
        state = r.after;
      }
    }
    expect(turns).toBeGreaterThanOrEqual(300);
  });
});
