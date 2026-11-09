import type { PassStyle } from '../../game/types';
import './ActionBar.css';

interface Props {
  plannedCount: number;
  total: number;
  disabled: boolean;
  onReset: () => void;
  onExecute: () => void;
  /** While picking a pass target: shows the style toggle in place of the progress dots. */
  passStyle?: PassStyle | null;
  onPassStyle?: (s: PassStyle) => void;
}

export function ActionBar({ plannedCount, total, disabled, onReset, onExecute, passStyle, onPassStyle }: Props) {
  return (
    <footer className="bar">
      <button className="gbtn gbtn--neutral bar__reset" onClick={onReset} disabled={disabled} data-testid="reset">
        リセット
      </button>
      {passStyle ? (
        <div className="bar__progress">
          <div className="seg" role="group" aria-label="パスの種類">
            {(['ground', 'lofted'] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`seg__btn seg__btn--${st}${passStyle === st ? ' is-on' : ''}`}
                aria-pressed={passStyle === st}
                data-testid={`pass-style-${st}`}
                onClick={() => onPassStyle?.(st)}
              >
                <span className="seg__glyph" aria-hidden="true">{st === 'ground' ? '→' : '⌒'}</span>
                <span className="seg__text">{st === 'ground' ? 'ゴロ' : '浮き玉'}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
      <div className="bar__progress" data-testid="progress">
        <div className="bar__dots">
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={i < plannedCount ? 'is-on' : ''} />
          ))}
        </div>
        <div className="bar__count">
          <b>{plannedCount}</b>/{total} 指定
        </div>
      </div>
      )}
      <button className="gbtn gbtn--gold bar__exec" onClick={onExecute} disabled={disabled} data-testid="execute">
        <span className="bar__play">▶</span> ターン実行
      </button>
    </footer>
  );
}
