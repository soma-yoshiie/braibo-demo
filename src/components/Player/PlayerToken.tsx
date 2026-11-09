import type { TokenLayout, TokenView } from '../viewTypes';
import { cx, cy } from '../Pitch/pitchGeometry';
import './PlayerToken.css';

interface Props {
  token: TokenView;
  selected: boolean;
  inspected?: boolean;
  passTarget: boolean;
  interactive: boolean;
  onTap: (id: string) => void;
  /** Set when an opponent shares the cell: diagonal offset + 0.8 scale. */
  layout?: TokenLayout;
  /** Visual duplicate drawn above the radial scrim (no test id, no pointer events). */
  clone?: boolean;
}

/** Small football icon (pentagon pattern) drawn around 0,0 with radius r. */
export function BallIcon({ r = 0.15 }: { r?: number }) {
  return (
    <g className="ball-icon">
      <circle r={r} className="ball-icon__body" />
      <path
        className="ball-icon__patch"
        d={`M0 ${-r * 0.5} L${r * 0.48} ${-r * 0.15} L${r * 0.3} ${r * 0.42} L${-r * 0.3} ${r * 0.42} L${-r * 0.48} ${-r * 0.15} Z`}
      />
    </g>
  );
}

const SOLO: TokenLayout = { dx: 0, dy: 0, s: 1 };
const placeStyle = (token: TokenView, l: TokenLayout): React.CSSProperties => {
  const style: React.CSSProperties = {
    transform: `translate(${cx(token.x) + l.dx}px, ${cy(token.y) + l.dy}px) scale(${l.s})`,
  };
  if (token.moveMs !== undefined) (style as Record<string, unknown>)['--move-ms'] = `${token.moveMs}ms`;
  return style;
};

export function PlayerToken({ token, selected, inspected, passTarget, interactive, onTap, layout, clone }: Props) {
  const cls = [
    'token',
    `token--${token.team}`,
    selected && 'is-selected',
    inspected && 'is-inspected',
    passTarget && 'is-pass-target',
    token.clash && 'is-clash',
    token.tag?.kind === 'lose' && 'is-lose',
    layout && 'is-shared',
  ]
    .filter(Boolean)
    .join(' ');
  const style = placeStyle(token, layout ?? SOLO);
  // shared cell: the user's (blue) hit area is the larger one so ambiguous taps pick their own player
  const hitR = layout ? (token.team === 'blue' ? 0.44 : 0.22) : 0.5;
  return (
    <g
      className={cls}
      data-testid={clone ? undefined : `token-${token.id}`}
      data-id={clone ? undefined : token.id}
      pointerEvents={clone ? 'none' : undefined}
      style={style}
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation();
              onTap(token.id);
            }
          : undefined
      }
    >
      <g className="token__inner">
        <circle className="token__extent" r={0.62} />
        <ellipse className="token__shadow" cx={0.03} cy={0.34} rx={0.37} ry={0.13} />
        {selected && (
          <g className="token__sel">
            <circle className="token__ring token__ring--gold" r={layout ? 0.46 : 0.57} />
            <circle className="token__ring token__ring--white" r={layout ? 0.41 : 0.5} />
          </g>
        )}
        {token.tag?.kind === 'win' && <circle className="token__win-ring" r={0.52} />}
        {inspected && <circle className="token__inspect-ring" r={0.5} />}
        {passTarget && <circle className="token__target-ring" r={0.54} />}
        <circle className="token__hit" r={hitR} />
        <circle className="token__body" r={0.4} />
        <ellipse className="token__gloss" cx={-0.11} cy={-0.18} rx={0.2} ry={0.11} transform="rotate(-28 -0.11 -0.18)" />
        <text className="token__abbr" y={0.02}>
          {token.abbr}
        </text>
        {token.hasBall && (
          <g transform="translate(0.3 0.3)" pointerEvents="none">
            <BallIcon r={0.17} />
          </g>
        )}
      </g>
    </g>
  );
}

/** WIN / LOSE tag; rendered in its own top layer so no token can cover it. */
export function DuelTag({ token, layout }: { token: TokenView; layout?: TokenLayout }) {
  if (!token.tag) return null;
  const tw = token.tag.label.length > 4 ? 1.6 : 0.98;
  // shared cell: red's tag goes above the pair, blue's below, so the two plates never overlap
  const l = layout ?? SOLO;
  const style = placeStyle(token, { dx: l.dx, dy: l.dy, s: 1 });
  const ty = layout ? (token.team === 'red' ? -0.62 : 0.62) : -0.8;
  return (
    <g className="token tag-pos" style={style} pointerEvents="none">
      <g className={`tag tag--${token.tag.kind} tag--${token.team}`} transform={`translate(0 ${ty})`}>
        <g className="tag__pop" data-testid={`duel-${token.tag.kind}-${token.id}`}>
          <rect className="tag__plate" x={-tw / 2} y={-0.19} width={tw} height={0.38} rx={0.19} />
          {token.tag.kind === 'win' && (
            <rect className="tag__gold" x={-tw / 2} y={-0.19} width={tw} height={0.38} rx={0.19} />
          )}
          <text className="tag__text">{token.tag.label}</text>
        </g>
      </g>
    </g>
  );
}
