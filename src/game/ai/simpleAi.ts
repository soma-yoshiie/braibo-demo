import type { MatchState, PlayerId, PlayerState, Rng, TeamId, TeamPlan, Vec } from '../types';
import { BOARD, RULES, forwardDir, goalTarget, otherTeam } from '../rules/config';
import { dist, vecEq } from '../rules/geometry';
import { legalMoveTargets } from '../rules/moves';
import { estimateCross, estimatePass, estimateShot, isCrossValid } from '../rules/estimates';
import { isOffsidePosition } from '../rules/offside';
import { getCharacter } from '../data/characters';
import { ballHolder, playersOf } from '../engine/match';
import { AI_WEIGHTS, advancement, chebyshev, countNear, key, positionValue } from './evaluate';

export { AI_WEIGHTS };

export interface AiOptions {
  /** Minimum P(goal) for the carrier to prefer shooting. */
  shootThreshold?: number;
  /** Magnitude of the random noise added to every option value. */
  randomness?: number;
  /** Extra eagerness to press the ball (1 = default). */
  aggression?: number;
}

const DEFAULTS: Required<AiOptions> = { shootThreshold: 0.22, randomness: 0.15, aggression: 1 };

interface Ctx {
  state: MatchState;
  team: TeamId;
  rng: Rng;
  opt: Required<AiOptions>;
  W: typeof AI_WEIGHTS;
  plan: TeamPlan;
  me: PlayerState[];
  foes: PlayerState[];
  /** Cells that are taken: planned destinations + current cells of teammates not yet planned. */
  reserved: Set<string>;
  /** Planned (or current, if not yet planned) position of each of our players. */
  pos: Record<PlayerId, Vec>;
  planned: Set<PlayerId>;
}

const noise = (c: Ctx): number => (c.rng.next() * 2 - 1) * c.opt.randomness;

function place(c: Ctx, p: PlayerState, to: Vec): void {
  c.reserved.delete(key(p.pos));
  c.reserved.add(key(to));
  c.pos[p.id] = to;
  c.planned.add(p.id);
  if (!vecEq(to, p.pos)) c.plan.moves[p.id] = to;
}

/** Stay + legal targets that no teammate has taken. */
function candidates(c: Ctx, p: PlayerState): Vec[] {
  return [p.pos, ...legalMoveTargets(c.state, p.id).filter((t) => !c.reserved.has(key(t)))];
}

const phys = (p: PlayerState): number => getCharacter(p.charId).stats.physical;
const foePositions = (c: Ctx): Vec[] => c.foes.map((f) => f.pos);
const matesExcept = (c: Ctx, p: PlayerState): Vec[] => c.me.filter((m) => m.id !== p.id).map((m) => c.pos[m.id]);
const closest = (ps: PlayerState[], to: Vec): PlayerState | undefined =>
  [...ps].sort((a, b) => dist(a.pos, to) - dist(b.pos, to) || a.index - b.index)[0];

function enemyReachers(c: Ctx): Map<string, PlayerState[]> {
  const m = new Map<string, PlayerState[]>();
  for (const f of c.foes)
    for (const t of legalMoveTargets(c.state, f.id)) {
      const k = key(t);
      m.set(k, [...(m.get(k) ?? []), f]);
    }
  return m;
}

// ---------------------------------------------------------------------------
// Offence
// ---------------------------------------------------------------------------

function planOffBall(c: Ctx, players: PlayerState[], anchor: Vec, holding = false): void {
  const goal = goalTarget(c.team);
  const order = [...players].sort((a, b) => dist(a.pos, goal) - dist(b.pos, goal) || a.index - b.index);
  const foes = foePositions(c);
  const foeMap = c.foes.map((f) => f.pos);
  for (const p of order) {
    let best = p.pos;
    let bestV = -Infinity;
    for (const t of candidates(c, p)) {
      let v = positionValue(c.state, p, t, matesExcept(c, p), foes, anchor) + noise(c) * 0.5;
      if (holding && isOffsidePosition(c.team, t, anchor, foeMap)) v -= c.W.offside;
      if (v > bestV) {
        bestV = v;
        best = t;
      }
    }
    place(c, p, best);
  }
}

