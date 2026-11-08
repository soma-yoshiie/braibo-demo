import { BOARD } from '../../game/rules/config';

/** Board is 7x10 cells; 0.6 cell of goal net above and below. Width-first fit: 7 : 11.2. */
export const GOAL_DEPTH = 0.6;
export const VIEW = { x: 0, y: -GOAL_DEPTH, w: BOARD.cols, h: BOARD.rows + GOAL_DEPTH * 2 } as const;
export const VIEWBOX = `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`;

/** Cell coordinate -> svg center coordinate (identity + 0.5, cells are 1 unit). */
export const cx = (x: number): number => x + 0.5;
export const cy = (y: number): number => y + 0.5;

export const GOAL_WIDTH = 2;
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

/** Radial menu item centres (cell-centre coordinates), opening toward the board centre. */
export function radialLayout(
  anchor: { x: number; y: number },
  n: number,
  radius = 1.6,
): { x: number; y: number }[] {
  const toCx = BOARD.cols / 2 - 0.5 - anchor.x;
  const toCy = BOARD.rows / 2 - 0.5 - anchor.y;
  const base = Math.atan2(toCy, toCx === 0 && toCy === 0 ? 1 : toCx);
  const span = n <= 1 ? 0 : n === 2 ? 80 : 180;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const deg = n <= 1 ? 0 : -span / 2 + (span * i) / (n - 1);
    const a = base + (deg * Math.PI) / 180;
    const x = cx(anchor.x) + Math.cos(a) * radius;
    const y = cy(anchor.y) + Math.sin(a) * radius;
    out.push({
      x: Math.min(BOARD.cols - 0.5, Math.max(0.5, x)),
      y: Math.min(BOARD.rows - 0.9, Math.max(0.4, y)),
    });
  }
  return out;
}
