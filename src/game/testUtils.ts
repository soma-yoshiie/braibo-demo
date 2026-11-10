import type { ThroughPassMode, BallState, MatchState, PlayerId, TeamPlan, TurnPlans, Vec } from './types';
import { createMatch } from './engine/match';

/**
 * Build a scene: unspecified players are parked out of the way
 * (blue in column 0, rows 0..4; red in column 6, rows 9..5).
 */
export function scene(
  positions: Record<PlayerId, Vec>,
  ball: BallState,
  opts: { turn?: number; maxTurns?: number; throughPass?: ThroughPassMode; flags?: Record<PlayerId, { wonBallTurn?: number; receivedPassTurn?: number }> } = {},
): MatchState {
  const base = createMatch({ maxTurns: opts.maxTurns, throughPass: opts.throughPass });
  return {
    ...base,
    turn: opts.turn ?? 1,
    ball,
    players: base.players.map((p) => ({
      ...p,
      pos: positions[p.id] ?? (p.team === 'blue' ? { x: 0, y: p.index } : { x: 6, y: 9 - p.index }),
      flags: opts.flags?.[p.id] ?? {},
    })),
  };
}

export const held = (playerId: PlayerId): BallState => ({ kind: 'held', playerId });

export function plans(blue: Partial<TeamPlan> = {}, red: Partial<TeamPlan> = {}): TurnPlans {
  return {
    blue: { team: 'blue', moves: {}, ...blue },
    red: { team: 'red', moves: {}, ...red },
  };
}
