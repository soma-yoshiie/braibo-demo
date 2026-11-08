import type {
  CrossEstimate,
  MatchState,
  PassEstimate,
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

/** Shared lane/accuracy computation for player-targeted and space passes. */
function passEstimate(
  state: MatchState,
  passer: PlayerState,
  from: Vec,
  to: Vec,
  defs: PositionMap,
  penalty: number,
): PassEstimate {
  const skills = getCharacter(passer.charId).skills;
  const distance = dist(from, to);
  const inRange = distance <= passMaxDistance(skills);
  let pAccurate = passAccuracy(distance, getEffectiveStats(state, passer).pass, skills);
  if (penalty > 0) pAccurate = Math.min(RULES.pass.max, Math.max(RULES.pass.min, pAccurate - penalty));
  const interceptors = onLane(state, defs, from, to, RULES.pass.laneWidth).map(({ player, offset }) => ({
    playerId: player.id,
    pIntercept: interceptProbability(getEffectiveStats(state, player).intercept, offset),
  }));
  const pIntercepted = complement(interceptors.map((i) => i.pIntercept));
  return {
    distance,
    pAccurate,
    pIntercepted,
    pComplete: inRange ? pAccurate * (1 - pIntercepted) : 0,
    interceptors,
    inRange,
  };
}

export function estimatePass(
  state: MatchState,
  passerId: PlayerId,
  targetId: PlayerId,
  passerPos?: Vec,
  targetPos?: Vec,
  defenderPositions?: PositionMap,
): PassEstimate {
  const passer = get(state, passerId);
  const target = get(state, targetId);
  const defs = defenderPositions ?? enemyPositions(state, passer.team);
  return passEstimate(state, passer, passerPos ?? passer.pos, targetPos ?? target.pos, defs, 0);
}

/** Pass aimed at a cell. Accuracy carries RULES.pass.spacePenalty; pComplete is 0 out of range or when target == passer cell. */
export function estimateSpacePass(
  state: MatchState,
  passerId: PlayerId,
  target: Vec,
  passerPos?: Vec,
  defenderPositions?: PositionMap,
): PassEstimate {
  const passer = get(state, passerId);
  const from = passerPos ?? passer.pos;
  const defs = defenderPositions ?? enemyPositions(state, passer.team);
  const e = passEstimate(state, passer, from, target, defs, RULES.pass.spacePenalty);
  if (vecEq(from, target)) return { ...e, inRange: false, pComplete: 0 };
  return e;
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

/** Enemy adjacent to `targetPos` with the highest aerial (tie -> lower index). */
export function aerialDefender(
  state: MatchState,
  team: TeamId,
  targetPos: Vec,
  defenders: PositionMap,
): PlayerState | undefined {
  const adj = neighbors8(targetPos);
  let best: PlayerState | undefined;
  for (const p of state.players) {
    if (p.team === team) continue;
    const pos = defenders[p.id];
    if (!pos || !adj.some((c) => vecEq(c, pos))) continue;
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
  const pDelivery = crossDelivery(distance, getEffectiveStats(state, passer).cross);
  const defender = aerialDefender(state, passer.team, to, defs);
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
    defenderId: defender?.id,
    pWinAerial,
    pHeaderGoal,
    pGoal: pDelivery * pWinAerial * pHeaderGoal,
  };
}
