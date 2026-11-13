/**
 * Turn resolution. RNG consumption order (one rng.next() per roll):
 *  1. movement: same-team overlaps use no rng. Then at most ONE ball duel with exactly one draw
 *     (carrier cell > swap > contested loose ball, first match only).
 *  2. ball action (passes/crosses/shots) see resolveBallAction.
 *     OFFSIDE (RULES.offside.enabled) is judged first for pass / spacePass (teammate standing on the
 *     target cell, if any) / valid cross, on final positions; it consumes NO rng (ball goes to the
 *     defender nearest the receiver, tie -> lower index) and emits only an `offside` event.
 *     pass : interceptors by t (one roll each, stop on success; ground = all on lane, lofted = only
 *            those within endZoneRadius of passer [intercept] or target [aerial]) -> accuracy (per style)
 *            -> [loose pick]
 *     spacePass: interceptors as for pass (target cell excluded) by t -> accuracy (passAccuracy -
 *                spacePenalty) -> [loose pick on failure only].
 *                A successful roll consumes no further rng (teammate/enemy/empty cell).
 *     cross: delivery -> [loose pick] -> aerial (if defender) -> header (if in range)
 *     shoot: blockers by distance (one roll each) -> goal
 */
import type {
  BallState,
  MatchState,
  PlayerFlags,
  PlayerId,
  PassStyle,
  PlayerState,
  Rng,
  TeamId,
  TurnEvent,
  TurnPlans,
  TurnResult,
  Vec,
} from '../types';
import { BOARD, MATCH, RULES, goalTarget, halfTurns, halvesEnabled, otherTeam, throughPassMode } from '../rules/config';
import { getCharacter } from '../data/characters';
import { cellsOnSegment, dist, inBounds, neighbors8, vecEq } from '../rules/geometry';
import { getEffectiveStats, isLegalMove } from '../rules/moves';
import {
  aerialWinProbability,
  blockProbability,
  crossDelivery,
  duelWinProbability,
  headerGoalProbability,
  keeperSaveProbability,
  interceptProbability,
  passAccuracy,
  shotGoalProbability,
} from '../rules/probability';
import {
  aerialDefender,
  estimatePass,
  estimateSpacePass,
  estimateThroughPass,
  isCrossValid,
  laneInterceptors,
} from '../rules/estimates';
import { isOffsidePosition } from '../rules/offside';
import { keeperStats } from '../rules/keeper';
import { canDeclareTrap, trapSteps } from '../rules/trap';
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

/**
 * v0.5 early through pass (DESIGN.md §5): in 'early' mode a held-ball spacePass is kicked BEFORE movement.
 * Returns undefined when this turn has no such action. `cancelled` is set when the target is unusable
 * (the turn then plays as a normal keep turn).
 */
interface EarlyKick {
  passerId: PlayerId;
  target: Vec;
  style: PassStyle;
  cancelled?: 'invalidTarget' | 'outOfRange';
}
function earlyKick(state: MatchState, plans: TurnPlans): EarlyKick | undefined {
  if (throughPassMode(state) !== 'early' || state.ball.kind !== 'held') return undefined;
  const passer = player(state, state.ball.playerId);
  const action = plans[passer.team].ballAction;
  if (!action || action.kind !== 'spacePass') return undefined;
  const style = action.style ?? 'ground';
  const base = { passerId: passer.id, target: action.target, style };
  const tgt = action.target;
  if (!tgt || !inBounds(tgt) || vecEq(tgt, passer.pos)) return { ...base, cancelled: 'invalidTarget' };
  if (!estimateThroughPass(state, passer.id, tgt, style).inRange) return { ...base, cancelled: 'outOfRange' };
  return base;
}

export interface MovementResult {
  positions: Positions;
  ball: BallState;
  flags: FlagMap;
  events: TurnEvent[];
}

/**
 * Steps 1-3 (v0.4): normalise, resolve same-team overlaps (no rng), at most one ball duel
 * (exactly one rng draw), loose-ball pickup. Event order: (bounce|displace)* duel? move* pickup?
 */
