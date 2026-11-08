import type { TokenView } from '../viewTypes';
import { cx, cy } from '../Pitch/pitchGeometry';
import './PlayerToken.css';

interface Props {
  token: TokenView;
  selected: boolean;
  inspected?: boolean;
  passTarget: boolean;
  interactive: boolean;
  onTap: (id: string) => void;
}

export function PlayerToken({ token, selected, inspected, passTarget, interactive, onTap }: Props) {
  const cls = `token token--${token.team}${selected ? ' is-selected' : ''}${inspected ? ' is-inspected' : ''}${passTarget ? ' is-pass-target' : ''}`;
  return (
    <g
      className={cls}
      data-testid={`token-${token.id}`}
      data-id={token.id}
      style={{ transform: `translate(${cx(token.x)}px, ${cy(token.y)}px)` }}
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation();
              onTap(token.id);
            }
          : undefined
      }
    >
      {selected && <circle className="token__ring" r={0.56} />}
      {inspected && <circle className="token__inspect-ring" r={0.5} />}
      {passTarget && <circle className="token__target-ring" r={0.52} />}
      <circle className="token__hit" r={0.5} />
      <circle className="token__body" r={0.38} />
      <text className="token__abbr" y={0.01}>
        {token.abbr}
      </text>
      {token.hasBall && <circle className="token__ball" cx={0.28} cy={0.28} r={0.15} />}
    </g>
  );
}
