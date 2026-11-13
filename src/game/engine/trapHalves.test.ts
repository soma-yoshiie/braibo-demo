import { describe, expect, it } from 'vitest';
import type { MatchState, TurnEvent, TurnPlans, Vec } from '../types';
import { resolveTurn } from './resolve';
import { createMatch, ballHolder, getPlayer } from './match';
import { fixedRng } from './rng';
import { describeEvent } from './log';
import { canDeclareTrap, trapParticipants, trapWait } from '../rules/trap';
import { halfOf, halfTurns, halvesEnabled, trapEnabled } from '../rules/config';
import { held, plans, scene } from '../testUtils';

const ev = <T extends TurnEvent['type']>(events: TurnEvent[], type: T) =>
  events.filter((e): e is Extract<TurnEvent, { type: T }> => e.type === type);

const draws = (values: number[]) => {
  const inner = fixedRng(values);
  let n = 0;
  return { rng: { next: () => (n++, inner.next()) }, count: () => n };
};

const at = (x: number, y: number): Vec => ({ x, y });
const sp = (x: number, y: number) => ({ ballAction: { kind: 'spacePass', target: { x, y } } }) as const;
const foot = (targetId: string) => ({ ballAction: { kind: 'pass', targetId } }) as const;
const TRAP = { trap: true } as const;

/** Blues that are out of the way (so only the named ones matter). */
const FAR = { 'blue-2': at(0, 9), 'blue-3': at(1, 9), 'blue-4': at(2, 9) };

// Red defends the top: its deepest row is the SMALLEST y and a trap step goes to y + 1.
// Unspecified reds are parked at (6,9) (6,8) (6,7) (6,6) (6,5), so red-4 (6,5) is the deepest by default.

describe('canDeclareTrap / trapWait / trapParticipants', () => {
  it('needs the opponent to hold the ball, the switch on and the wait over', () => {
    const base = { 'blue-0': at(3, 6), 'red-0': at(3, 3) };
    const blueHas = scene(base, held('blue-0'), { trap: true });
    expect(canDeclareTrap(blueHas, 'red')).toBe(true);
    expect(canDeclareTrap(blueHas, 'blue')).toBe(false); // own ball
    const redHas = scene(base, held('red-0'), { trap: true });
    expect(canDeclareTrap(redHas, 'blue')).toBe(true);
    expect(canDeclareTrap(redHas, 'red')).toBe(false);
    const loose = scene(base, { kind: 'loose', pos: at(3, 4) }, { trap: true });
    expect(canDeclareTrap(loose, 'blue')).toBe(false);
    expect(canDeclareTrap(loose, 'red')).toBe(false);
    expect(canDeclareTrap(scene(base, held('blue-0'), { trap: false }), 'red')).toBe(false);
    expect(trapEnabled(scene(base, held('blue-0'), { trap: false }))).toBe(false);
  });

  it('trapWait counts the turns left; the default (no trapReady) is ready', () => {
    const s = scene({ 'blue-0': at(3, 6) }, held('blue-0'), { trap: true, turn: 3, trapReady: { blue: 1, red: 5 } });
    expect(trapWait(s, 'red')).toBe(2);
    expect(trapWait(s, 'blue')).toBe(0);
    expect(canDeclareTrap(s, 'red')).toBe(false);
    expect(canDeclareTrap({ ...s, turn: 5 }, 'red')).toBe(true);
    expect(trapWait(scene({}, held('blue-0'), { trap: true }), 'red')).toBe(0);
  });

  it('participants are everybody in the deepest row', () => {
    const s = scene({ 'blue-0': at(3, 6), 'red-3': at(2, 2), 'red-4': at(4, 2), 'red-2': at(3, 3) }, held('blue-0'), { trap: true });
    expect(trapParticipants(s, 'red').map((p) => p.id).sort()).toEqual(['red-3', 'red-4']);
    const b = scene({ 'blue-3': at(2, 8), 'blue-4': at(4, 8), 'blue-2': at(3, 7), 'red-0': at(3, 3) }, held('red-0'), { trap: true });
    expect(trapParticipants(b, 'blue').map((p) => p.id).sort()).toEqual(['blue-3', 'blue-4']);
  });
});

