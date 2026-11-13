import type { ThroughPassMode, BallState, MatchState, PlayerId, TeamId, TeamPlan, TurnPlans, Vec } from './types';
import { createMatch } from './engine/match';

/**
 * Build a scene: unspecified players are parked out of the way
 * (blue in column 0, rows 0..4; red in column 6, rows 9..5).
 * v0.8: `trap` and `halves` default to FALSE here (not to the game defaults), so the v0.4-v0.7 unit scenes keep
 * their meaning (no half-time reset at turn 10, no AI trap declarations). Tests of the new rules opt in explicitly.
 */
export function scene(
  positions: Record<PlayerId, Vec>,
  ball: BallState,
  opts: { turn?: number; maxTurns?: number; throughPass?: ThroughPassMode; trap?: boolean; halves?: boolean; firstKickoff?: TeamId; trapReady?: Record<TeamId, number>; flags?: Record<PlayerId, { wonBallTurn?: number; receivedPassTurn?: number }> } = {},
): MatchState {
  const base = createMatch({
    maxTurns: opts.maxTurns,
    throughPass: opts.throughPass,
    trap: opts.trap ?? false,
    halves: opts.halves ?? false,
    ...(opts.firstKickoff ? { firstKickoff: opts.firstKickoff } : {}),
  });
  return {
    ...base,
    turn: opts.turn ?? 1,
    ...(opts.trapReady ? { trapReady: opts.trapReady } : {}),
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
