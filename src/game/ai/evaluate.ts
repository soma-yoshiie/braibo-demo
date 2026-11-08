import type { MatchState, PlayerState, TeamId, Vec } from '../types';
import { BOARD, forwardDir } from '../rules/config';
import { vecEq } from '../rules/geometry';
import { estimateShot } from '../rules/estimates';
import { getCharacter } from '../data/characters';

/** All tunable AI numbers live here. Values are roughly "expected goals" units. */
export const AI_WEIGHTS = {
  progress: 0.05, // per row of advancement toward the enemy goal
  central: 0.08, // striker / long shooter prefer the middle column
  wide: 0.08, // wing prefers the flanks in the attacking half
  adjacentEnemy: 0.15, // per enemy touching the cell
  crowding: 0.1, // per teammate touching the cell
  xg: 1.5, // weight of the shot chance from the cell
  reach: 0.1, // being a passing option for the carrier
  defenderAnchor: 0.06, // physicalDefender: per row away from its home line
  defenderHomeRow: 3.5, // home line, in advancement rows
  shotScale: 4, // value of 1.0 goal probability when comparing ball actions
  crossScale: 1.2,
  crossBonus: 0.3,
  backwardPass: 0.1,
  danger: 0.25, // risk of an enemy reaching the cell next turn
  dangerAdjacent: 0.15,
  press: 1.5, // presser: guessing the carrier's cell
  pressCloser: 0.05, // presser: per cell of distance gained
  shotRisk: 4, // defenders: expected enemy goal chance
  lane: 0.5, // defenders: standing on the pass lane
  goalSide: 0.15,
  defenderLeash: 0.25, // physicalDefender straying from own goal
  looseBall: 1, // loose-ball chaser bonus
  freeAdvance: 0.08, // extra per-row progress when nobody can reach the cell
  nearShootFactor: 0.6, // shoot threshold multiplier within 3 cells of goal
  passForward: 0.1, // per row a pass target is ahead of the passer
  crossLoss: 1, // possession-loss penalty for a lost aerial
  crossMinAerial: 0.35,
  crossMargin: 0.3,
  receiverRisk: 3, // defenders: expected goals via a pass to a receiver
  mark: 0.6, // defenders: standing next to the top receiver
} as const;

export const key = (v: Vec): string => `${v.x},${v.y}`;

/** Rows advanced toward the enemy goal: 0 (own end line) .. rows-1 (enemy end line). */
export function advancement(team: TeamId, pos: Vec): number {
  return forwardDir(team) === -1 ? BOARD.rows - 1 - pos.y : pos.y;
}

export function chebyshev(a: Vec, b: Vec): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function countNear(pos: Vec, others: Iterable<Vec>): number {
  let n = 0;
  for (const o of others) if (!vecEq(o, pos) && chebyshev(pos, o) <= 1) n++;
  return n;
}

/**
 * Attacking value of `player` standing on `pos`.
 * @param mates planned/current positions of the OTHER teammates
 * @param foes current enemy positions
 */
export function positionValue(
  state: MatchState,
  player: PlayerState,
  pos: Vec,
  mates: Vec[],
  foes: Vec[],
  anchor: Vec,
): number {
  const W = AI_WEIGHTS;
  const adv = advancement(player.team, pos);
  const role = getCharacter(player.charId).role;
  let v = 0;
  if (role === 'physicalDefender') {
    v -= W.defenderAnchor * Math.abs(adv - W.defenderHomeRow) + 0.03 * Math.abs(pos.x - BOARD.goalX);
  } else {
    v += W.progress * adv;
  }
  if (role === 'striker' || role === 'longShooter') v += W.central * (1 - Math.abs(pos.x - BOARD.goalX) / 3);
  if (role === 'wing' && adv >= 5 && BOARD.wideColumns.includes(pos.x)) v += W.wide;
  v -= W.adjacentEnemy * countNear(pos, foes);
  v -= W.crowding * countNear(pos, mates);
  v += W.xg * estimateShot(state, player.id, pos).pGoal;
  const d = Math.hypot(pos.x - anchor.x, pos.y - anchor.y);
  if (d >= 2 && d <= 6) v += W.reach;
  return v;
}