describe('invalid declarations are ignored (no event, no rng change, same result as no declaration)', () => {
  const same = (s: MatchState, p: TurnPlans, rngValues: number[]) => {
    const a = draws(rngValues);
    const withTrap = resolveTurn(s, p, a.rng);
    const stripped: TurnPlans = { blue: { ...p.blue, trap: undefined }, red: { ...p.red, trap: undefined } };
    const b = draws(rngValues);
    const without = resolveTurn(s, stripped, b.rng);
    expect(ev(withTrap.events, 'trap')).toHaveLength(0);
    expect(withTrap.events).toEqual(without.events);
    expect(withTrap.after).toEqual(without.after);
    expect(a.count()).toBe(b.count());
    expect(withTrap.after.trapReady).toEqual(s.trapReady); // untouched
  };

  it('own ball', () => {
    const s = scene({ 'blue-0': at(3, 6), 'red-4': at(5, 3) }, held('blue-0'), { trap: true });
    same(s, plans({ ...TRAP, ballAction: { kind: 'keep' } }), [0.5]);
    same(s, plans({}, {}), [0.5]);
    // a blue declaration while blue holds the ball
    same(s, plans({ ...TRAP }, {}), [0.5]);
  });
  it('loose ball', () => {
    const s = scene({ 'blue-0': at(3, 6), 'red-4': at(5, 3), 'red-3': at(4, 4) }, { kind: 'loose', pos: at(3, 5) }, { trap: true });
    same(s, plans({ moves: { 'blue-0': at(3, 5) } }, { ...TRAP }), [0.5]);
  });
  it('still on the cooldown', () => {
    const s = scene({ 'blue-0': at(3, 6), 'red-4': at(5, 3) }, held('blue-0'), { trap: true, turn: 3, trapReady: { blue: 1, red: 4 } });
    same(s, plans({}, { ...TRAP }), [0.5]);
  });
  it('switch off', () => {
    const s = scene({ 'blue-0': at(3, 6), 'red-4': at(5, 3) }, held('blue-0'), { trap: false });
    same(s, plans({}, { ...TRAP }), [0.5]);
  });
});

