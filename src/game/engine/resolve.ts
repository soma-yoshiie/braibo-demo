/**
 * Turn resolution. RNG consumption order (one rng.next() per roll):
 *  1. movement: one roll per ground duel, in conflict order (cells sorted by y then x,
 *     one conflict cell processed at a time, re-scanning afterwards); then swap duels
 *     (blue-index order).
 *  2. ball action (passes/crosses/shots) see resolveBallAction.
 *     pass : interceptors by t (one roll each, stop on success) -> accuracy -> [loose pick]
 *     spacePass: interceptors on the lane by t (one roll each, stop on success; target cell excluded)
 *                -> accuracy (passAccuracy - spacePenalty) -> [loose pick on failure only].
 *                A successful roll consumes no further rng (teammate/enemy/empty cell).
 *     cross: delivery -> [loose pick] -> aerial (if defender) -> header (if in range)
 *     shoot: blockers by distance (one roll each) -> goal
 */
import type {
  BallState,
  MatchState,
  PlayerFlags,
  PlayerId,
  PlayerState,
  Rng,
  TeamId,
  TurnEvent,
  TurnPlans,
  TurnResult,
  Vec,
} from '../types';
import { BOARD, RULES, goalTarget, otherTeam } from '../rules/config';
import { getCharacter } from '../data/characters';
import { cellsOnSegment, dist, inBounds, neighbors8, vecEq } from '../rules/geometry';
import { getEffectiveStats, isLegalMove } from '../rules/moves';
import {
  aerialWinProbability,
  blockProbability,
  crossDelivery,
  duelWinProbability,
  headerGoalProbability,
  interceptProbability,
  passAccuracy,
  shotGoalProbability,
} from '../rules/probability';
import { aerialDefender, estimatePass, estimateSpacePass, isCrossValid } from '../rules/estimates';
import { kickoffState } from './match';

type Positions = Record<PlayerId, Vec>;
type FlagMap = Record<PlayerId, PlayerFlags>;

const key = (v: Vec) => `${v.x},${v.y}`;
const copy = (v: Vec): Vec => ({ x: v.x, y: v.y });

function player(state: MatchState, id: PlayerId): PlayerState {
  const p = state.players.find((q) => q.id === id);
  if (!p) throw new Error(`Unknown player: ${id}`);
  return p;
}

export interface MovementResult {
  positions: Positions;
  ball: BallState;
  flags: FlagMap;
  events: TurnEvent[];
}