export function resolveMovement(state: MatchState, plans: TurnPlans, rng: Rng): MovementResult {
  const events: TurnEvent[] = [];
  const origin: Positions = {};
  const dest: Positions = {};
  const flags: FlagMap = {};
  const early = earlyKick(state, plans);
  // Early through pass in flight: the kicker does not move and nobody holds the ball (no ball duel).
  const inFlight = early && !early.cancelled ? early.passerId : undefined;
  for (const p of state.players) {
    origin[p.id] = copy(p.pos);
    const planned = plans[p.team].moves[p.id];
    dest[p.id] = p.id !== inFlight && planned && isLegalMove(state, p.id, planned) ? copy(planned) : copy(p.pos);
    flags[p.id] = { ...p.flags };
  }
  // Destinations as planned (after legality normalisation); used by the swap check.
  const planned: Positions = {};
  for (const id of Object.keys(dest)) planned[id] = copy(dest[id] as Vec);
  let holder: PlayerId | undefined = state.ball.kind === 'held' && !inFlight ? state.ball.playerId : undefined;
  const stays = (id: PlayerId) => vecEq(dest[id] as Vec, origin[id] as Vec);

  const physical = (id: PlayerId) => getEffectiveStats(state, player(state, id)).physical;
  const displaced = new Set<PlayerId>();
  const displace = (id: PlayerId) => {
    const p = player(state, id);
    // A displaced player needs a cell no one started on, planned to enter, or currently resolves to
    // (both teams), so a later bounce can never land on it.
    const claimed = new Set<string>();
    for (const q of state.players) {
      claimed.add(key(origin[q.id] as Vec));
      claimed.add(key(planned[q.id] as Vec));
      claimed.add(key(dest[q.id] as Vec));
    }
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
  const bounce = (id: PlayerId) => {
    events.push({ type: 'bounce', playerId: id, from: copy(dest[id] as Vec), to: copy(origin[id] as Vec), reason: 'teammate' });
    dest[id] = copy(origin[id] as Vec);
  };

  // ---- 4.1 same-team overlaps (opponents are ignored) ----------------------
  for (let iter = 0; ; iter++) {
    const groups = new Map<string, PlayerId[]>();
    for (const p of state.players) {
      const k = `${p.team}:${key(dest[p.id] as Vec)}`;
      groups.set(k, [...(groups.get(k) ?? []), p.id]);
    }
    const conflicts = [...groups.values()].filter((g) => g.length >= 2);
    if (conflicts.length === 0) break;
    if (iter > 500) {
      // Safety net (should be unreachable): everyone involved stays put.
      for (const g of conflicts) for (const id of g) dest[id] = copy(origin[id] as Vec);
      continue;
    }
    // Ascending (y, x, blue before red).
    conflicts.sort((a, b) => {
      const pa = dest[a[0] as PlayerId] as Vec;
      const pb = dest[b[0] as PlayerId] as Vec;
      const ta = player(state, a[0] as PlayerId).team === 'blue' ? 0 : 1;
      const tb = player(state, b[0] as PlayerId).team === 'blue' ? 0 : 1;
      return pa.y - pb.y || pa.x - pb.x || ta - tb;
    });
    const mates = (conflicts[0] as PlayerId[]).sort((a, b) => {
      const rank = (id: PlayerId) => (id === holder ? 0 : stays(id) ? 1 : 2);
      return rank(a) - rank(b) || player(state, a).index - player(state, b).index;
    });
    for (const loser of mates.slice(1)) {
      if (stays(loser)) displace(loser);
      else bounce(loser);
    }
  }

  // ---- 4.2 ball duel: at most one, exactly one rng draw ----------------------
  const settled = (id: PlayerId) => !displaced.has(id) && vecEq(dest[id] as Vec, planned[id] as Vec);
  let pair: { a: PlayerId; b: PlayerId; pos: Vec; loose: boolean } | undefined;
  if (holder) {
    const h = player(state, holder);
    const hd = dest[holder] as Vec;
    const foe = state.players.find((q) => q.team !== h.team && vecEq(dest[q.id] as Vec, hd));
    const swapFoe = state.players.find(
      (q) =>
        q.team !== h.team &&
        !stays(holder as PlayerId) &&
        !stays(q.id) &&
        settled(holder as PlayerId) &&
        settled(q.id) &&
        vecEq(dest[holder as PlayerId] as Vec, origin[q.id] as Vec) &&
        vecEq(dest[q.id] as Vec, origin[holder as PlayerId] as Vec),
    );
    const other = foe ?? swapFoe;
    if (other) pair = { a: holder, b: other.id, pos: copy(hd), loose: false };
  } else if (state.ball.kind === 'loose') {
    const pos = state.ball.pos;
    const here = state.players.filter((q) => vecEq(dest[q.id] as Vec, pos));
    const blue = here.find((q) => q.team === 'blue');
    const red = here.find((q) => q.team === 'red');
    if (blue && red) pair = { a: blue.id, b: red.id, pos: copy(pos), loose: true };
  }
  let looseWinner: PlayerId | undefined;
  if (pair) {
    // A = the mover; if exactly one stays, it is B; both moved / both stayed: A = blue.
    let { a, b } = pair;
    const sa = stays(a);
    const sb = stays(b);
    const isBlue = (id: PlayerId) => player(state, id).team === 'blue';
    if (sa === sb ? !isBlue(a) : sa) [a, b] = [b, a];
    let p: number;
    if (pair.loose) p = duelWinProbability(physical(a), physical(b));
    else if (holder === a) p = duelWinProbability(physical(a), physical(b), { carrierIsA: true });
    else p = 1 - duelWinProbability(physical(b), physical(a), { carrierIsA: true });
    const winner = rng.next() < p ? a : b;
    events.push({
      type: 'duel', kind: 'ground', pos: pair.pos, aId: a, bId: b, winnerId: winner,
      forBall: true, ...(pair.loose ? { loose: true } : {}), pAWins: p,
    });
    if (pair.loose) {
      looseWinner = winner;
      holder = winner;
      (flags[winner] as PlayerFlags).wonBallTurn = state.turn;
    } else if (holder !== winner) {
      holder = winner;
      (flags[winner] as PlayerFlags).wonBallTurn = state.turn;
    }
  }

  for (const p of state.players) {
    const o = origin[p.id] as Vec;
    const d = dest[p.id] as Vec;
    if (!displaced.has(p.id) && !vecEq(o, d)) events.push({ type: 'move', playerId: p.id, from: copy(o), to: copy(d) });
  }

  // ---- loose ball pickup -------------------------------------------------------
  let ball: BallState = holder ? { kind: 'held', playerId: holder } : state.ball; // in flight: still marked as the kicker's
  if (ball.kind === 'loose') {
    const pos = ball.pos;
    const picker = state.players.find((p) => vecEq(dest[p.id] as Vec, pos));
    if (picker) {
      ball = { kind: 'held', playerId: picker.id };
      events.push({ type: 'pickup', playerId: picker.id, pos: copy(pos) });
    }
  } else if (looseWinner) {
    events.push({ type: 'pickup', playerId: looseWinner, pos: copy(dest[looseWinner] as Vec) });
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
  /** v0.8: cells the trap participants stood on BEFORE their step (only those that stepped), for `byTrap`. */
  trapBack: Record<PlayerId, Vec> = {},
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
  const early = earlyKick(state, plans);
  if (early?.cancelled) {
    // Same as legacy: reported after the movement events, and only if the kicker still holds the ball.
    events.push({ type: 'actionCancelled', playerId: passerId, action: 'pass', reason: early.cancelled });
    return res();
  }

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

  /** v0.8: would the receiver be onside if the trap participants had stayed one step back? */
  const trapMadeIt = (receiverPos: Vec, kickPos: Vec, defPos: (e: PlayerState) => Vec): boolean =>
    Object.keys(trapBack).length > 0 &&
    !isOffsidePosition(passer.team, receiverPos, kickPos, enemies.map((e) => trapBack[e.id] ?? defPos(e)));

  const defMap = (): Positions => Object.fromEntries(enemies.map((e) => [e.id, at(e.id)]));

  /** Offside check on final positions; on offside awards the ball and emits the event. */
  const callOffside = (receiverId: PlayerId, to: Vec, style: PassStyle): boolean => {
    if (!isOffsidePosition(passer.team, at(receiverId), from, enemies.map((e) => at(e.id)))) return false;
    const nearest = [...enemies].sort(
      (a, b) => dist(at(a.id), at(receiverId)) - dist(at(b.id), at(receiverId)) || a.index - b.index,
    )[0] as PlayerState;
    give(nearest.id, false); // free-kick award: not a ball win (no wonBallTurn / counter)
    events.push({
      type: 'offside', team: passer.team, passerId, receiverId, toPlayerId: nearest.id,
      from: copy(from), to: copy(to), style,
      ...(trapMadeIt(at(receiverId), from, (e) => at(e.id)) ? { byTrap: true as const } : {}),
    });
    return true;
  };

  /** Interception rolls in lane order; returns the interceptor if one succeeds. */
  const rollInterceptors = (to: Vec, style: PassStyle): PlayerId | undefined => {
    for (const i of laneInterceptors(state, defMap(), from, to, style)) {
      if (rng.next() < i.pIntercept) return i.playerId;
    }
    return undefined;
  };

  const doPass = (targetId: PlayerId, kind: 'pass' | 'cross', style: PassStyle): void => {
    const targetPos = at(targetId);
    const est = estimatePass(state, passerId, targetId, from, targetPos, defMap(), style);
    if (!est.inRange) {
      events.push({ type: 'actionCancelled', playerId: passerId, action: kind, reason: 'outOfRange' });
      return;
    }
    if (callOffside(targetId, targetPos, style)) return;
    const interceptorId = rollInterceptors(targetPos, style);
    if (interceptorId) {
      give(interceptorId, true);
      events.push({
        type: 'pass', passerId, targetId, style, from: copy(from), to: copy(targetPos),
        outcome: 'intercepted', interceptorId, pSuccess: est.pComplete,
      });
      return;
    }
    const pA = passAccuracy(est.distance, getEffectiveStats(state, passer).pass, skills, style);
    if (rng.next() < pA) {
      give(targetId, false);
      (flags[targetId] as PlayerFlags).receivedPassTurn = state.turn;
      events.push({
        type: 'pass', passerId, targetId, style, from: copy(from), to: copy(targetPos),
        outcome: 'complete', receiverId: targetId, pSuccess: est.pComplete,
      });
      return;
    }
    // Event is pushed before the scatter's own pickup event (if any).
    const idx = events.length;
    const { loosePos } = scatter(targetPos);
    events.splice(idx, 0, {
      type: 'pass', passerId, targetId, style, from: copy(from), to: copy(targetPos),
      outcome: 'failed', loosePos, pSuccess: est.pComplete,
    });
  };

  /** v0.9: one rng draw decides goal (r < p(1-s)) / save (r < p) / off target; no keeper = s is 0 = v0.8. */
  const keeperOf = keeperStats(state, otherTeam(passer.team));
  const headerOrShot = (shooterId: PlayerId, shooterPos: Vec, kind: 'header' | 'shot', pShot: number): BallActionResult => {
    const target = goalTarget(passer.team);
    const pSave = keeperOf ? keeperSaveProbability(kind, dist(shooterPos, target), keeperOf) : 0;
    const r = rng.next();
    const goal = r < pShot * (1 - pSave);
    const saved = !goal && r < pShot;
    events.push({
      type: 'shot', shooterId, kind, from: copy(shooterPos), target, outcome: goal ? 'goal' : saved ? 'saved' : 'missed',
      pGoal: pShot * (1 - pSave), ...(keeperOf ? { pSave } : {}),
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
          outcome: 'blocked', blockerId: e.id,
          pGoal: keeperOf ? pGoal * (1 - keeperSaveProbability('shot', distance, keeperOf)) : pGoal,
          ...(keeperOf ? { pSave: keeperSaveProbability('shot', distance, keeperOf) } : {}),
        });
        return res();
      }
    }
    return headerOrShot(passerId, from, 'shot', pGoal);
  }

  if (early) {
    // ---- v0.5 early through pass: kick (turn-start positions) -> [movement already done] -> receive ----
    const tgt = early.target;
    const style = early.style;
    const startFoes: Positions = Object.fromEntries(enemies.map((e) => [e.id, copy(e.pos)]));
    const est = estimateThroughPass(state, passerId, tgt, style);
    const base = {
      type: 'pass' as const, passerId, space: true, early: true as const, style,
      from: copy(passer.pos), to: copy(tgt), pSuccess: est.pComplete,
    };
    const rolled = new Set<PlayerId>(); // one roll per defender per turn: lane-roll misses skip the marker roll
    for (const i of laneInterceptors(state, startFoes, passer.pos, tgt, style, { markers: false })) {
      rolled.add(i.playerId);
      if (rng.next() < i.pIntercept) {
        give(i.playerId, true);
        events.push({ ...base, outcome: 'intercepted', interceptorId: i.playerId });
        return res();
      }
    }
    if (!(rng.next() < est.pAccurate)) {
      const idx = events.length;
      const { loosePos } = scatter(tgt);
      events.splice(idx, 0, { ...base, outcome: 'failed', loosePos });
      return res();
    }
    const here = state.players.filter((p) => vecEq(at(p.id), tgt));
    const mate = here.find((p) => p.team === passer.team);
    const foe = here.find((p) => p.team !== passer.team);
    if (mate) {
      // Offside is judged entirely on turn-start positions (the line the planner saw).
      if (isOffsidePosition(passer.team, mate.pos, passer.pos, enemies.map((e) => e.pos))) {
        const nearest = [...enemies].sort(
          (a, b) => dist(at(a.id), at(mate.id)) - dist(at(b.id), at(mate.id)) || a.index - b.index,
        )[0] as PlayerState;
        give(nearest.id, false);
        events.push({
          type: 'offside', team: passer.team, passerId, receiverId: mate.id, toPlayerId: nearest.id,
          from: copy(passer.pos), to: copy(tgt), style, early: true,
          ...(trapMadeIt(mate.pos, passer.pos, (e) => e.pos) ? { byTrap: true as const } : {}),
        });
        return res();
      }
      if (foe && !rolled.has(foe.id)) {
        const stats = getEffectiveStats(state, foe);
        const pMark = interceptProbability(style === 'ground' ? stats.intercept : stats.aerial, 0);
        if (rng.next() < pMark) {
          give(foe.id, true);
          events.push({ ...base, outcome: 'intercepted', interceptorId: foe.id, marked: true });
          return res();
        }
      }
      give(mate.id, false);
      (flags[mate.id] as PlayerFlags).receivedPassTurn = state.turn;
      events.push({ ...base, outcome: 'complete', receiverId: mate.id });
    } else if (foe) {
      give(foe.id, true);
      events.push({ ...base, outcome: 'toEnemy', receiverId: foe.id });
    } else {
      ball = { kind: 'loose', pos: copy(tgt) };
      events.push({ ...base, outcome: 'loose', loosePos: copy(tgt) });
    }
    return res();
  }

  if (action.kind === 'spacePass') {
    const tgt = action.target;
    if (!tgt || !inBounds(tgt) || vecEq(tgt, from)) {
      events.push({ type: 'actionCancelled', playerId: passerId, action: 'pass', reason: 'invalidTarget' });
      return res();
    }
    const style = action.style ?? 'ground';
    const est = estimateSpacePass(state, passerId, tgt, from, defMap(), style);
    if (!est.inRange) {
      events.push({ type: 'actionCancelled', playerId: passerId, action: 'pass', reason: 'outOfRange' });
      return res();
    }
    const mate = state.players.find((p) => p.team === passer.team && p.id !== passerId && vecEq(at(p.id), tgt));
    if (mate && callOffside(mate.id, tgt, style)) return res();
    const base = { type: 'pass' as const, passerId, space: true, style, from: copy(from), to: copy(tgt), pSuccess: est.pComplete };
    const interceptorId = rollInterceptors(tgt, style);
    if (interceptorId) {
      give(interceptorId, true);
      events.push({ ...base, outcome: 'intercepted', interceptorId });
      return res();
    }
    if (rng.next() < est.pAccurate) {
      const here = state.players.filter((p) => vecEq(at(p.id), tgt));
      // A teammate on the cell receives even when an enemy shares it.
      const occ = here.find((p) => p.team === passer.team) ?? here[0];
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
    doPass(targetId, action.kind, action.kind === 'pass' ? (action.style ?? 'ground') : 'ground');
    return res();
  }
  if (callOffside(targetId, targetPos, 'lofted')) return res();

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
  const defs: Positions = defMap();
  const defender = aerialDefender(state, passer.team, targetPos, defs, from);
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
    const pSave = keeperOf ? keeperSaveProbability('header', gd, keeperOf) : 0;
    // Header: the receiver is the scorer. One draw: goal / save / off target (v0.9).
    const r = rng.next();
    const goal = r < pH * (1 - pSave);
    events.push({
      type: 'shot', shooterId: targetId, kind: 'header', from: copy(targetPos),
      target: goalTarget(passer.team), outcome: goal ? 'goal' : r < pH ? 'saved' : 'missed', pGoal: pH * (1 - pSave),
      ...(keeperOf ? { pSave } : {}),
    });
    if (goal) {
      events.push({ type: 'goal', team: passer.team, scorerId: targetId });
      return { ball, flags, events, goal: { team: passer.team, scorerId: targetId } };
    }
    goalKick(passer.team);
  }
  return res();
}

