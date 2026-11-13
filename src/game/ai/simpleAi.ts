import type { MatchState, PassStyle, PlayerId, PlayerState, Rng, TeamId, TeamPlan, Vec } from '../types';
import { BOARD, RULES, forwardDir, goalTarget, otherTeam, throughPassMode } from '../rules/config';
import { dist, vecEq } from '../rules/geometry';
import { legalMoveTargets } from '../rules/moves';
import { estimateCross, estimatePass, estimateShot, estimateThroughPass, isCrossValid } from '../rules/estimates';
import { isOffsidePosition } from '../rules/offside';
import { canDeclareTrap, trapSteps } from '../rules/trap';
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

const throughMode = (c: Ctx): boolean => throughPassMode(c.state) === 'early';

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
  // v0.4: an enemy only duels the carrier when it ends in the carrier's cell, so the enemy's own
  // cell (it may stay put) counts as reachable too.
  for (const f of c.foes)
    for (const t of [f.pos, ...legalMoveTargets(c.state, f.id)]) {
      const k = key(t);
      m.set(k, [...(m.get(k) ?? []), f]);
    }
  return m;
}

// ---------------------------------------------------------------------------
// Offside trap (v0.8)
// ---------------------------------------------------------------------------

/** Enemy positions as they would be after a trap declaration (participants one step up). */
function foesAfterTrap(c: Ctx): Vec[] {
  const step = new Map(trapSteps(c.state, otherTeam(c.team)).map((s) => [s.playerId, s.to]));
  return c.foes.map((f) => step.get(f.id) ?? f.pos);
}

/** Offence: may the opponent declare a trap this turn (we hold the ball, their wait is over)? */
const foeMayTrap = (c: Ctx): boolean => canDeclareTrap(c.state, otherTeam(c.team));

/** Our own positions as they would be after we declare (participants one step up). */
function mineAfterTrap(c: Ctx): Vec[] {
  const step = new Map(trapSteps(c.state, c.team).map((s) => [s.playerId, s.to]));
  return c.me.map((m) => step.get(m.id) ?? m.pos);
}

/**
 * Defence: how many attackers could the trap catch? An attacker counts fully when it is onside now but
 * offside once our line steps up (level with the line) and the carrier can reach it; it counts `trapNear`
 * when it could only be caught by running onto the line (one row behind).
 */
function trapThreat(c: Ctx, carrier: PlayerState): number {
  const now = c.me.map((m) => m.pos);
  const after = mineAfterTrap(c);
  const reach = RULES.pass.lofted.maxDistance;
  const caught = (t: Vec): boolean =>
    !isOffsidePosition(carrier.team, t, carrier.pos, now) && isOffsidePosition(carrier.team, t, carrier.pos, after);
  let sum = 0;
  for (const r of c.foes) {
    if (r.id === carrier.id || dist(carrier.pos, r.pos) > reach + 1) continue;
    if (caught(r.pos)) sum += 1;
    else if (legalMoveTargets(c.state, r.id).some((t) => caught(t))) sum += c.W.trapNear;
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Offence
// ---------------------------------------------------------------------------

/** Advancement (from our side) of the k-th last enemy defender, i.e. the offside line. -1 if none. */
function foeAdvs(c: Ctx): number {
  const k = RULES.offside.lastDefenders;
  const advs = c.foes.map((f) => advancement(c.team, f.pos)).sort((a, b) => b - a);
  return advs.length >= k ? (advs[k - 1] as number) : -1;
}

function planOffBall(c: Ctx, players: PlayerState[], anchor: Vec, holding = false): void {
  const goal = goalTarget(c.team);
  const order = [...players].sort((a, b) => dist(a.pos, goal) - dist(b.pos, goal) || a.index - b.index);
  const foes = foePositions(c);
  const foeMap = c.foes.map((f) => f.pos);
  const lastAdv = foeAdvs(c);
  const trapAfter = holding && foeMayTrap(c) ? foesAfterTrap(c) : undefined;
  const carrierRole = holding ? c.foes && c.me.find((m) => vecEq(m.pos, anchor)) : undefined;
  const crossSetup =
    !!carrierRole &&
    getCharacter(carrierRole.charId).role === 'wing' &&
    BOARD.wideColumns.includes(anchor.x) &&
    advancement(c.team, anchor) >= 6;
  for (const p of order) {
    const role = getCharacter(p.charId).role;
    let best = p.pos;
    let bestV = -Infinity;
    for (const t of candidates(c, p)) {
      let v = positionValue(c.state, p, t, matesExcept(c, p), foes, anchor) + noise(c) * 0.5;
      if (holding) {
        const off = isOffsidePosition(c.team, t, anchor, foeMap);
        if (off) v -= throughMode(c) ? c.W.offsideEarly : c.W.offside;
        else if (trapAfter && isOffsidePosition(c.team, t, anchor, trapAfter)) v -= c.W.trapLevelOff;
        const a = advancement(c.team, t);
        const striking = role === 'striker' || role === 'longShooter';
        if (striking && advancement(c.team, anchor) >= 4 && lastAdv >= 4) {
          if (a === lastAdv) v += c.W.holdLine;
          else if (a === lastAdv - 1) v += c.W.holdLine * 0.6;
        }
        if (crossSetup && !off && role !== 'wing' && role !== 'physicalDefender' && BOARD.centralColumns.includes(t.x) && a >= BOARD.rows - BOARD.crossZoneRows)
          v += c.W.crossZone;
      }
      if (v > bestV) {
        bestV = v;
        best = t;
      }
    }
    place(c, p, best);
  }
}

/** Plans the carrier's cell and ball action; returns the value of the chosen option. */
function planCarrier(c: Ctx, carrier: PlayerState): number {
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
  // v0.8: while the opponent may declare a trap, a receiver level with the line at its final cell is caught if it steps up.
  const trapAfter = foeMayTrap(c) ? foesAfterTrap(c) : undefined;
  const trapFoot = (d: Vec, tp: Vec): number => (trapAfter && isOffsidePosition(team, tp, d, trapAfter) ? c.W.trapFootRisk : 0);
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
          (1 - trapFoot(d, tp)) * (ce.pGoal * W.shotScale * W.crossScale + W.crossBonus * ce.pDelivery * ce.pWinAerial) -
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
          (1 - trapFoot(d, tp)) * pe.pComplete * (tv + 0.2 + W.passForward * Math.max(0, adv)) - (adv < 0 ? W.backwardPass : 0) - dng * 0.3,
        );
      }
    }
  }
  for (const lc of lateCrosses) if (lc.v > best.v + W.crossMargin) best = lc;
  place(c, carrier, best.dest);
  c.plan.ballAction = best.action ?? { kind: 'keep' };
  return best.v;
}

