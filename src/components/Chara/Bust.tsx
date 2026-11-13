import { useId } from 'react';
import { GOLD, INK, SKIN, TEAM, type TeamId } from './palette';
import { HAIR, mirrorPath, type HairShape } from './hair';
import type { CharaLook, EyeId } from './lookTypes';

export type Expression = 'normal' | 'win' | 'lose';

const useUid = (): string => useId().replace(/:/g, '');

interface EyeDef {
  outline: string; // 左目（見る側の左）の輪郭
  iris: [number, number, number, number]; // cx cy rx ry
  lid: string; // 上まぶたの太線
  lidW: number;
  brow: [number, number]; // 外側 / 内側の y（normal）
  mouth: string;
  strokes: { y1: number; y2: number; w: number }; // 小サイズ時の線
}
const EYES: Record<EyeId, EyeDef> = {
  sharp: { outline: 'M32 50 L38 46 L47 47.8 L46 52.8 L38 53.8 Z', iris: [41.5, 50.2, 3.9, 4.6], lid: 'M31.5 50 L38 45.6 L47.5 47.4', lidW: 2.2, brow: [43.2, 44.6], mouth: 'M45.5 62 Q50 64.6 55 61.5', strokes: { y1: 50, y2: 51.4, w: 3.6 } },
  stern: { outline: 'M32 49 L39 47.2 L47 48.6 L46 52.6 L38.5 53.4 Z', iris: [41.8, 50.4, 3.3, 3.5], lid: 'M31.5 49 L39 46.6 L47.5 48.2', lidW: 2.8, brow: [41.2, 46.2], mouth: 'M45 62.5 H55', strokes: { y1: 50, y2: 51.6, w: 4.2 } },
  round: { outline: 'M32.5 50 Q33.5 44.8 40 44.6 Q46.8 44.8 47 50.2 Q46.5 55.6 40 55.8 Q33.5 55.4 32.5 50 Z', iris: [40, 50.2, 5, 5.4], lid: 'M32 49 Q34 44.2 40 44.2 Q46 44.2 47.6 49.5', lidW: 1.8, brow: [42, 42.6], mouth: 'M45 61.6 Q50 65.4 55 61.6', strokes: { y1: 50.5, y2: 50.5, w: 3 } },
  narrow: { outline: 'M32 50.8 Q39 46.6 47.4 49.6 Q41 53.6 32 50.8 Z', iris: [40.5, 50.2, 3.1, 3.2], lid: 'M31.4 50.8 Q39 45.6 47.8 49.4', lidW: 2.6, brow: [43.6, 45.2], mouth: 'M45.5 62.6 Q50 63.8 54.5 62', strokes: { y1: 50, y2: 52, w: 3 } },
};

interface Props { look: CharaLook; team: TeamId; expression?: Expression; small?: boolean; sw?: number; halo?: boolean }