describe('the forward step', () => {
  it('every participant steps one row forward; the trap event is first; no rng is used', () => {
    const s = scene({ 'blue-0': at(3, 6), 'red-3': at(2, 2), 'red-4': at(4, 2), 'red-2': at(3, 4), 'red-0': at(5, 5) }, held('blue-0'), { trap: true });
    const d = draws([0.5]);
    const r = resolveTurn(s, plans({}, { ...TRAP }), d.rng);
    expect(d.count()).toBe(0);
    expect(r.events[0]).toEqual({
      type: 'trap',
      team: 'red',
      steps: [
        { playerId: 'red-3', from: at(2, 2), to: at(2, 3) },
        { playerId: 'red-4', from: at(4, 2), to: at(4, 3) },
      ],
    });
    expect(getPlayer(r.after, 'red-3').pos).toEqual(at(2, 3));
    expect(getPlayer(r.after, 'red-4').pos).toEqual(at(4, 3));
    expect(r.before).toBe(s);
    expect(ev(r.events, 'move')).toHaveLength(0); // the step is reported by the trap event only
    expect(r.after.trapReady).toEqual({ blue: 1, red: 1 + 1 + 2 });
  });

  it('blue steps toward y - 1 when it declares', () => {
    const s = scene({ 'red-0': at(3, 3), 'blue-4': at(3, 8), 'blue-3': at(2, 7), 'blue-2': at(5, 6) }, held('red-0'), { trap: true });
    const r = resolveTurn(s, plans({ ...TRAP }), fixedRng([0.5]));
    expect(ev(r.events, 'trap')[0]).toMatchObject({ team: 'blue', steps: [{ playerId: 'blue-4', from: at(3, 8), to: at(3, 7) }] });
    expect(getPlayer(r.after, 'blue-4').pos).toEqual(at(3, 7));
  });

  it('exception 1: a participant with a teammate straight ahead stays (but is still a participant)', () => {
    const s = scene({ 'blue-0': at(3, 6), 'red-3': at(2, 2), 'red-4': at(4, 2), 'red-2': at(2, 3) }, held('blue-0'), { trap: true });
    const r = resolveTurn(s, plans({}, { ...TRAP, moves: { 'red-3': at(2, 1) } }), fixedRng([0.5]));
    const steps = ev(r.events, 'trap')[0]?.steps ?? [];
    expect(steps.find((x) => x.playerId === 'red-3')).toEqual({ playerId: 'red-3', from: at(2, 2), to: at(2, 2) });
    expect(steps.find((x) => x.playerId === 'red-4')?.to).toEqual(at(4, 3));
    expect(getPlayer(r.after, 'red-3').pos).toEqual(at(2, 2)); // stuck: its move plan is ignored
  });

  it('exception 2: a participant does not step onto the ball carrier', () => {
    const s = scene({ 'blue-0': at(2, 3), 'red-4': at(2, 2), 'red-3': at(4, 2) }, held('blue-0'), { trap: true });
    const r = resolveTurn(s, plans({}, { ...TRAP }), fixedRng([0.5]));
    const steps = ev(r.events, 'trap')[0]?.steps ?? [];
    expect(steps.find((x) => x.playerId === 'red-4')?.to).toEqual(at(2, 2));
    expect(steps.find((x) => x.playerId === 'red-3')?.to).toEqual(at(4, 3));
    expect(ev(r.events, 'duel')).toHaveLength(0);
  });

  it('shares the cell with a non-carrier enemy without any duel or rng', () => {
    const s = scene({ 'blue-0': at(3, 6), 'blue-1': at(2, 3), 'red-4': at(2, 2), 'red-3': at(6, 6) }, held('blue-0'), { trap: true });
    const d = draws([0.5]);
    const r = resolveTurn(s, plans({}, { ...TRAP }), d.rng);
    expect(getPlayer(r.after, 'red-4').pos).toEqual(at(2, 3));
    expect(getPlayer(r.after, 'blue-1').pos).toEqual(at(2, 3));
    expect(ev(r.events, 'duel')).toHaveLength(0);
    expect(d.count()).toBe(0);
  });

  it('participants ignore their move plans', () => {
    const s = scene({ 'blue-0': at(3, 6), 'red-4': at(5, 3) }, held('blue-0'), { trap: true });
    const r = resolveTurn(s, plans({}, { ...TRAP, moves: { 'red-4': at(5, 1) } }), fixedRng([0.5]));
    expect(getPlayer(r.after, 'red-4').pos).toEqual(at(5, 4));
    expect(ev(r.events, 'move').filter((m) => m.playerId === 'red-4')).toHaveLength(0);
    // non-participants still move
    const t = resolveTurn(s, plans({}, { ...TRAP, moves: { 'red-3': at(5, 7) } }), fixedRng([0.5]));
    expect(getPlayer(t.after, 'red-3').pos).toEqual(at(5, 7));
  });

  it('a runner that enters the stepped-up participant cell with the ball duels normally', () => {
    const s = scene({ 'red-0': at(3, 5), 'blue-4': at(3, 8) }, held('red-0'), { trap: true });
    // blue-4 steps (3,8) -> (3,7); the red striker runs forward 2 into (3,7)
    const r = resolveTurn(s, plans({ ...TRAP }, { moves: { 'red-0': at(3, 7) } }), fixedRng([0.1]));
    const duel = ev(r.events, 'duel')[0];
    expect(duel).toMatchObject({ pos: at(3, 7), aId: 'red-0', bId: 'blue-4', forBall: true });
    expect(ev(r.events, 'bounce')).toHaveLength(0);
    expect(r.events[0]?.type).toBe('trap');
  });
});

