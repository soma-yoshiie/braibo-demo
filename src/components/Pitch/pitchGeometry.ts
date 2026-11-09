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

export interface RadialAvoid {
  /** Move-target cell centres (cell indices). */
  targets?: { x: number; y: number }[];
  /** Other token centres (cell units, may be fractional). */
  tokens?: { x: number; y: number }[];
}

export const RADIAL_RINGS = [1.55, 2.35] as const;
export const RADIAL_MIN_GAP = 0.8;

/**
 * Greedy, collision-avoiding slot placement for the radial menu.
 * Works in cell-index units (the anchor cell index = its centre); callers add 0.5 for svg coordinates.
 * Candidate slots: two rings x 15 degree steps. Off-board slots and slots closer than 0.8 to an
 * already placed item are rejected; the rest are scored by angular distance from the opening direction
 * (anchor -> board centre) plus penalties for covering move targets / tokens and for the outer ring.
 */
export function radialLayout(
  anchor: { x: number; y: number },
  n: number,
  avoid: RadialAvoid = {},
): { x: number; y: number }[] {
  const toCx = (BOARD.cols - 1) / 2 - anchor.x;
  const toCy = (BOARD.rows - 1) / 2 - anchor.y;
  const base = Math.atan2(toCy, toCx === 0 && toCy === 0 ? 1 : toCx);
  const targets = avoid.targets ?? [];
  const tokens = (avoid.tokens ?? []).filter((t) => Math.hypot(t.x - anchor.x, t.y - anchor.y) > 0.01);
  const onBoard = (x: number, y: number) => x >= -0.1 && x <= BOARD.cols - 0.9 && y >= -0.6 && y <= BOARD.rows - 0.4;
  type Slot = { x: number; y: number; score: number };
  const slots: Slot[] = [];
  RADIAL_RINGS.forEach((r, ri) => {
    for (let deg = -180; deg < 180; deg += 15) {
      const a = (deg * Math.PI) / 180;
      const x = anchor.x + Math.cos(a) * r;
      const y = anchor.y + Math.sin(a) * r;
      if (!onBoard(x, y)) continue;
      let diff = Math.abs(a - base);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      let score = (diff * 180) / Math.PI;
      if (targets.some((t) => Math.hypot(t.x - x, t.y - y) < 0.85)) score += 1000;
      if (tokens.some((t) => Math.hypot(t.x - x, t.y - y) < 1.0)) score += 300;
      if (ri === 1) score += 25;
      slots.push({ x, y, score });
    }
  });
  const placed: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    let best: Slot | null = null;
    for (const s of slots) {
      if (placed.some((p) => Math.hypot(p.x - s.x, p.y - s.y) < RADIAL_MIN_GAP)) continue;
      if (!best || s.score < best.score) best = s;
    }
    // unreachable for <= 6 items on a 7x10 board (unit-tested); keep a safe fallback anyway
    const pick = best ?? { x: anchor.x, y: anchor.y + 1.55, score: 0 };
    placed.push({ x: pick.x, y: pick.y });
  }
  return placed;
}

/** Rest slot of a token sharing its cell with an opponent: blue lower-left, red upper-right, 0.8x.
 *  At the left / right board edge the pair is nudged inward so both bodies stay on the pitch. */
export function restSlot(team: 'blue' | 'red', cell: { x: number; y: number }): { dx: number; dy: number; s: number } {
  const sgn = team === 'blue' ? -1 : 1;
  let dx = 0.24 * sgn;
  const body = 0.32;
  if (cell.x + 0.5 + dx - body < 0.02) dx = 0.02 + body - cell.x - 0.5;
  if (cell.x + 0.5 + dx + body > BOARD.cols - 0.02) dx = BOARD.cols - 0.02 - body - cell.x - 0.5;
  return { dx, dy: -0.17 * sgn, s: 0.8 };
}
