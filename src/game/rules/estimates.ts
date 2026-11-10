import type {
  CrossEstimate,
  MatchState,
  PassEstimate,
  PassStyle,
  PlayerId,
  PlayerState,
  ShotEstimate,
  TeamId,
  Vec,
} from '../types';
import { BOARD, RULES, goalTarget } from './config';
import { getCharacter } from '../data/characters';
import { cellsOnSegment, dist, neighbors8, vecEq } from './geometry';
import { getEffectiveStats } from './moves';
import { isOffsidePosition } from './offside';
import {
  aerialWinProbability,
  blockProbability,
  crossDelivery,
  headerGoalProbability,
  interceptProbability,
  passAccuracy,
  passMaxDistance,
  shotGoalProbability,
} from './probability';

export type PositionMap = Record<PlayerId, Vec>;

function get(state: MatchState, id: PlayerId): PlayerState {
  const p = state.players.find((q) => q.id === id);
  if (!p) throw new Error(`Unknown player: ${id}`);
  return p;
}

/** Current positions of the enemies of `team`. */
export function enemyPositions(state: MatchState, team: TeamId): PositionMap {
  const out: PositionMap = {};
  for (const p of state.players) if (p.team !== team) out[p.id] = p.pos;
  return out;
}

/** Defenders (as PlayerState + position) lying on the lane, in order of t. */
function onLane(
  state: MatchState,
  defenders: PositionMap,
  from: Vec,
  to: Vec,
  laneWidth: number,
): { player: PlayerState; offset: number; t: number }[] {
  const out: { player: PlayerState; offset: number; t: number }[] = [];
  for (const { cell, offset, t } of cellsOnSegment(from, to, laneWidth)) {
    for (const id of Object.keys(defenders)) {
      const pos = defenders[id];
      if (pos && vecEq(pos, cell)) out.push({ player: get(state, id), offset, t });
    }
  }
  return out;
}

const complement = (ps: number[]) => 1 - ps.reduce((acc, p) => acc * (1 - p), 1);

export function estimateShot(
  state: MatchState,
  shooterId: PlayerId,
  fromPos?: Vec,
  defenderPositions?: PositionMap,
): ShotEstimate {
  const shooter = get(state, shooterId);
  const from = fromPos ?? shooter.pos;
  const defs = defenderPositions ?? enemyPositions(state, shooter.team);
  const target = goalTarget(shooter.team);
  const distance = dist(from, target);
  const angleSin = distance === 0 ? 0 : Math.abs(from.x - target.x) / distance;
  const skills = getCharacter(shooter.charId).skills;
  const oneTouchActive = shooter.flags.receivedPassTurn === state.turn - 1;
  const pGoalIfUnblocked = shotGoalProbability(distance, angleSin, getEffectiveStats(state, shooter), skills, {
    oneTouchActive,
  });
  const blockers = onLane(state, defs, from, target, RULES.shot.laneWidth)
    .map(({ player, offset }) => {
      const pos = defs[player.id] as Vec;
      const d = dist(from, pos);
      return {
        playerId: player.id,
        d,
        pBlock: blockProbability(d, offset, getEffectiveStats(state, player).block, getCharacter(player.charId).skills),
      };
    })
    .sort((a, b) => a.d - b.d)
    .map(({ playerId, pBlock }) => ({ playerId, pBlock }));
  const pBlocked = complement(blockers.map((b) => b.pBlock));
  return { distance, pGoalIfUnblocked, pBlocked, pGoal: pGoalIfUnblocked * (1 - pBlocked), blockers };
}

/**
 * Defenders who get an interception roll on a pass lane, in order of t.
 * Plus tight markers: enemies in the `to` cell come last (ground `intercept`, lofted `aerial`).
 * ground: everyone on the lane (`intercept`). lofted: only those within endZoneRadius of the
 * passer (`intercept`) or of the target (`aerial`).
 */