describe('through pass against a trap (kick-time positions are the stepped-up ones)', () => {
  it('turns an onside early through pass into offside (byTrap)', () => {
    // red line y=3; blue-1 on y=3 is level = onside at the start; one step up puts the line on y=4.
    const s = scene({ 'blue-0': at(3, 6), 'blue-1': at(1, 3), 'red-4': at(5, 3), 'red-3': at(6, 6), ...{ 'blue-2': at(0, 9), 'blue-3': at(1, 9), 'blue-4': at(2, 9) } }, held('blue-0'), { trap: true });
    const noTrap = resolveTurn(s, plans(sp(1, 3)), fixedRng([0.0]));
    expect(ev(noTrap.events, 'offside')).toHaveLength(0);
    expect(ev(noTrap.events, 'pass')[0]).toMatchObject({ outcome: 'complete', receiverId: 'blue-1' });

    const d = draws([0.0]);
    const r = resolveTurn(s, plans(sp(1, 3), { ...TRAP }), d.rng);
    expect(r.events[0]?.type).toBe('trap');
    expect(ev(r.events, 'offside')[0]).toMatchObject({
      early: true, byTrap: true, receiverId: 'blue-1', toPlayerId: 'red-4', from: at(3, 6), to: at(1, 3), team: 'blue',
    });
    expect(ev(r.events, 'pass')).toHaveLength(0);
    expect(ballHolder(r.after)?.id).toBe('red-4');
    expect(d.count()).toBe(1); // the accuracy roll was still spent
    expect(describeEvent(ev(r.events, 'offside')[0] as TurnEvent, r.after)).toContain('トラップ成功');
  });

  it('an offside that does not depend on the trap carries no byTrap flag', () => {
    const s = scene({ 'blue-0': at(3, 6), 'blue-1': at(1, 2), 'red-4': at(5, 3), 'red-3': at(6, 6), ...FAR }, held('blue-0'), { trap: true });
    const r = resolveTurn(s, plans(sp(1, 2), { ...TRAP }), fixedRng([0.0]));
    const o = ev(r.events, 'offside')[0];
    expect(o).toBeDefined();
    expect(o?.byTrap).toBeUndefined();
  });

  it('a runner starting one row deeper stays onside and receives behind the stepped-up line', () => {
    const s = scene({ 'blue-0': at(3, 6), 'blue-1': at(1, 4), 'red-4': at(5, 3), 'red-3': at(6, 6), ...FAR }, held('blue-0'), { trap: true });
    const d = draws([0.0]);
    const r = resolveTurn(s, plans({ ...sp(1, 2), moves: { 'blue-1': at(1, 2) } }, { ...TRAP }), d.rng);
    expect(ev(r.events, 'offside')).toHaveLength(0);
    expect(ev(r.events, 'pass')[0]).toMatchObject({ early: true, outcome: 'complete', receiverId: 'blue-1' });
    expect(getPlayer(r.after, 'blue-1').pos).toEqual(at(1, 2));
    expect(getPlayer(r.after, 'red-4').pos).toEqual(at(5, 4)); // the line is stuck up
    expect(ballHolder(r.after)?.id).toBe('blue-1');
    expect(d.count()).toBe(1);
  });

  it('lane interception uses the positions after the trap step', () => {
    // lane (3,6) -> (0,3): (1,4) is on the line; red-4 at (1,3) is off it until it steps there.
    const s = scene({ 'blue-0': at(3, 6), 'red-4': at(1, 3), 'red-3': at(6, 6), ...FAR, 'blue-1': at(6, 0) }, held('blue-0'), { trap: true });
    const plain = resolveTurn(s, plans(sp(0, 3)), fixedRng([0.0]));
    expect(ev(plain.events, 'pass')[0]).toMatchObject({ outcome: 'loose' });
    const r = resolveTurn(s, plans(sp(0, 3), { ...TRAP }), fixedRng([0.0]));
    expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'intercepted', interceptorId: 'red-4', early: true });
    expect(ballHolder(r.after)?.id).toBe('red-4');
  });
});

