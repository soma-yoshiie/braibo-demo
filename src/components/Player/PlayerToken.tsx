import { memo } from 'react';
import { getProfile } from '../../game/data/roster';
import { BallG, CharaMedalG } from '../Chara';
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

/** Football icon drawn around 0,0 with radius r (cell units). */
export function BallIcon({ r = 0.15 }: { r?: number }) {
  return (
    <g transform={`scale(${r / 10})`}>
      <BallG r={10} />
    </g>
  );
}

/** Medal art in cell units: the medal's 100-unit box becomes ~0.92 cell, centred on the token. */
export const MEDAL_SCALE = 0.0092;
const MEDAL_T = `translate(${-50 * MEDAL_SCALE} ${-50 * MEDAL_SCALE - 0.02}) scale(${MEDAL_SCALE})`;

/** The medal never changes for a token, so it is memoised: only the wrapper moves while a turn plays. */
export const TokenMedal = memo(function TokenMedal({
  charId,
  team,
  number,
  abbr,
}: {
  charId: string;
  team: 'blue' | 'red';
  number: number;
  abbr: string;
}) {
  const p = getProfile(charId);
  return (
    <g transform={MEDAL_T} pointerEvents="none">
      <CharaMedalG look={p.look} team={team} number={number} abbr={abbr} rarity={p.rarity} />
    </g>
  );
});

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
        {token.hasBall && <circle className="token__aura" r={0.66} />}
        {selected && (
          <g className="token__sel">
            <circle className="token__ring token__ring--ink" r={layout ? 0.5 : 0.6} />
            <circle className="token__ring token__ring--gold" r={layout ? 0.46 : 0.56} />
          </g>
        )}
        {token.tag?.kind === 'win' && <circle className="token__win-ring" r={0.54} />}
        {inspected && <circle className="token__inspect-ring" r={0.5} />}
        {passTarget && <circle className="token__target-ring" r={0.54} />}
        <circle className="token__hit" r={hitR} />
        <TokenMedal charId={token.charId} team={token.team} number={token.number} abbr={token.abbr} />
        {token.hasBall && (
          <g transform="translate(-0.33 0.27)" pointerEvents="none">
            <BallIcon r={0.19} />
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
          <path
            className="tag__plate"
            d={`M${-tw / 2 + 0.08} -0.2 H${tw / 2 + 0.08} L${tw / 2 - 0.08} 0.2 H${-tw / 2 - 0.08} Z`}
          />
          <text className="tag__text">{token.tag.label}</text>
        </g>
      </g>
    </g>
  );
}
