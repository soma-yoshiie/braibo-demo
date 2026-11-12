import { useId } from 'react';
import { GOLD, INK, TEAM, type TeamId } from './palette';

const starPts = (cx: number, cy: number, r: number): string => {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(' ');
};

/** ★。rarity 個ぶん並べる。size は 1 個の高さ（px）。 */
export function Stars({ rarity, size = 14, className }: { rarity: number; size?: number; className?: string }) {
  const n = Math.max(0, Math.round(rarity));
  return (
    <svg viewBox={`0 0 ${n * 20} 20`} width={n * size} height={size} className={className} aria-label={`★${n}`} role="img">
      {Array.from({ length: n }, (_, i) => (
        <polygon key={i} points={starPts(i * 20 + 10, 10.5, 9)} fill={GOLD} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** チームの紋章。青は稲妻、赤は炎。size は幅（px）。 */
export function Crest({ team, size = 28, className }: { team: TeamId; size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const c = TEAM[team];
  return (
    <svg viewBox="-15 -16 30 36" width={size} height={(size * 36) / 30} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.light} /><stop offset="1" stopColor={c.jerD} /></linearGradient>
      </defs>
      <path d="M-13 -14 H13 V3 C13 11 6 16 0 18 C-6 16 -13 11 -13 3Z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M-11 -12 H11 V3 C11 9.5 5 14 0 15.8 C-5 14 -11 9.5 -11 3Z" fill={`url(#${id})`} stroke={GOLD} strokeWidth="1.8" />
      {team === 'blue' ? (
        <path d="M6 -9 L-4 1 L1 1 L-5 11 L7 -1 L1 -1 Z" fill="#fff" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      ) : (
        <>
          <path d="M0 -11 C4 -5 8 -2 7 4 C6 9 2 11 0 11 C-6 11 -8 5 -5 0 C-4 3 -2 3 -2 0 C-2 -4 0 -7 0 -11Z" fill="#ffe27a" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M0 2 C3 4 3 8 0 9 C-3 8 -3 5 0 2Z" fill="#ff7a1a" />
        </>
      )}
      <path d="M-11 -12 H11 V-5 C4 -3 -4 -3 -11 -5Z" fill="#fff" opacity=".35" />
    </svg>
  );
}

const speedPath = (() => {
  let d = '';
  const n = 36;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + ((i * 7) % 5) * 0.01;
    const w = 0.025 + ((i * 13) % 7) * 0.012;
    const r0 = 14 + ((i * 11) % 6) * 5;
    const R = 90;
    d += `M${(50 + r0 * Math.cos(a)).toFixed(1)} ${(50 + r0 * Math.sin(a)).toFixed(1)} L${(50 + R * Math.cos(a - w)).toFixed(1)} ${(50 + R * Math.sin(a - w)).toFixed(1)} L${(50 + R * Math.cos(a + w)).toFixed(1)} ${(50 + R * Math.sin(a + w)).toFixed(1)}Z `;
  }
  return d;
})();

/** 集中線。親いっぱいに伸びる（白、半透明）。 */
export function SpeedLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" className={className} aria-hidden="true">
      <path d={speedPath} fill="#fff" opacity=".28" />
    </svg>
  );
}

/** ギザギザの吹き出し。中身は親側で重ねる。 */
export function Starburst({ className, points = 14, fill = GOLD }: { className?: string; points?: number; fill?: string }) {
  const n = Math.max(5, points);
  const p: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? 36 : 47;
    p.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" className={className} aria-hidden="true">
      <polygon points={p.join(' ')} fill={fill} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <polygon points={p.map((s) => { const [x, y] = s.split(',').map(Number); return `${(50 + (x - 50) * 0.82).toFixed(1)},${(50 + (y - 50) * 0.82).toFixed(1)}`; }).join(' ')} fill="#fff" opacity=".3" />
    </svg>
  );
}
