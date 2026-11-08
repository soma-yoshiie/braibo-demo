import { describe, expect, it } from 'vitest';
import { BOARD } from '../../game/rules/config';
import { radialLayout } from './pitchGeometry';

describe('radialLayout', () => {
  it('never overlaps and stays on board for 6 items from every cell', () => {
    for (let y = 0; y < BOARD.rows; y++) {
      for (let x = 0; x < BOARD.cols; x++) {
        for (const n of [2, 4, 6]) {
          const pos = radialLayout({ x, y }, n);
          expect(pos).toHaveLength(n);
          for (let i = 0; i < n; i++) {
            expect(pos[i].x).toBeGreaterThanOrEqual(-0.1 - 1e-9);
            expect(pos[i].x).toBeLessThanOrEqual(BOARD.cols - 0.9 + 1e-9);
            expect(pos[i].y).toBeGreaterThanOrEqual(-0.6 - 1e-9);
            expect(pos[i].y).toBeLessThanOrEqual(BOARD.rows - 0.4 + 1e-9);
            for (let j = i + 1; j < n; j++) {
              expect(Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y)).toBeGreaterThanOrEqual(0.8 - 1e-9);
            }
          }
        }
      }
    }
  });

  it('avoids move-target cells when a free slot exists', () => {
    const targets = [
      { x: 3, y: 4 },
      { x: 4, y: 5 },
      { x: 2, y: 5 },
    ];
    const pos = radialLayout({ x: 3, y: 5 }, 3, { targets });
    for (const p of pos) for (const t of targets) expect(Math.hypot(p.x - t.x, p.y - t.y)).toBeGreaterThanOrEqual(0.85);
  });
});
