import type { MatchState, PlayerState, TeamId, Vec } from '../types';
import { forwardDir, otherTeam, trapEnabled } from './config';
import { inBounds, vecEq } from './geometry';

/**
 * Offside trap (DESIGN.md §14.1). A declaration is valid only while the opponent holds the ball at
 * planning time and the re-declaration wait is over.
 */
export function canDeclareTrap(state: MatchState, team: TeamId): boolean {
  if (!trapEnabled(state) || state.phase !== 'planning') return false;
  if (state.ball.kind !== 'held') return false;
  const holderId = state.ball.playerId;
  const holder = state.players.find((p) => p.id === holderId);
  if (!holder || holder.team !== otherTeam(team)) return false;
  return trapWait(state, team) === 0;
}

/** Turns until `team` may declare again (0 = ready). Independent of who holds the ball. */
export function trapWait(state: MatchState, team: TeamId): number {
  const ready = state.trapReady?.[team] ?? 1;
  return Math.max(0, ready - state.turn);
}

/** Everyone in the team's deepest row (blue: largest y, red: smallest y). */
export function trapParticipants(state: MatchState, team: TeamId): PlayerState[] {
  const mine = state.players.filter((p) => p.team === team);
  if (mine.length === 0) return [];
  const deepest = forwardDir(team) === -1 ? Math.max(...mine.map((p) => p.pos.y)) : Math.min(...mine.map((p) => p.pos.y));
  return mine.filter((p) => p.pos.y === deepest);
}

/**
 * The step each participant takes: one row forward, except when a teammate or the ball carrier stands
 * on the cell ahead (or it is off the board), in which case `to` equals `from`.
 */
export function trapSteps(state: MatchState, team: TeamId): { playerId: string; from: Vec; to: Vec }[] {
  const dy = forwardDir(team);
  const holderId = state.ball.kind === 'held' ? state.ball.playerId : undefined;
  return trapParticipants(state, team)
    .sort((a, b) => a.index - b.index)
    .map((p) => {
      const ahead = { x: p.pos.x, y: p.pos.y + dy };
      const blocked =
        !inBounds(ahead) ||
        state.players.some((q) => q.id !== p.id && vecEq(q.pos, ahead) && (q.team === team || q.id === holderId));
      return { playerId: p.id, from: { ...p.pos }, to: blocked ? { ...p.pos } : ahead };
    });
}
