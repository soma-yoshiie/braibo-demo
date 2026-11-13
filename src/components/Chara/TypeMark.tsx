import type { CSSProperties } from 'react';
import type { TypeId, Position } from '../../game/types';
import { INK, TYPE_COLOR, TYPE_GLYPH, TYPE_LABEL } from './palette';

const HEX = (() => {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    p.push(`${(9.4 * Math.cos(a)).toFixed(2)},${(9.4 * Math.sin(a)).toFixed(2)}`);
  }
  return p.join(' ');
})();

function MarkShape({ type }: { type: TypeId }) {
  return (
    <>
      <polygon points={HEX} fill={TYPE_COLOR[type]} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M-6.2 -4.2 L0 -8 L6.2 -4.2" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.2" strokeLinecap="round" />
      <text x="0" y="4.4" textAnchor="middle" fontSize="12.5" fontWeight="900" fill="#fff" stroke={INK} strokeWidth="1.4" paintOrder="stroke"
        style={{ fontFamily: "var(--font-jp, 'M PLUS Rounded 1c'), sans-serif" }}>{TYPE_GLYPH[type]}</text>
    </>
  );
}

/** SVG の中に置く版。(0,0) 中心、size は六角形の外接の高さ（親の座標系の単位）。 */
export function TypeMarkG({ type, size = 20 }: { type: TypeId; size?: number }) {
  return (
    <g transform={`scale(${size / 20})`} role="img" aria-label={TYPE_LABEL[type]}>
      <MarkShape type={type} />
    </g>
  );
}

/** タイプの印（色つきの六角形に漢字 1 字）。size は px。 */
export function TypeMark({ type, size = 20, className }: { type: TypeId; size?: number; className?: string }) {
  return (
    <svg viewBox="-10.5 -10.5 21 21" width={size} height={size} className={className} role="img" aria-label={TYPE_LABEL[type]}>
      <MarkShape type={type} />
    </svg>
  );
}

const chipStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle', whiteSpace: 'nowrap' };

/** 印の横にタイプ名。 */
export function TypeChip({ type, size = 18, className }: { type: TypeId; size?: number; className?: string }) {
  return (
    <span className={className} style={chipStyle}>
      <TypeMark type={type} size={size} />
      <span style={{ fontFamily: "var(--font-jp, 'M PLUS Rounded 1c'), sans-serif", fontWeight: 800, fontSize: Math.round(size * 0.72) }}>{TYPE_LABEL[type]}</span>
    </span>
  );
}

/** ポジションの札（ink の地に白の数字フォント）。大きさは親の font-size に従う（既定 12px）。 */
export function PosTag({ position, className }: { position: Position; className?: string }) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block', background: INK, color: '#fff', borderRadius: 3, padding: '0.1em 0.5em 0',
        fontFamily: "var(--font-num, 'Bebas Neue'), 'Arial Narrow', sans-serif", fontSize: 12, lineHeight: 1.25,
        letterSpacing: '0.04em', outline: '1px solid rgba(255,255,255,.35)', outlineOffset: -2,
      }}
    >{position}</span>
  );
}
