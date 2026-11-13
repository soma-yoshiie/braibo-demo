import type { StageDef } from '../../meta/stages';
import './Shell.css';

/** Difficulty stars: `n` of 5 filled. */
export function DiffStars({ n, size = 13 }: { n: number; size?: number }) {
  return (
    <span className="dstars" aria-label={`難しさ ${n} / 5`} style={{ fontSize: size }}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
          <polygon
            points="10,1.5 12.6,7.2 18.8,7.7 14.1,11.8 15.6,18 10,14.7 4.4,18 5.9,11.8 1.2,7.7 7.4,7.2"
            fill={i < n ? '#ffd34d' : '#2b3358'}
            stroke="#151a2d"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

/** `+n コイン` text (always in-game coins). */
export const coinText = (n: number): string => `+${n.toLocaleString('ja-JP')} コイン`;

/** Match-reward multiplier of a stage (1 when the stage has none). */
export function rewardMulOf(st: StageDef): number {
  return st.rewardMul;
}
export const mulText = (m: number): string => `報酬 ×${Number.isInteger(m) ? m : m.toFixed(1)}`;

/** Difference text when the opponent is stronger on paper (a rough guide only). */
export const behindText = (mine: number, rival: number): string | null => (rival > mine ? `あと ${rival - mine}` : null);