export function laneInterceptors(
  state: MatchState,
  defs: PositionMap,
  from: Vec,
  to: Vec,
  style: PassStyle,
  opts: { markers?: boolean } = {},
): { playerId: PlayerId; pIntercept: number }[] {
  const out: { playerId: PlayerId; pIntercept: number }[] = [];
  const radius = RULES.pass.lofted.endZoneRadius;
  for (const { player, offset } of onLane(state, defs, from, to, RULES.pass.laneWidth)) {
    const stats = getEffectiveStats(state, player);
    if (style === 'ground') {
      out.push({ playerId: player.id, pIntercept: interceptProbability(stats.intercept, offset) });
      continue;
    }
    const pos = defs[player.id] as Vec;
    if (dist(from, pos) <= radius) out.push({ playerId: player.id, pIntercept: interceptProbability(stats.intercept, offset) });
    else if (dist(to, pos) <= radius) out.push({ playerId: player.id, pIntercept: interceptProbability(stats.aerial, offset) });
  }
  // Tight markers (v0.4): enemies sharing the receiver's / target cell roll last, at offset 0.
  // Enemies in the kicker's cell never intercept (cellsOnSegment excludes both endpoints).
  if (opts.markers === false) return out;
  for (const id of Object.keys(defs)) {
    const pos = defs[id];
    if (!pos || !vecEq(pos, to)) continue;
    const stats = getEffectiveStats(state, get(state, id));
    out.push({ playerId: id, pIntercept: interceptProbability(style === 'ground' ? stats.intercept : stats.aerial, 0) });
  }
  return out;
}

/** Shared lane/accuracy computation for player-targeted and space passes. */
function passEstimate(
  state: MatchState,
  passer: PlayerState,
  from: Vec,
  to: Vec,
  defs: PositionMap,
  penalty: number,
  style: PassStyle,
  offside: boolean,
): PassEstimate {
  const skills = getCharacter(passer.charId).skills;
  const distance = dist(from, to);
  const inRange = distance <= passMaxDistance(skills, style);
  let pAccurate = passAccuracy(distance, getEffectiveStats(state, passer).pass, skills, style);
  if (penalty > 0) pAccurate = Math.min(RULES.pass.max, Math.max(RULES.pass.min, pAccurate - penalty));
  const interceptors = laneInterceptors(state, defs, from, to, style);
  const pIntercepted = complement(interceptors.map((i) => i.pIntercept));
  return {
    style,
    distance,
    pAccurate,
    pIntercepted,
    pComplete: inRange && !offside ? pAccurate * (1 - pIntercepted) : 0,
    interceptors,
    inRange,
    offside,
  };
}

const posList = (defs: PositionMap): Vec[] => Object.values(defs);

export function estimatePass(
  state: MatchState,
  passerId: PlayerId,
  targetId: PlayerId,
  passerPos?: Vec,
  targetPos?: Vec,
  defenderPositions?: PositionMap,
  style: PassStyle = 'ground',
): PassEstimate {
  const passer = get(state, passerId);
  const target = get(state, targetId);
  const defs = defenderPositions ?? enemyPositions(state, passer.team);
  const from = passerPos ?? passer.pos;
  const to = targetPos ?? target.pos;
  const offside = isOffsidePosition(passer.team, to, from, posList(defs));
  return passEstimate(state, passer, from, to, defs, 0, style, offside);
}

/**
 * Pass aimed at a cell. Accuracy carries RULES.pass.spacePenalty; pComplete is 0 out of range or when target == passer cell.
 * Offside only when a teammate stands (in `teammatePositions` if given, else currently) on the target cell (that teammate is judged).
 */
export function estimateSpacePass(
  state: MatchState,
  passerId: PlayerId,
  target: Vec,
  passerPos?: Vec,
  defenderPositions?: PositionMap,
  style: PassStyle = 'ground',
  teammatePositions?: PositionMap,
): PassEstimate {
  const passer = get(state, passerId);
  const from = passerPos ?? passer.pos;
  const defs = defenderPositions ?? enemyPositions(state, passer.team);
  const mate = state.players.find(
    (p) => p.team === passer.team && p.id !== passerId && vecEq(teammatePositions?.[p.id] ?? p.pos, target),
  );
  const offside = mate ? isOffsidePosition(passer.team, target, from, posList(defs)) : false;
  const e = passEstimate(state, passer, from, target, defs, RULES.pass.spacePenalty, style, offside);
  if (vecEq(from, target)) return { ...e, inRange: false, pComplete: 0 };
  return e;
}

/**
 * v0.5 early through pass (DESIGN.md §5): kicked before movement, so everything uses CURRENT positions
 * and the result is exact, not a guess. `pComplete` = P(the ball arrives on the target cell)
 * = accuracy x (1 - lane interception); the contest on the target cell is not included.
 * `receiverId`: the teammate meant to run onto the ball; `offside` is true (and pComplete 0) when that
 * player is in an offside position right now.
 */
