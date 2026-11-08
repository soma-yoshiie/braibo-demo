import { BOARD } from '../../game/rules/config';

export const VIEW = { x: -0.3, y: -1.1, w: BOARD.cols + 0.6, h: BOARD.rows + 2.2 } as const;
export const VIEWBOX = `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`;

/** Cell coordinate -> svg center coordinate (identity + 0.5, cells are 1 unit). */
export const cx = (x: number): number => x + 0.5;
export const cy = (y: number): number => y + 0.5;

export const GOAL_WIDTH = 2;
export const GOAL_DEPTH = 0.75;
export const goalLeft = (): number => BOARD.goalX + 0.5 - GOAL_WIDTH / 2;

/** Shorten the segment a->b at the end by `by` units (for arrow heads). */
export function shorten(
  a: { x: number; y: number },
  b: { x: number; y: number },
  by: number,
): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6 || len <= by) return { x: a.x, y: a.y };
  return { x: b.x - (dx / len) * by, y: b.y - (dy / len) * by };
}