// ---------------------------------------------------------------------------
// v0.5 early through pass (offence)
// ---------------------------------------------------------------------------

interface ThroughOption {
  runner: PlayerState;
  target: Vec;
  style: PassStyle;
  v: number;
}

/**
 * Best "onside teammate runs to a cell, the carrier (standing still) kicks there first" option.
 * Runners must be onside NOW (the line is judged on turn-start positions).
 */
function bestThrough(c: Ctx, carrier: PlayerState): ThroughOption | undefined {
  const { W, state } = c;
  const foes = foePositions(c);
  const reachers = enemyReachers(c);
  let danger = W.dangerAdjacent * countNear(carrier.pos, foes);
  for (const f of reachers.get(key(carrier.pos)) ?? []) danger += W.danger * (phys(f) / (phys(f) + phys(carrier)));
  let best: ThroughOption | undefined;
  const trapAfter = foeMayTrap(c) ? foesAfterTrap(c) : undefined;
  for (const runner of c.me) {
    if (runner.id === carrier.id) continue;
    if (isOffsidePosition(c.team, runner.pos, carrier.pos, foes)) continue;
    // v0.8: a runner level with the line is caught if the opponent steps up; one starting behind it is not.
    const trapped = !!trapAfter && isOffsidePosition(c.team, runner.pos, carrier.pos, trapAfter);
    const others = c.me.filter((m) => m.id !== runner.id && m.id !== carrier.id).map((m) => m.pos);
    for (const t of legalMoveTargets(state, runner.id)) {
      if (c.reserved.has(key(t)) || vecEq(t, carrier.pos)) continue;
      // A through pass is a run forward of the ball; sideways / backward ones are ordinary passes.
      if (advancement(c.team, t) - advancement(c.team, carrier.pos) < W.tpMinAdvance) continue;
      const nGo = (reachers.get(key(t)) ?? []).length;
      const contested = 1 - Math.pow(1 - W.tpFoeGo, nGo);
      const arrival =
        positionValue(state, runner, t, [carrier.pos, ...others], foes, carrier.pos) +
        W.tpShot * estimateShot(state, runner.id, t).pGoal;
      for (const style of ['ground', 'lofted'] as const) {
        const pe = estimateThroughPass(state, carrier.id, t, style);
        if (!pe.inRange || pe.pComplete < W.tpMinP) continue;
        const v =
          Math.pow(pe.pComplete, W.tpPExp) * (1 - contested * W.tpMark) * (arrival + 0.2) * (trapped ? 1 - W.trapRisk : 1) +
          W.tpBonus + (trapAfter && !trapped ? W.trapBehind : 0) - danger * 0.3 + noise(c);
        if (!best || v > best.v) best = { runner, target: t, style, v };
      }
    }
  }
  return best;
}

