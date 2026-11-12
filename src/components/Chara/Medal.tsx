import { useId } from 'react';
import { GOLD, GOLD_LO, INK, TEAM, type TeamId } from './palette';
import { BustContent } from './Bust';
import type { CharaLook } from './lookTypes';

const RAYS = (() => {
  let d = '';
  for (let i = 0; i < 12; i++) {
    const a1 = (i * 2 * Math.PI) / 12, a2 = a1 + Math.PI / 12;
    d += `M50 52 L${(50 + 80 * Math.cos(a1)).toFixed(1)} ${(52 + 80 * Math.sin(a1)).toFixed(1)} L${(50 + 80 * Math.cos(a2)).toFixed(1)} ${(52 + 80 * Math.sin(a2)).toFixed(1)}Z `;
  }
  return d;
})();

export interface MedalCoreProps {
  look: CharaLook;
  team: TeamId;
  number: number;
  abbr: string;
  rarity?: 3 | 4 | 5;
  /** 軽量描画（フィルター・ハーフトーンなし） */
  light?: boolean;
}

const spark = (x: number, y: number, r: number): string =>
  `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`;

/** 丸い顔アイコンの中身（中心 50,50、縁の半径 49）。 */
export function MedalCore({ look, team, number, abbr, rarity = 3, light = false }: MedalCoreProps) {
  const id = useId().replace(/:/g, '');
  const c = TEAM[team];
  const numStr = String(number);
  return (
    <>
      <defs>
        <radialGradient id={`${id}bg`} cx=".5" cy=".4" r=".75">
          <stop offset="0" stopColor={c.b1} /><stop offset=".45" stopColor={c.b2} /><stop offset="1" stopColor={c.b3} />
        </radialGradient>
        <linearGradient id={`${id}rg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6c0" /><stop offset=".35" stopColor={GOLD} /><stop offset="1" stopColor={GOLD_LO} />
        </linearGradient>
        <linearGradient id={`${id}rb`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.light} /><stop offset="1" stopColor={c.jerD} />
        </linearGradient>
        <linearGradient id={`${id}gl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".6" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}c`}><circle cx="50" cy="50" r="41.5" /></clipPath>
        {!light && (
          <>
            <filter id={`${id}sh`} x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.5" /></filter>
            <pattern id={`${id}ht`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="2.5" cy="2.5" r="1.1" fill="#fff" /></pattern>
          </>
        )}
      </defs>
      {/* 影 */}
      {light
        ? <ellipse cx="50" cy="104" rx="30" ry="4" fill="#000" opacity=".3" />
        : <ellipse cx="50" cy="104" rx="34" ry="5.5" fill="#000" opacity=".4" filter={`url(#${id}sh)`} />}
      {/* 縁 */}
      <circle cx="50" cy="50" r="49" fill={INK} />
      <circle cx="50" cy="50" r="46.5" fill={`url(#${id}rg)`} />
      <circle cx="50" cy="50" r="43" fill={INK} />
      <g clipPath={`url(#${id}c)`}>
        <circle cx="50" cy="50" r="42" fill={`url(#${id}bg)`} />
        <path d={RAYS} fill="#fff" opacity=".2" />
        {!light && <circle cx="50" cy="50" r="42" fill={`url(#${id}ht)`} opacity=".35" />}
        <g transform="translate(50 56) scale(1.13) translate(-50 -47)">
          <BustContent look={look} team={team} small />
        </g>
        <ellipse cx="38" cy="22" rx="30" ry="16" fill={`url(#${id}gl)`} transform="rotate(-24 38 22)" opacity=".5" />
      </g>
      <path d="M12 38 A40 40 0 0 1 34 14" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".6" />
      {rarity === 5 && <path d={`${spark(10, 28, 6)} ${spark(92, 66, 4.5)}`} fill="#fff" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />}
      {/* 背番号 */}
      <circle cx="84" cy="17" r="15.5" fill={INK} />
      <circle cx="84" cy="17" r="12.6" fill={`url(#${id}rg)`} />
      <circle cx="84" cy="17" r="10.2" fill={INK} />
      <text x="84" y={numStr.length > 1 ? 22.8 : 23.6} textAnchor="middle" fontSize={numStr.length > 1 ? 15.5 : 18} fill="#fff"
        style={{ fontFamily: "var(--font-num, 'Bebas Neue'), 'Arial Narrow', sans-serif" }}>{numStr}</text>
      {/* ロールの札 */}
      <path d="M31 84 H74 L70 102 H27 Z" fill={INK} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M31 85.5 H72.4 L69 100.5 H28.6 Z" fill={`url(#${id}rb)`} />
      <path d="M31 85.5 H72.4 L71.6 89 H30.2Z" fill="#fff" opacity=".4" />
      <text x="50" y="98" textAnchor="middle" fontSize="12.5" fill="#fff" letterSpacing=".5"
        style={{ fontFamily: "var(--font-head, 'Dela Gothic One'), sans-serif" }}>{abbr}</text>
    </>
  );
}

export interface BallSpec {
  /** ボールを持っている（左下にボール、周りに光） */
  ball?: boolean;
}

export interface CharaMedalProps extends BallSpec {
  look: CharaLook;
  team: TeamId;
  number: number;
  abbr: string;
  rarity?: 3 | 4 | 5;
  className?: string;
}

export function CharaMedal({ look, team, number, abbr, rarity, ball = false, className }: CharaMedalProps) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="-6 -6 112 118" className={className} width="100%" height="100%" aria-hidden="true">
      {ball && (
        <>
          <defs>
            <radialGradient id={`${id}au`}>
              <stop offset="0" stopColor="#fff7b8" stopOpacity=".95" /><stop offset=".45" stopColor={GOLD} stopOpacity=".55" /><stop offset="1" stopColor="#ffb000" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="66" fill={`url(#${id}au)`} />
        </>
      )}
      <MedalCore look={look} team={team} number={number} abbr={abbr} rarity={rarity} />
      {ball && <g transform="translate(14 78)"><BallDraw r={13} /></g>}
    </svg>
  );
}