/** Steps 1-3: normalise, resolve conflicts/duels/swaps, loose-ball pickup. */
export function resolveMovement(state: MatchState, plans: TurnPlans, rng: Rng): MovementResult {
  const events: TurnEvent[] = [];
  const origin: Positions = {};
  const dest: Positions = {};
  const flags: FlagMap = {};
  for (const p of state.players) {
    origin[p.id] = copy(p.pos);
    const planned = plans[p.team].moves[p.id];
    dest[p.id] = planned && isLegalMove(state, p.id, planned) ? copy(planned) : copy(p.pos);
    flags[p.id] = { ...p.flags };
  }
  // Destinations as planned (after legality normalisation); used by the swap check.
  const planned: Positions = {};
  for (const id of Object.keys(dest)) planned[id] = copy(dest[id] as Vec);
  /** Players that took part in a cell duel; they never get a swap duel as well. */
  const dueled = new Set<PlayerId>();
  let holder: PlayerId | undefined = state.ball.kind === 'held' ? state.ball.playerId : undefined;
  const stays = (id: PlayerId) => vecEq(dest[id] as Vec, origin[id] as Vec);

  const physical = (id: PlayerId) => getEffectiveStats(state, player(state, id)).physical;
  /** P(A wins) with the carrier bonus applied to whichever side holds the ball. */
  const pAWins = (a: PlayerId, b: PlayerId): number => {
    if (holder === a) return duelWinProbability(physical(a), physical(b), { carrierIsA: true });
    if (holder === b) return 1 - duelWinProbability(physical(b), physical(a), { carrierIsA: true });
    return duelWinProbability(physical(a), physical(b));
  };
  const award = (winner: PlayerId, loser: PlayerId) => {
    if (holder === loser) {
      holder = winner;
      (flags[winner] as PlayerFlags).wonBallTurn = state.turn;
    }
  };
  const displaced = new Set<PlayerId>();
  const displace = (id: PlayerId) => {
    const p = player(state, id);
    const claimed = new Set<string>();
    for (const q of state.players) if (q.id !== id) claimed.add(key(dest[q.id] as Vec));
    const o = origin[id] as Vec;
    const own = goalTarget(otherTeam(p.team));
    let best: Vec | undefined;
    for (let y = 0; y < BOARD.rows; y++) {
      for (let x = 0; x < BOARD.cols; x++) {
        const c = { x, y };
        if (claimed.has(key(c))) continue;
        if (!best) best = c;
        else {
          const dc = dist(c, o) - dist(best, o);
          const oc = dist(c, own) - dist(best, own);
          if (dc < -1e-9 || (Math.abs(dc) <= 1e-9 && (oc < -1e-9 || (Math.abs(oc) <= 1e-9 && c.x < best.x)))) best = c;
        }
      }
    }
    const to = best ?? o;
    events.push({ type: 'displace', playerId: id, from: copy(o), to: copy(to) });
    dest[id] = copy(to);
    displaced.add(id);
  };
  const bounce = (id: PlayerId, reason: 'teammate' | 'duel') => {
    events.push({ type: 'bounce', playerId: id, from: copy(dest[id] as Vec), to: copy(origin[id] as Vec), reason });
    dest[id] = copy(origin[id] as Vec);
  };

  // ---- iterative conflict resolution -------------------------------------
  for (let iter = 0; ; iter++) {
    const groups = new Map<string, PlayerId[]>();
    for (const p of state.players) {
      const k = key(dest[p.id] as Vec);
      groups.set(k, [...(groups.get(k) ?? []), p.id]);
    }
    const conflicts = [...groups.values()].filter((g) => g.length >= 2);
    if (conflicts.length === 0) break;
    if (iter > 500) {
      // Safety net (should be unreachable): everyone involved stays put.
      for (const g of conflicts) for (const id of g) dest[id] = copy(origin[id] as Vec);
      continue;
    }
    conflicts.sort((a, b) => {
      const pa = dest[a[0] as PlayerId] as Vec;
      const pb = dest[b[0] as PlayerId] as Vec;
      return pa.y - pb.y || pa.x - pb.x;
    });
    const group = conflicts[0] as PlayerId[];
    const cell = copy(dest[group[0] as PlayerId] as Vec);
    const reps: Partial<Record<TeamId, PlayerId>> = {};
    for (const team of ['blue', 'red'] as TeamId[]) {
      const mates = group
        .filter((id) => player(state, id).team === team)
        .sort((a, b) => {
          const rank = (id: PlayerId) => (id === holder ? 0 : stays(id) ? 1 : 2);
          return rank(a) - rank(b) || player(state, a).index - player(state, b).index;
        });
      if (mates.length === 0) continue;
      reps[team] = mates[0];
      for (const loser of mates.slice(1)) {
        if (stays(loser)) displace(loser);
        else bounce(loser, 'teammate');
      }
    }
    const blue = reps.blue;
    const red = reps.red;
    if (!blue || !red) continue;
    // A is the mover; if exactly one stays, it is B. Both moving: A = blue.
    const [a, b] = stays(blue) && !stays(red) ? [red, blue] : [blue, red];
    const p = pAWins(a, b);
    const aWins = rng.next() < p;
    const [winner, loser] = aWins ? [a, b] : [b, a];
    events.push({
      type: 'duel',
      kind: 'ground',
      pos: cell,
      aId: a,
      bId: b,
      winnerId: winner,
      forBall: holder === a || holder === b,
      pAWins: p,
    });
    dueled.add(a);
    dueled.add(b);
    award(winner, loser);
    if (stays(loser)) displace(loser);
    else bounce(loser, 'duel');
  }

  // ---- swap check ----------------------------------------------------------
  for (const pa of state.players) {
    if (pa.team !== 'blue') continue;
    for (const pb of state.players) {
      if (pb.team !== 'red') continue;
      const completed = (id: PlayerId) =>
        !displaced.has(id) && !dueled.has(id) && vecEq(dest[id] as Vec, planned[id] as Vec);
      const swapped =
        completed(pa.id) &&
        completed(pb.id) &&
        !stays(pa.id) &&
        vecEq(dest[pa.id] as Vec, origin[pb.id] as Vec) &&
        vecEq(dest[pb.id] as Vec, origin[pa.id] as Vec);
      if (!swapped || (holder !== pa.id && holder !== pb.id)) continue;
      const p = pAWins(pa.id, pb.id);
      const aWins = rng.next() < p;
      const [winner, loser] = aWins ? [pa.id, pb.id] : [pb.id, pa.id];
      events.push({
        type: 'duel',
        kind: 'ground',
        pos: copy(dest[holder as PlayerId] as Vec),
        aId: pa.id,
        bId: pb.id,
        winnerId: winner,
        forBall: true,
        pAWins: p,
      });
      award(winner, loser);
    }
  }

  for (const p of state.players) {
    if (displaced.has(p.id)) continue;
    const o = origin[p.id] as Vec;
    const d = dest[p.id] as Vec;
    if (!vecEq(o, d)) events.push({ type: 'move', playerId: p.id, from: copy(o), to: copy(d) });
  }

  // ---- loose ball pickup -----------------------------------------------------
  let ball: BallState = holder ? { kind: 'held', playerId: holder } : state.ball;
  if (ball.kind === 'loose') {
    const pos = ball.pos;
    const picker = state.players.find((p) => vecEq(dest[p.id] as Vec, pos));
    if (picker) {
      ball = { kind: 'held', playerId: picker.id };
      events.push({ type: 'pickup', playerId: picker.id, pos: copy(pos) });
    }
  }
  return { positions: dest, ball, flags, events };
}