function planCarrier(c: Ctx, carrier: PlayerState): void {
  const { W, state, team } = c;
  const foes = foePositions(c);
  const reachers = enemyReachers(c);
  const mates = c.me.filter((m) => m.id !== carrier.id);
  const danger = (d: Vec): number => {
    let v = W.dangerAdjacent * countNear(d, foes);
    for (const f of reachers.get(key(d)) ?? []) v += W.danger * (phys(f) / (phys(f) + phys(carrier)));
    return v;
  };
  type Option = { dest: Vec; action: TeamPlan['ballAction']; v: number };
  let best: Option = { dest: carrier.pos, action: { kind: 'keep' }, v: -Infinity };
  const consider = (dest: Vec, action: Option['action'], v: number): void => {
    const nv = v + noise(c);
    if (nv > best.v) best = { dest, action, v: nv };
  };
  const lateCrosses: Option[] = [];
  for (const d of candidates(c, carrier)) {
    const dng = danger(d);
    const free = dng === 0 ? W.freeAdvance * advancement(team, d) : 0;
    consider(d, { kind: 'keep' }, positionValue(state, carrier, d, mates.map((m) => c.pos[m.id]), foes, d) - dng + free);
    const pShot = estimateShot(state, carrier.id, d).pGoal;
    const near = dist(d, goalTarget(team)) <= 3 ? W.nearShootFactor : 1;
    if (pShot >= c.opt.shootThreshold * near) consider(d, { kind: 'shoot' }, pShot * W.shotScale);
    for (const t of mates) {
      const tp = c.pos[t.id];
      const adv = advancement(team, tp) - advancement(team, d);
      if (isCrossValid(team, d, tp)) {
        const ce = estimateCross(state, carrier.id, t.id, d, tp);
        if (ce.offside) continue;
        const contested = ce.defenderId !== undefined;
        const cv =
          ce.pGoal * W.shotScale * W.crossScale +
          W.crossBonus * ce.pDelivery * ce.pWinAerial -
          (contested ? W.crossLoss * ce.pDelivery * (1 - ce.pWinAerial) : 0) -
          dng * 0.3;
        if (contested && ce.pWinAerial < W.crossMinAerial) lateCrosses.push({ dest: d, action: { kind: 'cross', targetId: t.id }, v: cv + noise(c) });
        else consider(d, { kind: 'cross', targetId: t.id }, cv);
      }
      const tv = positionValue(state, t, tp, [d, ...mates.filter((m) => m.id !== t.id).map((m) => c.pos[m.id])], foes, d);
      for (const style of ['ground', 'lofted'] as const) {
        const pe = estimatePass(state, carrier.id, t.id, d, tp, undefined, style);
        if (!pe.inRange || pe.offside) continue;
        consider(
          d,
          { kind: 'pass', targetId: t.id, style },
          pe.pComplete * (tv + 0.2 + W.passForward * Math.max(0, adv)) - (adv < 0 ? W.backwardPass : 0) - dng * 0.3,
        );
      }
    }
  }
  for (const lc of lateCrosses) if (lc.v > best.v + W.crossMargin) best = lc;
  place(c, carrier, best.dest);
  c.plan.ballAction = best.action ?? { kind: 'keep' };
}

// ---------------------------------------------------------------------------
// Defence
// ---------------------------------------------------------------------------

interface Guess {
  cell: Vec;
  w: number;
}

/** Weighted guess of where the enemy carrier will stand next turn. */
function likelyCells(c: Ctx, carrier: PlayerState, boost?: Vec): Guess[] {
  const dirToUs = -forwardDir(carrier.team);
  const cells = [carrier.pos, ...legalMoveTargets(c.state, carrier.id)];
  const mine = c.me.map((m) => m.pos);
  const raw = cells.map((cell) => {
    let w = vecEq(cell, carrier.pos) ? 1.6 : 1;
    w += 0.4 * Math.max(0, (cell.y - carrier.pos.y) * dirToUs);
    if (countNear(cell, mine) > 0) w *= 0.6;
    if (boost && vecEq(cell, boost)) w *= 4;
    return { cell, w };
  });
  const total = raw.reduce((s, g) => s + g.w, 0);
  return raw.map((g) => ({ cell: g.cell, w: g.w / total }));
}