describe('foot pass and cross against a trap (judged on final positions, participants stuck up)', () => {
  const base = { 'blue-0': at(3, 6), 'blue-1': at(1, 5), 'red-4': at(5, 3), 'red-3': at(6, 6), ...FAR };
  it('a receiver who stays level with the stuck-up line completes; no offside', () => {
    const s = scene(base, held('blue-0'), { trap: true });
    const r = resolveTurn(s, plans({ ...foot('blue-1'), moves: { 'blue-1': at(1, 4) } }, { ...TRAP, moves: { 'red-4': at(5, 1) } }), fixedRng([0.0]));
    expect(ev(r.events, 'offside')).toHaveLength(0);
    expect(ev(r.events, 'pass')[0]).toMatchObject({ outcome: 'complete', receiverId: 'blue-1' });
    expect(getPlayer(r.after, 'red-4').pos).toEqual(at(5, 4)); // could not go back
  });
  it('a receiver who runs past the stepped-up line is offside, and the trap made it (byTrap)', () => {
    const s = scene(base, held('blue-0'), { trap: true });
    const r = resolveTurn(s, plans({ ...foot('blue-1'), moves: { 'blue-1': at(1, 3) } }, { ...TRAP }), fixedRng([0.0]));
    expect(ev(r.events, 'offside')[0]).toMatchObject({ receiverId: 'blue-1', byTrap: true });
    expect(ev(r.events, 'offside')[0]?.early).toBeUndefined();
    // without the declaration the same plan is fine (red-4 stays on y=3)
    const plain = resolveTurn(s, plans({ ...foot('blue-1'), moves: { 'blue-1': at(1, 3) } }), fixedRng([0.0]));
    expect(ev(plain.events, 'offside')).toHaveLength(0);
  });
});

describe('two participants in the last row, a blocked participant', () => {
  it('both step; one blocked by a teammate stays; the offside re-judge moves back only the ones that stepped', () => {
    const s = scene(
      { 'blue-0': at(3, 6), 'blue-1': at(1, 3), 'red-3': at(2, 2), 'red-4': at(4, 2), 'red-2': at(2, 3), ...{ 'blue-2': at(0, 9), 'blue-3': at(1, 9), 'blue-4': at(2, 9) } },
      held('blue-0'),
      { trap: true },
    );
    const r = resolveTurn(s, plans(sp(1, 3), { ...TRAP }), fixedRng([0.0]));
    const steps = ev(r.events, 'trap')[0]?.steps ?? [];
    expect(steps).toHaveLength(2);
    expect(steps.find((x) => x.playerId === 'red-3')?.to).toEqual(at(2, 2)); // blocked by red-2
    expect(steps.find((x) => x.playerId === 'red-4')?.to).toEqual(at(4, 3));
    // line: red-2 sits on y=3 already, so blue-1 on y=3 is level, not offside. Nothing changed the verdict.
    expect(ev(r.events, 'offside')).toHaveLength(0);
  });
});

