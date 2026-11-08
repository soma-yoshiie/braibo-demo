import type { Vec } from '../types';
import { BOARD } from './config';

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function vecEq(a: Vec, b: Vec): boolean {
  return a.x === b.x && a.y === b.y;
}

export function inBounds(p: Vec): boolean {
  return (
    Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < BOARD.cols && p.y >= 0 && p.y < BOARD.rows
  );
}

/** In-bounds 8-neighbours, ordered row by row (dy -1..1, dx -1..1). */
export function neighbors8(p: Vec): Vec[] {
  const out: Vec[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const q = { x: p.x + dx, y: p.y + dy };
      if (inBounds(q)) out.push(q);
    }
  }
  return out;
}

/**
 * Perpendicular distance from `p` to the infinite line from->to, and the
 * projection parameter t (0 at `from`, 1 at `to`).
 */
export function laneOffset(p: Vec, from: Vec, to: Vec): { offset: number; t: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { offset: dist(p, from), t: 0 };
  const px = p.x - from.x;
  const py = p.y - from.y;
  const t = (px * dx + py * dy) / len2;
  const offset = Math.abs(px * dy - py * dx) / Math.sqrt(len2);
  return { offset, t };
}

const EPS = 1e-9;

/**
 * All board cells strictly between from and to (0 < t < 1), within `laneWidth`
 * of the line, excluding `from`/`to` cells. Sorted by t ascending.
 * `to` may be off-board (goal target).
 */
export function cellsOnSegment(
  from: Vec,
  to: Vec,
  laneWidth: number,
): { cell: Vec; offset: number; t: number }[] {
  const out: { cell: Vec; offset: number; t: number }[] = [];
  for (let y = 0; y < BOARD.rows; y++) {
    for (let x = 0; x < BOARD.cols; x++) {
      const cell = { x, y };
      if (vecEq(cell, from) || vecEq(cell, to)) continue;
      const { offset, t } = laneOffset(cell, from, to);
      if (t > EPS && t < 1 - EPS && offset <= laneWidth + EPS) out.push({ cell, offset, t });
    }
  }
  out.sort((a, b) => a.t - b.t || a.offset - b.offset);
  return out;
}