/** 胸像の中身（0..100 空間、defs 込み）。Bust / BustG / Medal が共有する。 */
export function BustContent({ look, team, expression = 'normal', small = false, sw, halo = false }: Props) {
  const id = useUid();
  const c = TEAM[team];
  const H = HAIR[look.hair];
  const skin = SKIN[look.skin];
  const rx = H.rx;
  const w = sw ?? (small ? 3.1 : 2.4);
  const E = EYES[look.eyes];
  const hairD = (a: HairShape[]): string => a.map((s) => s.d).join(' ');

  const hairShapes = (a: HairShape[]) =>
    a.map((s, i) => (
      <g key={i}>
        {s.cloud && <path d={s.d} fill="none" stroke={INK} strokeWidth={w * 2} strokeLinejoin="round" />}
        <path d={s.d} fill={look.hairColor} stroke={s.cloud ? 'none' : INK} strokeWidth={s.stub ? w * 0.6 : w} strokeLinejoin="round" />
        {s.stub && <path d={s.d} fill="#000" opacity=".5" />}
      </g>
    ));
  const shade = (clip: string) => (
    <g clipPath={`url(#${id}${clip})`}>
      <polygon points="0,0 38,0 30,100 0,100" fill="#000" opacity=".28" />
      <polygon points="74,0 100,0 100,100 82,100" fill={c.rim} opacity=".4" />
      <path d={H.hl} stroke={look.hairHi} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity=".9" />
    </g>
  );

  // ---- 目 ----
  const by = expression === 'win' ? [E.brow[0] - 1.8, E.brow[1] - 1.8]
    : expression === 'lose' ? [E.brow[0] + 2.2, E.brow[1] - 3.4] : E.brow;
  const bw = small ? 3.3 : 2.9;
  const browD = look.eyes === 'round' && expression !== 'lose'
    ? `M30.5 ${by[0] + 1.2} Q38 ${by[0] - 2.2} 46 ${by[1]}`
    : `M30.5 ${by[0]} L46 ${by[1]}`;
  const brows = (
    <>
      <path d={browD} stroke={INK} strokeWidth={bw} strokeLinecap="round" fill="none" />
      <path d={mirrorPath(browD)} stroke={INK} strokeWidth={bw} strokeLinecap="round" fill="none" />
    </>
  );
  const eyeOne = (m: boolean) => {
    const o = m ? mirrorPath(E.outline) : E.outline;
    const [ix, iy, irx, iry] = E.iris;
    const X = (x: number) => (m ? 100 - x : x);
    return (
      <g key={m ? 'r' : 'l'}>
        <path d={o} fill="#fff" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
        <clipPath id={`${id}e${m ? 1 : 0}`}><path d={o} /></clipPath>
        <g clipPath={`url(#${id}e${m ? 1 : 0})`}>
          <ellipse cx={X(ix)} cy={iy} rx={irx} ry={iry} fill={look.eyeColor} />
          <ellipse cx={X(ix)} cy={iy + 0.7} rx={irx * 0.55} ry={iry * 0.65} fill={INK} />
          <rect x="0" y="43" width="100" height="3.4" fill="#000" opacity=".16" />
        </g>
        <circle cx={X(ix + 1.4)} cy={iy - 1.7} r="1.25" fill="#fff" />
        {expression === 'win' && <circle cx={X(ix - 1.6)} cy={iy + 1.6} r=".7" fill="#fff" />}
        <path d={m ? mirrorPath(E.lid) : E.lid} fill="none" stroke={INK} strokeWidth={E.lidW} strokeLinejoin="round" strokeLinecap="round" />
      </g>
    );
  };
  const strokeEyes = (
    <>
      <path d={`M34 ${E.strokes.y1} L46 ${E.strokes.y2}`} stroke={INK} strokeWidth={E.strokes.w} strokeLinecap="round" />
      <path d={`M66 ${E.strokes.y1} L54 ${E.strokes.y2}`} stroke={INK} strokeWidth={E.strokes.w} strokeLinecap="round" />
    </>
  );
  const eyes = small ? strokeEyes : <>{eyeOne(false)}{eyeOne(true)}</>;

  // ---- 口 ----
  let mouth;
  if (expression === 'win') {
    mouth = (
      <g>
        <path d="M43.5 59.8 Q50 67.4 56.5 59.8 Z" fill="#7a1f2b" stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M44.6 60.4 H55.4 V62 Q50 63.4 44.6 62 Z" fill="#fff" />
      </g>
    );
  } else if (expression === 'lose') {
    mouth = <path d="M44 62.4 L46.6 61 L49 63 L51.4 61 L54 63 L56 61.6" stroke={skin.mouth} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  } else {
    mouth = <path d={E.mouth} stroke={skin.mouth} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
  }

  // ---- 小物 ----
  const x0 = 50 - H.hw, x1 = 50 + H.hw;
  const headband = look.extra === 'headband' && (
    <g>
      <path d={`M${x1 - 2} 38 L${x1 + 19} 30 L${x1 + 14} 40 L${x1 + 21} 47 L${x1 - 2} 45Z`} fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d={`M${x0} 33 Q50 25 ${x1} 33 L${x1} 42 Q50 34 ${x0} 42Z`} fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d={`M${x0 + 1} 37.5 Q50 29.5 ${x1 - 1} 37.5`} stroke={c.main} strokeWidth="3.2" fill="none" />
    </g>
  );
  const glasses = look.extra === 'glasses' && (
    <g>
      <rect x="31" y="43.5" width="17" height="12" rx="3.4" fill="#bfe6ff" fillOpacity=".35" stroke={INK} strokeWidth={small ? 2.4 : 2} />
      <rect x="52" y="43.5" width="17" height="12" rx="3.4" fill="#bfe6ff" fillOpacity=".35" stroke={INK} strokeWidth={small ? 2.4 : 2} />
      <path d="M48 47.5 H52" stroke={INK} strokeWidth="2" />
      <path d="M31 46 L26 44.5 M69 46 L74 44.5" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M34.5 46.6 L39 46.6 M55.5 46.6 L60 46.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
  const bandage = look.extra === 'bandage' && (
    <g transform="rotate(-22 61 57)">
      <rect x="53.5" y="53" width="15" height="7.4" rx="2" fill="#f6e7c4" stroke={INK} strokeWidth="1.8" />
      <rect x="58" y="53" width="6" height="7.4" fill="#e3cd9c" />
      <circle cx="56.2" cy="56.7" r=".7" fill="#c4a96d" /><circle cx="66" cy="56.7" r=".7" fill="#c4a96d" />
    </g>
  );
  const scar = look.extra === 'scar' && (
    <g strokeLinecap="round" fill="none">
      <path d="M61.5 39 L65.5 58" stroke={INK} strokeWidth={small ? 4.2 : 3.6} />
      <path d="M61.5 39 L65.5 58" stroke="#e0636f" strokeWidth={small ? 2 : 1.6} />
      <path d="M59.5 47 L67.8 45.4 M60.4 52.6 L68.4 51" stroke={INK} strokeWidth="1.5" />
    </g>
  );

  const hairBackNodes = hairShapes(H.back);
  const hairFrontNodes = hairShapes(H.front);

  return (
    <>
      <defs>
        <linearGradient id={`${id}j`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.jer} /><stop offset="1" stopColor={c.jerD} />
        </linearGradient>
        <clipPath id={`${id}cb`}><path d={hairD(H.back)} /></clipPath>
        <clipPath id={`${id}cf`}><path d={hairD(H.front)} /></clipPath>
        <clipPath id={`${id}h`}><ellipse cx="50" cy="47" rx={rx} ry="19" /></clipPath>
        <clipPath id={`${id}jc`}><path d="M2 100 C4 84 22 77 38 72 L62 72 C78 77 96 84 98 100 Z" /></clipPath>
      </defs>
      {halo && (
        <g fill="none" stroke="#fff" strokeWidth="6" strokeLinejoin="round" opacity=".9">
          {H.back.concat(H.front).map((sh, i) => <path key={i} d={sh.d} />)}
        </g>
      )}
      {/* ジャージ */}
      <path d="M2 100 C4 84 22 77 38 72 L62 72 C78 77 96 84 98 100 Z" fill={`url(#${id}j)`} />
      <g clipPath={`url(#${id}jc)`}>
        <polygon points="0,60 34,60 24,100 0,100" fill="#000" opacity=".26" />
        <polygon points="78,60 100,60 100,100 84,100" fill={c.rim} opacity=".55" />
        <path d="M8 98 C11 88 20 82 30 78" stroke="#fff" strokeWidth="3.2" fill="none" />
        <path d="M92 98 C89 88 80 82 70 78" stroke="#fff" strokeWidth="3.2" fill="none" />
      </g>
      <path d="M2 100 C4 84 22 77 38 72 L62 72 C78 77 96 84 98 100" fill="none" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      {/* 首と襟 */}
      <rect x="43" y="58" width="14" height="18" fill={skin.base} stroke={INK} strokeWidth="2" />
      <rect x="43" y="60" width="14" height="6" fill={skin.shade} />
      <path d="M37 72 L50 90 L63 72 L57 70 L50 79 L43 70Z" fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M43 70 L50 79 L57 70 Z" fill={skin.base} />
      {/* 後ろ髪 */}
      {hairBackNodes}
      {look.hair !== 'mohawk' && shade('cb')}
      {H.tie && (
        <g>
          <ellipse cx={H.tie.x} cy={H.tie.y} rx="4.4" ry="5.6" transform={`rotate(25 ${H.tie.x} ${H.tie.y})`} fill={GOLD} stroke={INK} strokeWidth="2" />
        </g>
      )}
      {/* 耳と顔 */}
      <ellipse cx={50 - rx} cy="50" rx="3.4" ry="4.6" fill={skin.base} stroke={INK} strokeWidth="2" />
      <ellipse cx={50 + rx} cy="50" rx="3.4" ry="4.6" fill={skin.base} stroke={INK} strokeWidth="2" />
      <ellipse cx="50" cy="47" rx={rx} ry="19" fill={skin.base} stroke={INK} strokeWidth={w} />
      <g clipPath={`url(#${id}h)`}>
        <polygon points={`0,0 ${50 - rx + 6},0 ${50 - rx + 2},100 0,100`} fill={skin.shade} opacity=".85" />
        <rect x="0" y="62" width="100" height="10" fill={skin.shade} opacity=".5" />
      </g>
      {expression === 'win' && (
        <g opacity=".5" fill="#ff6a7a"><ellipse cx="38" cy="57" rx="3.6" ry="1.9" /><ellipse cx="62" cy="57" rx="3.6" ry="1.9" /></g>
      )}
      {eyes}
      <path d="M51 56 l-2.4 3.2 h2.4" stroke={skin.shade} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {mouth}
      {glasses}
      {bandage}
      {scar}
      {/* 前髪 */}
      {hairFrontNodes}
      {shade('cf')}
      {H.lines && H.lines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity=".8" />
      ))}
      {headband}
      {brows}
      {expression === 'lose' && (
        <g stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity=".55" fill="none">
          <path d="M35 34 V40 M40 33 V40 M45 33 V39" />
        </g>
      )}
      {expression === 'lose' && (
        <path d="M74 38 Q77 43 74 46 Q71 43 74 38Z" fill="#bfe9ff" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      )}
    </>
  );
}

export interface CharaBustProps {
  look: CharaLook;
  team: TeamId;
  expression?: Expression;
  flip?: boolean;
  className?: string;
}

const flipT = 'translate(100 0) scale(-1 1)';

export function CharaBust({ look, team, expression = 'normal', flip = false, className }: CharaBustProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} width="100%" height="100%" overflow="visible" aria-hidden="true">
      <g transform={flip ? flipT : undefined}>
        <BustContent look={look} team={team} expression={expression} />
      </g>
    </svg>
  );
}

export function CharaBustG({ look, team, expression = 'normal' }: Omit<CharaBustProps, 'flip' | 'className'>) {
  return (
    <g>
      <BustContent look={look} team={team} expression={expression} />
    </g>
  );
}
