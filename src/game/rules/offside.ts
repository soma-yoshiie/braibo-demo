import type { TeamId, Vec } from '../types';
import { BOARD, RULES } from './config';

/**
 * Offside judged at the moment of the kick (final positions). The receiver is offside when ALL hold:
 *  1. in the opponent half (blue: y < rows/2, red: y >= rows/2),
 *  2. strictly nearer the goal line than the ball,
 *  3. strictly nearer the goal line than the k-th last defender (k = cfg.lastDefenders).
 * False when disabled or when there are fewer than k defenders.
 */
export function isOffsidePosition(
  team: TeamId,
  receiverPos: Vec,
  ballPos: Vec,
  defenderPositions: Vec[],
  cfg: { enabled: boolean; lastDefenders: number } = RULES.offside,
): boolean {
  if (!cfg.enabled) return false;
  const k = cfg.lastDefenders;
  if (k < 1 || defenderPositions.length < k) return false;
  const half = BOARD.rows / 2;
  if (team === 'blue') {
    if (!(receiverPos.y < half)) return false;
    if (!(receiverPos.y < ballPos.y)) return false;
    const ys = defenderPositions.map((d) => d.y).sort((a, b) => a - b);
    return receiverPos.y < (ys[k - 1] as number);
  }
  if (!(receiverPos.y >= half)) return false;
  if (!(receiverPos.y > ballPos.y)) return false;
  const ys = defenderPositions.map((d) => d.y).sort((a, b) => b - a);
  return receiverPos.y > (ys[k - 1] as number);
}