/** ピッチの SVG に置く版。中心 (50,50)、縁の半径 49。フィルターなし。 */
export function CharaMedalG({ look, team, number, abbr, rarity }: Omit<CharaMedalProps, 'className' | 'ball'>) {
  return (
    <g>
      <MedalCore look={look} team={team} number={number} abbr={abbr} rarity={rarity} light />
    </g>
  );
}

// ---- ボール ----
function BallDraw({ r }: { r: number }) {
  const id = useId().replace(/:/g, '');
  const pt = (a: number, k: number): [number, number] => [Math.cos(a) * r * k, Math.sin(a) * r * k];
  const angles = [0, 1, 2, 3, 4].map((i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5);
  const pent = angles.map((a) => pt(a, 0.36).map((v) => v.toFixed(1)).join(',')).join(' ');
  let spokes = '';
  const dots: [number, number][] = [];
  for (const a of angles) {
    const [x1, y1] = pt(a, 0.36), [x2, y2] = pt(a, 0.78);
    spokes += `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} `;
    dots.push(pt(a + 0.63, 0.98));
  }
  return (
    <g>
      <defs>
        <radialGradient id={`${id}g`} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#fff" /><stop offset=".6" stopColor="#f1f4ff" /><stop offset="1" stopColor="#b5bfdc" />
        </radialGradient>
        <clipPath id={`${id}c`}><circle cx="0" cy="0" r={r} /></clipPath>
      </defs>
      <circle cx="0" cy="0" r={r} fill={`url(#${id}g)`} />
      <g clipPath={`url(#${id}c)`}>
        <path d={spokes} stroke={INK} strokeWidth={(r * 0.09).toFixed(2)} />
        {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r * 0.24} fill={INK} />)}
        <polygon points={pent} fill={INK} />
      </g>
      <circle cx="0" cy="0" r={r} fill="none" stroke={INK} strokeWidth={(r * 0.16).toFixed(2)} />
    </g>
  );
}

/** 0,0 を中心に半径 r で描くサッカーボール（フィルターなし）。 */
export function BallG({ r = 10 }: { r?: number }) {
  return <BallDraw r={r} />;
}
