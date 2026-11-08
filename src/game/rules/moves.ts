import type { MatchState, PlayerId, PlayerState, Stats, TeamPlan, Vec } from '../types';
import { RULES, forwardDir } from './config';
import { getCharacter } from '../data/characters';
import { inBounds, vecEq } from './geometry';

function find(state: MatchState, id: PlayerId): PlayerState {
  const p = state.players.find((q) => q.id === id);
  if (!p) throw new Error(`Unknown player: ${id}`);
  return p;
}

/** Base stats (hook for future buffs; skills act through the probability functions). */
export function getEffectiveStats(_state: MatchState, player: PlayerState): Stats {
  return { ...getCharacter(player.charId).stats };
}

/** `counter`: +range on the turn after winning the ball. */
export function effectiveMoveRangeBonus(state: MatchState, player: PlayerState): number {
  const has = getCharacter(player.charId).skills.includes('counter');
  return has && player.flags.wonBallTurn === state.turn - 1 ? RULES.skills.counterExtraRange : 0;
}

/** Geometrically reachable cells (never the current cell). Pieces do not block. */
export function legalMoveTargets(state: MatchState, playerId: PlayerId): Vec[] {
  const player = find(state, playerId);
  const def = getCharacter(player.charId);
  const bonus = effectiveMoveRangeBonus(state, player);
  // Blue: dy as-is (forward = -1). Red: mirrored.
  const mirror = -forwardDir(player.team);
  const seen = new Set<string>();
  const out: Vec[] = [];
  for (const step of def.moves) {
    const range = step.range + bonus;
    for (let k = 1; k <= range; k++) {
      const p = { x: player.pos.x + step.dx * k, y: player.pos.y + step.dy * mirror * k };
      if (!inBounds(p) || vecEq(p, player.pos)) continue;
      const key = `${p.x},${p.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

/** Legal targets minus cells reserved by teammates (planned dest or staying position). */
export function availableMoveTargets(state: MatchState, plan: TeamPlan, playerId: PlayerId): Vec[] {
  const player = find(state, playerId);
  const reserved = new Set<string>();
  for (const mate of state.players) {
    if (mate.team !== player.team || mate.id === playerId) continue;
    const d = plan.moves[mate.id] ?? mate.pos;
    reserved.add(`${d.x},${d.y}`);
  }
  return legalMoveTargets(state, playerId).filter((p) => !reserved.has(`${p.x},${p.y}`));
}

export function isLegalMove(state: MatchState, playerId: PlayerId, to: Vec): boolean {
  const player = find(state, playerId);
  if (vecEq(player.pos, to)) return true;
  return legalMoveTargets(state, playerId).some((p) => vecEq(p, to));
}