function planPresser(c: Ctx, presser: PlayerState, carrier: PlayerState, guesses: Guess[]): void {
  let best = presser.pos;
  let bestV = -Infinity;
  for (const t of candidates(c, presser)) {
    const g = guesses.find((q) => vecEq(q.cell, t));
    const closer = dist(presser.pos, carrier.pos) - dist(t, carrier.pos);
    const v = c.opt.aggression * (c.W.press * (g?.w ?? 0) + c.W.pressCloser * closer) + noise(c) * 0.3;
    if (v > bestV) {
      bestV = v;
      best = t;
    }
  }
  place(c, presser, best);
}

/** Threat of each enemy non-carrier as a shot receiver, given our hypothetical positions. */
function receiverThreats(c: Ctx, carrier: PlayerState, hyp: Record<PlayerId, Vec>): { r: PlayerState; threat: number; pass: number }[] {
  return c.foes
    .filter((f) => f.id !== carrier.id)
    .map((r) => {
      const sh = estimateShot(c.state, r.id, r.pos, hyp);
      const oneTouch = getCharacter(r.charId).skills.includes('oneTouch') ? RULES.skills.oneTouchShotBonus : 0;
      const pe = estimatePass(c.state, carrier.id, r.id, carrier.pos, r.pos, hyp);
      const factor = pe.inRange ? 1 : 0.3;
      const threat = Math.min(RULES.shot.max, sh.pGoalIfUnblocked + oneTouch) * (1 - sh.pBlocked) * factor;
      return { r, threat, pass: pe.inRange ? 0.4 + 0.6 * pe.pComplete : 0.3 };
    });
}

/** Expected goal chance via a pass to a receiver, summed over receivers. */
function receiverRisk(c: Ctx, carrier: PlayerState, hyp: Record<PlayerId, Vec>): number {
  return receiverThreats(c, carrier, hyp).reduce((s, x) => s + x.threat * x.pass, 0);
}

/** Bonus for standing next to the most dangerous receiver (unblocked threat). */
function markBonus(top: { r: PlayerState; threat: number } | undefined, c: Ctx, t: Vec, isDf: boolean): number {
  if (!top || top.threat < 0.1) return 0;
  const near = chebyshev(t, top.r.pos) <= 1 ? 1 : 0;
  return top.threat * near * (isDf && dist(top.r.pos, goalTarget(otherTeam(c.team))) <= 4 ? 1.5 : 1);
}