/** Carrier stays, the runner goes to the target, everybody else positions normally. */
function planThrough(c: Ctx, carrier: PlayerState, o: ThroughOption): void {
  place(c, carrier, carrier.pos);
  place(c, o.runner, o.target);
  planOffBall(c, c.me.filter((m) => !c.planned.has(m.id)), carrier.pos, true);
  c.plan.ballAction = { kind: 'spacePass', target: o.target, style: o.style };
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

/**
 * Where an onside enemy runner is most likely to be sent by an early through pass: the cells the enemy
 * would rank highest with the same evaluation the attacking AI uses. `p` = the carrier's delivery chance,
 * `share` = this cell's share of the (top 3) attractiveness.
 */
function throughThreats(c: Ctx, carrier: PlayerState): { cell: Vec; p: number; share: number }[] {
  const mine = c.me.map((m) => m.pos);
  const foeMates = c.foes.filter((f) => f.id !== carrier.id);
  const out = new Map<string, { cell: Vec; p: number; w: number }>();
  for (const f of foeMates) {
    if (isOffsidePosition(carrier.team, f.pos, carrier.pos, mine)) continue;
    const others = foeMates.filter((m) => m.id !== f.id).map((m) => m.pos);
    for (const t of legalMoveTargets(c.state, f.id)) {
      if (advancement(carrier.team, t) - advancement(carrier.team, carrier.pos) < c.W.tpMinAdvance) continue;
      let arrival: number | undefined;
      for (const style of ['ground', 'lofted'] as const) {
        const p = estimateThroughPass(c.state, carrier.id, t, style).pComplete;
        if (p < c.W.tpMinP) continue;
        arrival ??= positionValue(c.state, f, t, [carrier.pos, ...others], mine, carrier.pos) + c.W.tpShot * estimateShot(c.state, f.id, t).pGoal;
        const w = p * Math.max(0.05, arrival + 0.2);
        const old = out.get(key(t));
        if (!old || w > old.w) out.set(key(t), { cell: t, p, w });
      }
    }
  }
  const top = [...out.values()].sort((a, b) => b.w - a.w).slice(0, 3);
  const total = top.reduce((s, x) => s + x.w, 0);
  return top.map((x) => ({ cell: x.cell, p: x.p, share: x.w / total }));
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
  // v0.5: against an early through pass the deepest defender either steps up (trap) or drops back and covers.
  const threats = throughMode(c) ? throughThreats(c, carrier) : [];
  const threat = threats.length ? (threats[0] as { p: number }).p * c.W.coverThreat : 0;
  const cover = threat > 0 && c.rng.next() < Math.min(c.W.coverMax, c.W.coverBase + c.W.coverScale * threat);
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
      if (!cover && p.id === deepest.id && trapOn && advancement(c.team, t) === advancement(c.team, p.pos) + 1 && risk <= stayRisk + 1e-9) v += throughMode(c) ? W.trapEarly : W.trap;
      if (cover && (p.id === deepest.id || W.coverAll > 0)) {
        for (const th of threats) {
          // A target a teammate already stands on (planned) is covered; do not pile on.
          if (c.me.some((m) => m.id !== p.id && c.planned.has(m.id) && chebyshev(c.pos[m.id] as Vec, th.cell) === 0)) continue;
          const d = chebyshev(t, th.cell);
          v += W.coverCell * th.share * (d === 0 ? 1 : d === 1 ? W.coverNear : 0);
        }
        if (p.id === deepest.id) v += W.coverBack * (advancement(c.team, p.pos) - advancement(c.team, t));
      }
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

function makeCtx(state: MatchState, team: TeamId, rng: Rng, options: AiOptions): Ctx {
  const me = playersOf(state, team);
  return {
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
}

export function planAiTurn(state: MatchState, team: TeamId, rng: Rng, options: AiOptions = {}): TeamPlan {
  let c = makeCtx(state, team, rng, options);
  const me = c.me;
  if (state.phase === 'finished') return c.plan;
  const holder = ballHolder(state);

  if (holder && holder.team === team) {
    // v0.5: evaluate the through pass on the untouched state, then keep it only if it beats the ordinary plan.
    const through = throughMode(c) ? bestThrough(c, holder) : undefined;
    planOffBall(c, me.filter((m) => m.id !== holder.id), holder.pos, true);
    const normal = planCarrier(c, holder);
    if (through && through.v > normal + c.W.tpMargin) {
      c = makeCtx(state, team, rng, options);
      planThrough(c, holder, through);
    }
  } else if (holder) {
    // v0.8: maybe declare an offside trap (only when an attacker could really be caught; never every time).
    if (canDeclareTrap(state, team)) {
      const threat = trapThreat(c, holder);
      if (threat > 0 && rng.next() < Math.min(c.W.trapMax, c.W.trapBase + c.W.trapScale * threat)) {
        for (const st of trapSteps(state, team)) {
          const p = c.me.find((m) => m.id === st.playerId) as PlayerState;
          c.reserved.delete(key(p.pos));
          c.reserved.add(key(st.to));
          c.pos[p.id] = st.to;
          c.planned.add(p.id);
        }
        c.plan.trap = true;
      }
    }
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
