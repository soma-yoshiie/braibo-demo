import type { MoveStep } from '../../game/types';
import './Shell.css';

const N = 5;
const C = 2;
const S = 14;

/** 移動できるマスの小さな図。上が前。 */
export function MoveDiagram({ moves, size = 78, caption = '進める範囲' }: { moves: MoveStep[]; size?: number; caption?: string | null }) {
  const reach = new Set<string>();
  const far = new Set<string>();
  for (const m of moves) {
    for (let k = 1; k <= m.range; k++) {
      const x = C + m.dx * k;
      const y = C + m.dy * k;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      reach.add(`${x},${y}`);
      if (k === m.range) far.add(`${x},${y}`);
    }
  }
  return (
    <div className="mdia">
      <svg viewBox={`0 0 ${N * S + 2} ${N * S + 2}`} width={size} height={size} role="img" aria-label="移動できるマス">
        <rect x="0" y="0" width={N * S + 2} height={N * S + 2} rx="4" fill="#1a8a4a" stroke="#151a2d" strokeWidth="2" />
        {Array.from({ length: N * N }, (_, i) => {
          const x = i % N;
          const y = Math.floor(i / N);
          const key = `${x},${y}`;
          const on = reach.has(key);
          return (
            <rect
              key={key}
              x={1 + x * S + 0.8}
              y={1 + y * S + 0.8}
              width={S - 1.6}
              height={S - 1.6}
              rx="2"
              fill={on ? '#9ceaff' : 'rgba(255,255,255,.08)'}
              stroke={far.has(key) ? '#fff' : 'none'}
              strokeWidth="1.2"
            />
          );
        })}
        <circle cx={1 + C * S + S / 2} cy={1 + C * S + S / 2} r="5.2" fill="#ffd34d" stroke="#151a2d" strokeWidth="1.8" />
        <path d={`M${1 + C * S + S / 2} ${1 + 1.5} l-4 5 h8z`} fill="#fff" stroke="#151a2d" strokeWidth="1" strokeLinejoin="round" />
      </svg>
      {caption && <span className="mdia__cap">{caption}</span>}
    </div>
  );
}