export interface BallActionResult {
  ball: BallState;
  flags: FlagMap;
  events: TurnEvent[];
  goal?: { team: TeamId; scorerId: PlayerId };
}

/** Step 4: pass / cross / shoot, evaluated on final positions. */
export function resolveBallAction(
  state: MatchState,
  moved: { positions: Positions; ball: BallState; flags: FlagMap },
  plans: TurnPlans,
  rng: Rng,
): BallActionResult {
  const events: TurnEvent[] = [];
  const flags: FlagMap = {};
  for (const id of Object.keys(moved.flags)) flags[id] = { ...(moved.flags[id] as PlayerFlags) };
  let ball = moved.ball;
  const res = (): BallActionResult => ({ ball, flags, events });

  if (state.ball.kind !== 'held' || moved.ball.kind !== 'held') return res();
  const passerId = state.ball.playerId;
  if (moved.ball.playerId !== passerId) return res();
  const passer = player(state, passerId);
  const action = plans[passer.team].ballAction;
  if (!action || action.kind === 'keep') return res();

  const pos = moved.positions;
  const at = (id: PlayerId) => pos[id] as Vec;
  const from = at(passerId);
  const enemies = state.players.filter((p) => p.team !== passer.team);
  const skills = getCharacter(passer.charId).skills;
  const give = (id: PlayerId, won: boolean) => {
    ball = { kind: 'held', playerId: id };
    if (won) (flags[id] as PlayerFlags).wonBallTurn = state.turn;
  };

  /** Failed delivery: loose ball next to the target, or gifted to the nearest enemy. */
  const scatter = (targetPos: Vec): { loosePos?: Vec } => {
    const occupied = new Set(state.players.map((p) => key(at(p.id))));
    const cands = neighbors8(targetPos).filter((c) => !occupied.has(key(c)));
    if (cands.length > 0) {
      const loosePos = cands[Math.floor(rng.next() * cands.length)] as Vec;
      ball = { kind: 'loose', pos: copy(loosePos) };
      return { loosePos };
    }
    const nearest = [...enemies].sort(
      (a, b) => dist(at(a.id), targetPos) - dist(at(b.id), targetPos) || a.index - b.index,
    )[0] as PlayerState;
    give(nearest.id, false);
    events.push({ type: 'pickup', playerId: nearest.id, pos: copy(at(nearest.id)) });
    return {};
  };

  const goalKick = (team: TeamId) => {
    const defTeam = otherTeam(team);
    const gt = goalTarget(team);
    const gk = state.players
      .filter((p) => p.team === defTeam)
      .sort((a, b) => dist(at(a.id), gt) - dist(at(b.id), gt) || a.index - b.index)[0] as PlayerState;
    give(gk.id, false);
    events.push({ type: 'goalKick', team: defTeam, playerId: gk.id });
  };
  const scored = (): BallActionResult => {
    events.push({ type: 'goal', team: passer.team, scorerId: passerId });
    return { ball, flags, events, goal: { team: passer.team, scorerId: passerId } };
  };

  const doPass = (targetId: PlayerId, kind: 'pass' | 'cross'): void => {
    const targetPos = at(targetId);
    const est = estimatePass(state, passerId, targetId, from, targetPos, Object.fromEntries(enemies.map((e) => [e.id, at(e.id)])));
    if (!est.inRange) {
      events.push({ type: 'actionCancelled', playerId: passerId, action: kind, reason: 'outOfRange' });
      return;
    }
    const lane = cellsOnSegment(from, targetPos, RULES.pass.laneWidth);
    for (const { cell, offset } of lane) {
      const e = enemies.find((p) => vecEq(at(p.id), cell));
      if (!e) continue;
      const pI = interceptProbability(getEffectiveStats(state, e).intercept, offset);
      if (rng.next() < pI) {
        give(e.id, true);
        events.push({
          type: 'pass', passerId, targetId, from: copy(from), to: copy(targetPos),
          outcome: 'intercepted', interceptorId: e.id, pSuccess: est.pComplete,
        });
        return;
      }
    }
    const pA = passAccuracy(est.distance, getEffectiveStats(state, passer).pass, skills);
    if (rng.next() < pA) {
      give(targetId, false);
      (flags[targetId] as PlayerFlags).receivedPassTurn = state.turn;
      events.push({
        type: 'pass', passerId, targetId, from: copy(from), to: copy(targetPos),
        outcome: 'complete', receiverId: targetId, pSuccess: est.pComplete,
      });
      return;
    }
    // Event is pushed before the scatter's own pickup event (if any).
    const idx = events.length;
    const { loosePos } = scatter(targetPos);
    events.splice(idx, 0, {
      type: 'pass', passerId, targetId, from: copy(from), to: copy(targetPos),
      outcome: 'failed', loosePos, pSuccess: est.pComplete,
    });
  };

  const headerOrShot = (shooterId: PlayerId, shooterPos: Vec, kind: 'header' | 'shot', pGoal: number): BallActionResult => {
    const target = goalTarget(passer.team);
    const goal = rng.next() < pGoal;
    events.push({
      type: 'shot', shooterId, kind, from: copy(shooterPos), target, outcome: goal ? 'goal' : 'missed', pGoal,
    });
    if (goal) return scored();
    goalKick(passer.team);
    return res();
  };

  if (action.kind === 'shoot') {
    const target = goalTarget(passer.team);
    const distance = dist(from, target);
    const lane = cellsOnSegment(from, target, RULES.shot.laneWidth);
    const blockers = lane
      .map(({ cell, offset }) => ({ e: enemies.find((p) => vecEq(at(p.id), cell)), offset }))
      .filter((b): b is { e: PlayerState; offset: number } => b.e !== undefined)
      .sort((a, b) => dist(from, at(a.e.id)) - dist(from, at(b.e.id)));
    const angleSin = distance === 0 ? 0 : Math.abs(from.x - target.x) / distance;
    const pGoal = shotGoalProbability(distance, angleSin, getEffectiveStats(state, passer), skills, {
      oneTouchActive: passer.flags.receivedPassTurn === state.turn - 1,
    });
    for (const { e, offset } of blockers) {
      const pB = blockProbability(
        dist(from, at(e.id)), offset, getEffectiveStats(state, e).block, getCharacter(e.charId).skills,
      );
      if (rng.next() < pB) {
        give(e.id, true);
        events.push({
          type: 'shot', shooterId: passerId, kind: 'shot', from: copy(from), target,
          outcome: 'blocked', blockerId: e.id, pGoal,
        });
        return res();
      }
    }
    return headerOrShot(passerId, from, 'shot', pGoal);
  }

  if (action.kind === 'spacePass') {
    const tgt = action.target;
    if (!tgt || !inBounds(tgt) || vecEq(tgt, from)) {
      events.push({ type: 'actionCancelled', playerId: passerId, action: 'pass', reason: 'invalidTarget' });
      return res();
    }
    const est = estimateSpacePass(state, passerId, tgt, from, Object.fromEntries(enemies.map((e) => [e.id, at(e.id)])));
    if (!est.inRange) {
      events.push({ type: 'actionCancelled', playerId: passerId, action: 'pass', reason: 'outOfRange' });
      return res();
    }
    const base = { type: 'pass' as const, passerId, space: true, from: copy(from), to: copy(tgt), pSuccess: est.pComplete };
    for (const { cell, offset } of cellsOnSegment(from, tgt, RULES.pass.laneWidth)) {
      const e = enemies.find((p) => vecEq(at(p.id), cell));
      if (!e) continue;
      if (rng.next() < interceptProbability(getEffectiveStats(state, e).intercept, offset)) {
        give(e.id, true);
        events.push({ ...base, outcome: 'intercepted', interceptorId: e.id });
        return res();
      }
    }
    if (rng.next() < est.pAccurate) {
      const occ = state.players.find((p) => vecEq(at(p.id), tgt));
      if (!occ) {
        ball = { kind: 'loose', pos: copy(tgt) };
        events.push({ ...base, outcome: 'loose', loosePos: copy(tgt) });
      } else if (occ.team === passer.team) {
        give(occ.id, false);
        (flags[occ.id] as PlayerFlags).receivedPassTurn = state.turn;
        events.push({ ...base, outcome: 'complete', receiverId: occ.id });
      } else {
        give(occ.id, true);
        events.push({ ...base, outcome: 'toEnemy', receiverId: occ.id });
      }
      return res();
    }
    const idx = events.length;
    const { loosePos } = scatter(tgt);
    events.splice(idx, 0, { ...base, outcome: 'failed', loosePos });
    return res();
  }

  const targetId = action.targetId;
  const target = state.players.find((p) => p.id === targetId);
  if (!target || target.team !== passer.team || target.id === passerId) {
    events.push({ type: 'actionCancelled', playerId: passerId, action: action.kind, reason: 'invalidTarget' });
    return res();
  }
  const targetPos = at(targetId);

  if (action.kind === 'pass' || !isCrossValid(passer.team, from, targetPos)) {
    doPass(targetId, action.kind);
    return res();
  }

  // ---- cross ----------------------------------------------------------------
  const distance = dist(from, targetPos);
  const pDelivery = crossDelivery(distance, getEffectiveStats(state, passer).cross);
  if (rng.next() >= pDelivery) {
    const idx = events.length;
    const { loosePos } = scatter(targetPos);
    events.splice(idx, 0, {
      type: 'cross', passerId, targetId, from: copy(from), to: copy(targetPos),
      outcome: 'failed', loosePos, pDelivery,
    });
    return res();
  }
  const defs: Positions = Object.fromEntries(enemies.map((e) => [e.id, at(e.id)]));
  const defender = aerialDefender(state, passer.team, targetPos, defs);
  const crossEv = (outcome: 'won' | 'lost' | 'uncontested') =>
    ({
      type: 'cross', passerId, targetId, from: copy(from), to: copy(targetPos), outcome,
      defenderId: defender?.id, pDelivery,
    }) as TurnEvent;
  if (defender) {
    const pWin = aerialWinProbability(
      getEffectiveStats(state, target).aerial, getEffectiveStats(state, defender).aerial,
      getCharacter(target.charId).skills, getCharacter(defender.charId).skills,
    );
    const win = rng.next() < pWin;
    events.push({
      type: 'duel', kind: 'aerial', pos: copy(targetPos), aId: targetId, bId: defender.id,
      winnerId: win ? targetId : defender.id, forBall: true, pAWins: pWin,
    });
    events.push(crossEv(win ? 'won' : 'lost'));
    if (!win) {
      give(defender.id, true);
      return res();
    }
  } else {
    events.push(crossEv('uncontested'));
  }
  give(targetId, false);
  (flags[targetId] as PlayerFlags).receivedPassTurn = state.turn;
  const gd = dist(targetPos, goalTarget(passer.team));
  if (gd <= RULES.cross.header.maxDistance) {
    const pH = headerGoalProbability(gd, getEffectiveStats(state, target).aerial);
    // Header: the receiver is the scorer.
    const goal = rng.next() < pH;
    events.push({
      type: 'shot', shooterId: targetId, kind: 'header', from: copy(targetPos),
      target: goalTarget(passer.team), outcome: goal ? 'goal' : 'missed', pGoal: pH,
    });
    if (goal) {
      events.push({ type: 'goal', team: passer.team, scorerId: targetId });
      return { ball, flags, events, goal: { team: passer.team, scorerId: targetId } };
    }
    goalKick(passer.team);
  }
  return res();
}

export function resolveTurn(state: MatchState, plans: TurnPlans, rng: Rng): TurnResult {
  const moved = resolveMovement(state, plans, rng);
  const action = resolveBallAction(state, moved, plans, rng);
  const events = [...moved.events, ...action.events];

  const score = { ...state.score };
  if (action.goal) score[action.goal.team] += 1;
  const afterAction: MatchState = {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      pos: copy(moved.positions[p.id] as Vec),
      flags: { ...(action.flags[p.id] ?? {}) },
    })),
    ball: action.ball,
    score,
  };

  let next: MatchState = afterAction;
  if (action.goal) {
    const conceding = otherTeam(action.goal.team);
    next = kickoffState(afterAction, conceding);
    events.push({ type: 'kickoff', team: conceding });
  }
  next = { ...next, turn: state.turn + 1 };
  if (next.turn > next.maxTurns) {
    next = { ...next, phase: 'finished' };
    const winner = score.blue === score.red ? 'draw' : score.blue > score.red ? 'blue' : 'red';
    events.push({ type: 'matchEnd', winner, score: { ...score } });
  }
  return { before: state, afterAction, after: next, events };
}