describe('cooldown bookkeeping', () => {
  it('the wait runs for 2 turns after the declaration, is kept across a goal', () => {
    let s = scene({ 'blue-0': at(3, 6), 'red-4': at(5, 3), 'red-3': at(6, 6) }, held('blue-0'), { trap: true });
    const r1 = resolveTurn(s, plans({}, { ...TRAP }), fixedRng([0.5]));
    expect(r1.after.trapReady).toEqual({ blue: 1, red: 4 });
    // turns 2 and 3: still waiting
    s = r1.after;
    expect(trapWait(s, 'red')).toBe(2);
    const r2 = resolveTurn(s, plans({}, { ...TRAP }), fixedRng([0.5]));
    expect(ev(r2.events, 'trap')).toHaveLength(0);
    expect(r2.after.trapReady).toEqual({ blue: 1, red: 4 });
    s = r2.after;
    expect(trapWait(s, 'red')).toBe(1);
    const r3 = resolveTurn(s, plans({}, { ...TRAP }), fixedRng([0.5]));
    expect(ev(r3.events, 'trap')).toHaveLength(0);
    s = r3.after;
    expect(s.turn).toBe(4);
    expect(trapWait(s, 'red')).toBe(0);
    expect(canDeclareTrap(s, 'red')).toBe(ballHolder(s)?.team === 'blue');
    const ready = { ...s, ball: held('blue-0') };
    const r4 = resolveTurn(ready, plans({}, { ...TRAP }), fixedRng([0.5]));
    expect(ev(r4.events, 'trap')).toHaveLength(1);
    expect(r4.after.trapReady?.red).toBe(4 + 1 + 2);
    expect(r4.after.trapReady?.blue).toBe(1); // the other team is untouched
  });

  it('is not reset by a goal (the kickoff keeps it)', () => {
    const s = scene({ 'blue-0': at(3, 1), 'red-4': at(5, 3), 'red-3': at(6, 6) }, held('blue-0'), { trap: true });
    const r = resolveTurn(s, plans({ ballAction: { kind: 'shoot' } }, { ...TRAP }), fixedRng([0.0]));
    expect(ev(r.events, 'goal')).toHaveLength(1);
    expect(ev(r.events, 'kickoff')).toHaveLength(1);
    expect(r.after.trapReady).toEqual({ blue: 1, red: 4 });
    expect(r.afterAction.trapReady).toEqual({ blue: 1, red: 4 });
  });

  it('both teams keep separate waits', () => {
    const s = scene({ 'red-0': at(3, 3), 'blue-4': at(3, 8) }, held('red-0'), { trap: true, turn: 6, trapReady: { blue: 1, red: 9 } });
    const r = resolveTurn(s, plans({ ...TRAP }), fixedRng([0.5]));
    expect(r.after.trapReady).toEqual({ blue: 6 + 1 + 2, red: 9 });
  });
});

describe('both switches off: byte-identical to a plain plan', () => {
  it('a declaration changes nothing, the state carries no trap bookkeeping', () => {
    const s = scene({ 'blue-0': at(3, 6), 'blue-1': at(1, 3), 'red-4': at(5, 3), 'red-3': at(6, 6), ...FAR }, held('blue-0'), { trap: false, halves: false });
    const a = draws([0.0, 0.3, 0.6]);
    const b = draws([0.0, 0.3, 0.6]);
    const withTrap = resolveTurn(s, plans(sp(1, 3), { ...TRAP }), a.rng);
    const plain = resolveTurn(s, plans(sp(1, 3)), b.rng);
    expect(JSON.stringify(withTrap)).toBe(JSON.stringify(plain));
    expect(a.count()).toBe(b.count());
    expect(withTrap.after).not.toHaveProperty('trapReady');
    expect(ev(withTrap.events, 'halfTime')).toHaveLength(0);
  });
  it('halves off: turn 10 of 20 is an ordinary turn', () => {
    const s = scene({ 'blue-0': at(3, 6) }, held('blue-0'), { turn: 10, halves: false });
    const r = resolveTurn(s, plans(), fixedRng([0.5]));
    expect(ev(r.events, 'halfTime')).toHaveLength(0);
    expect(getPlayer(r.after, 'blue-0').pos).toEqual(at(3, 6));
  });
});