export function estimateThroughPass(
  state: MatchState,
  passerId: PlayerId,
  target: Vec,
  style: PassStyle = 'ground',
  receiverId?: PlayerId,
): PassEstimate {
  const passer = get(state, passerId);
  const from = passer.pos;
  const defs = enemyPositions(state, passer.team);
  const offside = receiverId ? isOffsidePosition(passer.team, get(state, receiverId).pos, from, posList(defs)) : false;
  const skills = getCharacter(passer.charId).skills;
  const distance = dist(from, target);
  const inRange = !vecEq(from, target) && distance <= passMaxDistance(skills, style);
  const base = passAccuracy(distance, getEffectiveStats(state, passer).pass, skills, style);
  const pAccurate = Math.min(RULES.pass.max, Math.max(RULES.pass.min, base - RULES.pass.spacePenalty));
  const interceptors = laneInterceptors(state, defs, from, target, style, { markers: false });
  const pIntercepted = complement(interceptors.map((i) => i.pIntercept));
  return {
    style,
    distance,
    pAccurate,
    pIntercepted,
    pComplete: inRange && !offside ? pAccurate * (1 - pIntercepted) : 0,
    interceptors,
    inRange,
    offside,
  };
}

export function isCrossValid(team: TeamId, passerPos: Vec, targetPos: Vec): boolean {
  if (!BOARD.wideColumns.includes(passerPos.x)) return false;
  if (!BOARD.centralColumns.includes(targetPos.x)) return false;
  const inZone =
    team === 'blue'
      ? targetPos.y <= BOARD.crossZoneRows - 1
      : targetPos.y >= BOARD.rows - BOARD.crossZoneRows;
  return inZone && dist(passerPos, targetPos) <= RULES.cross.maxDistance;
}

/** Enemy adjacent to `targetPos` or in the same cell with the highest aerial (tie -> lower index); enemies on `kickerPos` are ignored. */
export function aerialDefender(
  state: MatchState,
  team: TeamId,
  targetPos: Vec,
  defenders: PositionMap,
  kickerPos?: Vec,
): PlayerState | undefined {
  const adj = [...neighbors8(targetPos), targetPos];
  let best: PlayerState | undefined;
  for (const p of state.players) {
    if (p.team === team) continue;
    const pos = defenders[p.id];
    if (!pos || !adj.some((c) => vecEq(c, pos))) continue;
    if (kickerPos && vecEq(pos, kickerPos)) continue; // the kicker's cell never defends against the kick
    if (
      !best ||
      getEffectiveStats(state, p).aerial > getEffectiveStats(state, best).aerial ||
      (getEffectiveStats(state, p).aerial === getEffectiveStats(state, best).aerial && p.index < best.index)
    )
      best = p;
  }
  return best;
}

export function estimateCross(
  state: MatchState,
  passerId: PlayerId,
  targetId: PlayerId,
  passerPos?: Vec,
  targetPos?: Vec,
  defenderPositions?: PositionMap,
): CrossEstimate {
  const passer = get(state, passerId);
  const target = get(state, targetId);
  const from = passerPos ?? passer.pos;
  const to = targetPos ?? target.pos;
  const defs = defenderPositions ?? enemyPositions(state, passer.team);
  const distance = dist(from, to);
  const valid = isCrossValid(passer.team, from, to);
  const offside = isOffsidePosition(passer.team, to, from, posList(defs));
  const pDelivery = crossDelivery(distance, getEffectiveStats(state, passer).cross);
  const defender = aerialDefender(state, passer.team, to, defs, from);
  const tSkills = getCharacter(target.charId).skills;
  const pWinAerial = defender
    ? aerialWinProbability(
        getEffectiveStats(state, target).aerial,
        getEffectiveStats(state, defender).aerial,
        tSkills,
        getCharacter(defender.charId).skills,
      )
    : 1;
  const gd = dist(to, goalTarget(passer.team));
  const pHeaderGoal =
    gd > RULES.cross.header.maxDistance ? 0 : headerGoalProbability(gd, getEffectiveStats(state, target).aerial);
  return {
    distance,
    pDelivery,
    valid,
    offside,
    defenderId: defender?.id,
    pWinAerial,
    pHeaderGoal,
    pGoal: offside ? 0 : pDelivery * pWinAerial * pHeaderGoal,
  };
}