function planDefenders(c: Ctx, defenders: PlayerState[], carrier: PlayerState, guesses: Guess[]): void {
  const { W, state } = c;
  const ownGoal = goalTarget(otherTeam(c.team));
  const top = [...guesses].sort((a, b) => b.w - a.w).slice(0, 4);
  const mate = c.foes
    .filter((f) => f.id !== carrier.id)
    .sort((a, b) => advancement(b.team, b.pos) - advancement(a.team, a.pos))[0];
  const order = [...defenders].sort((a, b) => dist(a.pos, ownGoal) - dist(b.pos, ownGoal) || a.index - b.index);
  const byDepth = [...c.me].sort((a, b) => advancement(c.team, a.pos) - advancement(c.team, b.pos) || a.index - b.index);
  const deepest = byDepth[0];
  const trapOn =
    advancement(carrier.team, carrier.pos) >= 5 &&
    byDepth.length > 1 &&
    advancement(c.team, byDepth[1].pos) - advancement(c.team, deepest.pos) > 1;
  const shotRiskAt = (hyp: Record<PlayerId, Vec>): number =>
    top.reduce((s, g) => s + g.w * estimateShot(state, carrier.id, g.cell, hyp).pGoal, 0);
  for (const p of order) {
    const isDf = getCharacter(p.charId).role === 'physicalDefender';
    const stayRisk = trapOn && p.id === deepest.id ? shotRiskAt({ ...c.pos, [p.id]: p.pos }) : Infinity;
    const topReceiver = receiverThreats(c, carrier, c.pos).sort((a, b) => b.threat - a.threat)[0];
    let best = p.pos;
    let bestV = -Infinity;
    for (const t of candidates(c, p)) {
      const hyp = { ...c.pos, [p.id]: t };
      let risk = 0;
      for (const g of top) risk += g.w * estimateShot(state, carrier.id, g.cell, hyp).pGoal;
      let v = -W.shotRisk * risk;
      if (p.id === deepest.id && trapOn && advancement(c.team, t) === advancement(c.team, p.pos) + 1 && risk <= stayRisk + 1e-9) v += W.trap;
      v -= W.receiverRisk * receiverRisk(c, carrier, hyp);
      v += W.mark * markBonus(topReceiver, c, t, isDf);
      if (mate) {
        const pe = estimatePass(state, carrier.id, mate.id, carrier.pos, mate.pos, hyp);
        v += W.lane * (pe.interceptors.find((i) => i.playerId === p.id)?.pIntercept ?? 0);
      }
      if (dist(t, ownGoal) < dist(carrier.pos, ownGoal)) v += W.goalSide;
      v -= 0.04 * Math.abs(t.x - (carrier.pos.x + BOARD.goalX) / 2);
      if (isDf) v -= W.defenderLeash * Math.max(0, dist(t, ownGoal) - 4);
      v += noise(c) * 0.3;
      if (v > bestV) {
        bestV = v;
        best = t;
      }
    }
    place(c, p, best);
  }
}

function planDefence(c: Ctx, carrier: PlayerState, presser: PlayerState | undefined, boost?: Vec): void {
  const guesses = likelyCells(c, carrier, boost);
  const rest = c.me.filter((m) => !c.planned.has(m.id));
  const p = presser ?? closest(rest, carrier.pos);
  if (p && !c.planned.has(p.id)) planPresser(c, p, carrier, guesses);
  planDefenders(c, c.me.filter((m) => !c.planned.has(m.id)), carrier, guesses);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function planAiTurn(state: MatchState, team: TeamId, rng: Rng, options: AiOptions = {}): TeamPlan {
  const me = playersOf(state, team);
  const c: Ctx = {
    state,
    team,
    rng,
    opt: { ...DEFAULTS, ...options },
    W: AI_WEIGHTS,
    plan: { team, moves: {} },
    me,
    foes: playersOf(state, otherTeam(team)),
    reserved: new Set(me.map((m) => key(m.pos))),
    pos: Object.fromEntries(me.map((m) => [m.id, m.pos])),
    planned: new Set(),
  };
  if (state.phase === 'finished') return c.plan;
  const holder = ballHolder(state);

  if (holder && holder.team === team) {
    planOffBall(c, me.filter((m) => m.id !== holder.id), holder.pos, true);
    planCarrier(c, holder);
  } else if (holder) {
    planDefence(c, holder, undefined);
  } else if (state.ball.kind === 'loose') {
    const ball = state.ball.pos;
    const reach = (p: PlayerState): boolean => vecEq(p.pos, ball) || legalMoveTargets(state, p.id).some((t) => vecEq(t, ball));
    const reachers = c.me.filter(reach).sort((a, b) => phys(b) - phys(a) || a.index - b.index);
    const chaser = reachers[0] ?? closest(c.me, ball);
    if (chaser) {
      if (reachers[0]) place(c, chaser, ball);
      else {
        const t = candidates(c, chaser).sort((a, b) => dist(a, ball) - dist(b, ball))[0] ?? chaser.pos;
        place(c, chaser, t);
      }
    }
    const rest = c.me.filter((m) => !c.planned.has(m.id));
    const foeNear = closest(c.foes, ball);
    const ourNear = chaser ? dist(chaser.pos, ball) : Infinity;
    if (foeNear && dist(foeNear.pos, ball) < ourNear) planDefence(c, foeNear, closest(rest, foeNear.pos), ball);
    else planOffBall(c, rest, ball);
  }
  return c.plan;
}