describe('halves', () => {
  it('config helpers', () => {
    const m = createMatch({ firstKickoff: 'red' });
    expect(halvesEnabled(m)).toBe(true);
    expect(trapEnabled(m)).toBe(true);
    expect(m.firstKickoff).toBe('red');
    expect(halfTurns(m)).toBe(10);
    expect(halfOf({ ...m, turn: 10 })).toBe(1);
    expect(halfOf({ ...m, turn: 11 })).toBe(2);
    expect(halfTurns({ maxTurns: 9 })).toBe(4);
    expect(createMatch({ halves: false, trap: false })).toMatchObject({ halves: false, trap: false });
    expect(halvesEnabled(createMatch({ halves: false }))).toBe(false);
  });

  it('half time without a goal: formation reset, flags cleared, score kept, other side kicks off', () => {
    const s = scene(
      { 'blue-0': at(3, 6), 'blue-1': at(2, 4), 'red-4': at(5, 3) },
      held('blue-0'),
      { turn: 10, halves: true, trap: true, trapReady: { blue: 1, red: 12 }, flags: { 'blue-1': { receivedPassTurn: 9, wonBallTurn: 8 } } },
    );
    const s2: MatchState = { ...s, score: { blue: 2, red: 1 }, kickoffTeam: 'blue', firstKickoff: 'blue' };
    const r = resolveTurn(s2, plans({ moves: { 'blue-1': at(2, 3) } }), fixedRng([0.5]));
    const last = r.events[r.events.length - 1];
    expect(last).toEqual({ type: 'halfTime', score: { blue: 2, red: 1 }, kickoffTeam: 'red' });
    expect(ev(r.events, 'kickoff')).toHaveLength(0);
    expect(ev(r.events, 'matchEnd')).toHaveLength(0);
    // afterAction is the position before the reset; after is the reset
    expect(getPlayer(r.afterAction, 'blue-1').pos).toEqual(at(2, 3));
    expect(getPlayer(r.after, 'blue-1').pos).toEqual(createMatch().players[1]?.pos);
    expect(getPlayer(r.after, 'blue-0').pos).toEqual(at(3, 6)); // kicking-off team's striker is at the formation cell for red
    expect(r.after.turn).toBe(11);
    expect(r.after.phase).toBe('planning');
    expect(r.after.score).toEqual({ blue: 2, red: 1 });
    expect(r.after.kickoffTeam).toBe('red');
    expect(ballHolder(r.after)?.id).toBe('red-0');
    expect(r.after.players.every((p) => Object.keys(p.flags).length === 0)).toBe(true);
    expect(r.after).not.toHaveProperty('trapReady');
    expect(r.afterAction.trapReady).toEqual({ blue: 1, red: 12 });
    expect(describeEvent(last as TurnEvent, r.after)).toContain('前半終了 2-1');
  });

  it('the second-half kickoff goes to the side that did not take the first one', () => {
    const mk = (firstKickoff: 'blue' | 'red') => {
      const s = scene({ 'blue-0': at(3, 6) }, held('blue-0'), { turn: 10, halves: true, firstKickoff });
      return resolveTurn(s, plans(), fixedRng([0.5]));
    };
    expect(mk('blue').after.kickoffTeam).toBe('red');
    expect(ballHolder(mk('blue').after)?.id).toBe('red-0');
    expect(mk('red').after.kickoffTeam).toBe('blue');
    expect(ballHolder(mk('red').after)?.id).toBe('blue-0');
    // kickoffTeam is the LAST kickoff, not the first: a goal-kickoff in the first half does not matter
    const s = scene({ 'blue-0': at(3, 6) }, held('blue-0'), { turn: 10, halves: true, firstKickoff: 'blue' });
    const after = resolveTurn({ ...s, kickoffTeam: 'red' }, plans(), fixedRng([0.5]));
    expect(after.after.kickoffTeam).toBe('red');
  });

  it('a goal on the last turn of the first half: goal then halfTime, no kickoff event', () => {
    const s = scene({ 'blue-0': at(3, 1) }, held('blue-0'), { turn: 10, halves: true });
    const r = resolveTurn(s, plans({ ballAction: { kind: 'shoot' } }), fixedRng([0.0]));
    const types = r.events.map((e) => e.type);
    expect(types.filter((t) => t === 'goal')).toHaveLength(1);
    expect(types.indexOf('goal')).toBeLessThan(types.indexOf('halfTime'));
    expect(types).not.toContain('kickoff');
    expect(types[types.length - 1]).toBe('halfTime');
    expect(ev(r.events, 'halfTime')[0]).toEqual({ type: 'halfTime', score: { blue: 1, red: 0 }, kickoffTeam: 'red' });
    expect(r.after.score).toEqual({ blue: 1, red: 0 });
    expect(r.afterAction.score).toEqual({ blue: 1, red: 0 });
    expect(getPlayer(r.afterAction, 'blue-0').pos).toEqual(at(3, 1)); // before the reset
    expect(ballHolder(r.after)?.id).toBe('red-0');
    expect(r.after.turn).toBe(11);
  });

  it('works for other lengths (maxTurns 9: half time after turn 4; maxTurns 2: after turn 1)', () => {
    const a = resolveTurn(scene({ 'blue-0': at(3, 6) }, held('blue-0'), { turn: 4, maxTurns: 9, halves: true }), plans(), fixedRng([0.5]));
    expect(ev(a.events, 'halfTime')).toHaveLength(1);
    const b = resolveTurn(scene({ 'blue-0': at(3, 6) }, held('blue-0'), { turn: 3, maxTurns: 9, halves: true }), plans(), fixedRng([0.5]));
    expect(ev(b.events, 'halfTime')).toHaveLength(0);
    const c = resolveTurn(scene({ 'blue-0': at(3, 6) }, held('blue-0'), { turn: 1, maxTurns: 2, halves: true }), plans(), fixedRng([0.5]));
    expect(ev(c.events, 'halfTime')).toHaveLength(1);
    const one = resolveTurn(scene({ 'blue-0': at(3, 6) }, held('blue-0'), { turn: 1, maxTurns: 1, halves: true }), plans(), fixedRng([0.5]));
    expect(ev(one.events, 'halfTime')).toHaveLength(0);
    expect(ev(one.events, 'matchEnd')).toHaveLength(1);
  });

  it('the match ends on the last turn: matchEnd, never a half-time event', () => {
    const s = scene({ 'blue-0': at(3, 6) }, held('blue-0'), { turn: 20, halves: true });
    const r = resolveTurn(s, plans(), fixedRng([0.5]));
    expect(ev(r.events, 'halfTime')).toHaveLength(0);
    expect(ev(r.events, 'matchEnd')).toHaveLength(1);
    expect(r.after.phase).toBe('finished');
    // and a goal on the last turn: goal, kickoff, matchEnd (v0.7 behaviour)
    const g = resolveTurn(scene({ 'blue-0': at(3, 1) }, held('blue-0'), { turn: 20, halves: true }), plans({ ballAction: { kind: 'shoot' } }), fixedRng([0.0]));
    expect(g.events.map((e) => e.type)).toEqual(expect.arrayContaining(['goal', 'kickoff', 'matchEnd']));
    expect(ev(g.events, 'halfTime')).toHaveLength(0);
  });

  it('a whole match plays both halves with a single half-time event', () => {
    let s = createMatch({ firstKickoff: 'blue' });
    let halfTimes = 0;
    let n = 0;
    const rng = fixedRng([0.5]);
    while (s.phase !== 'finished' && n++ < 100) {
      const r = resolveTurn(s, plans(), rng);
      halfTimes += ev(r.events, 'halfTime').length;
      if (s.turn === 10) expect(r.after.kickoffTeam).toBe('red');
      s = r.after;
    }
    expect(halfTimes).toBe(1);
    expect(s.turn).toBe(21);
  });
});

describe('describeEvent', () => {
  it('has lines for trap and halfTime', () => {
    const s = createMatch();
    expect(describeEvent({ type: 'trap', team: 'red', steps: [] }, s)).toBe('紅蓮がオフサイドトラップ！');
    expect(describeEvent({ type: 'halfTime', score: { blue: 1, red: 0 }, kickoffTeam: 'red' }, s)).toContain('前半終了 1-0');
  });
});