/** v0.8: the valid trap declaration of this turn, if any (DESIGN.md §14.1). */
function declaredTrap(state: MatchState, plans: TurnPlans): { team: TeamId; steps: { playerId: PlayerId; from: Vec; to: Vec }[] } | undefined {
  for (const team of ['blue', 'red'] as const) {
    if (plans[team].trap === true && canDeclareTrap(state, team)) return { team, steps: trapSteps(state, team) };
  }
  return undefined;
}

export function resolveTurn(state: MatchState, plans: TurnPlans, rng: Rng): TurnResult {
  // Offside trap: the participants' step is applied first; everything after sees the stepped-up positions
  // as the turn-start positions, and the participants ignore their move plans.
  const trap = declaredTrap(state, plans);
  let work = state;
  let workPlans = plans;
  const trapBack: Record<PlayerId, Vec> = {};
  if (trap) {
    const to = new Map(trap.steps.map((st) => [st.playerId, st]));
    for (const st of trap.steps) if (!vecEq(st.from, st.to)) trapBack[st.playerId] = copy(st.from);
    work = { ...state, players: state.players.map((p) => ({ ...p, pos: copy(to.get(p.id)?.to ?? p.pos) })) };
    const moves = { ...plans[trap.team].moves };
    for (const st of trap.steps) delete moves[st.playerId];
    workPlans = { ...plans, [trap.team]: { ...plans[trap.team], moves } };
  }
  const moved = resolveMovement(work, workPlans, rng);
  const action = resolveBallAction(work, moved, workPlans, rng, trapBack);
  const events: TurnEvent[] = [
    ...(trap ? [{ type: 'trap' as const, team: trap.team, steps: trap.steps }] : []),
    ...moved.events,
    ...action.events,
  ];

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
    ...(trap
      ? {
          trapReady: {
            blue: state.trapReady?.blue ?? 1,
            red: state.trapReady?.red ?? 1,
            [trap.team]: state.turn + 1 + RULES.trap.cooldown,
          },
        }
      : {}),
  };

  let next: MatchState = afterAction;
  // Half time: after the last turn of the first half, when the match goes on.
  const halfTime = halvesEnabled(state) && state.turn === halfTurns(state) && state.turn < state.maxTurns;
  if (halfTime) {
    const second = otherTeam(state.firstKickoff ?? MATCH.firstKickoff);
    const { trapReady: _cleared, ...rest } = kickoffState(afterAction, second);
    void _cleared;
    next = rest;
    events.push({ type: 'halfTime', score: { ...score }, kickoffTeam: second });
  } else if (action.goal) {
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
