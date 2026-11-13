import { getProfile } from '../../game/data/roster';
import type { PassStyle } from '../../game/types';
import { CharaMedal, Crest, Stars } from '../Chara';
import type { SelectedView } from '../viewTypes';
import './ActionBar.css';

interface Props {
  plannedCount: number;
  total: number;
  disabled: boolean;
  onReset: () => void;
  onExecute: () => void;
  /** The blue player the bar describes (null = none / turn is playing). */
  selected?: SelectedView | null;
  /** Tapping the strip opens the info sheet. */
  onOpenInfo?: () => void;
  /** While picking a pass target: shows the style toggle in place of the progress dots. */
  passStyle?: PassStyle | null;
  onPassStyle?: (s: PassStyle) => void;
  /** Offside-trap button (null = cannot apply: own / loose ball, rule off). It takes the progress dots' place. */
  trap?: { on: boolean; wait: number; onToggle: () => void } | null;
}

export function ActionBar({ plannedCount, total, disabled, onReset, onExecute, selected, onOpenInfo, passStyle, onPassStyle, trap }: Props) {
  const sel = selected ?? null;
  return (
    <footer className="bar">
      <button
        type="button"
        className={`bar__who${sel ? ` bar__who--${sel.team}` : ''}`}
        onClick={onOpenInfo}
        disabled={!sel || disabled}
        aria-label="選手の情報"
      >
        {sel ? (
          <>
            <span className="bar__medal">
              <CharaMedal look={getProfile(sel.charId).look} team={sel.team} number={sel.number} abbr={sel.abbr} rarity={sel.rarity} type={sel.type} />
            </span>
            <span className="bar__who-txt">
              <i>{sel.title}</i>
              <b>{sel.name}</b>
              <Stars rarity={sel.rarity} size={11} />
            </span>
          </>
        ) : (
          <>
            <span className="bar__crest">
              <Crest team="blue" size={30} />
            </span>
            <span className="bar__who-txt">
              <b>{disabled ? '試合中…' : '選手をタップ'}</b>
            </span>
          </>
        )}
      </button>
      <div className="bar__mid">
        {passStyle ? (
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
        ) : trap ? (
          <>
            <button
              type="button"
              className={`bar__trap${trap.on ? ' is-on' : ''}${trap.wait > 0 ? ' is-wait' : ''}`}
              data-testid="trap-button"
              aria-pressed={trap.on}
              aria-disabled={trap.wait > 0}
              disabled={disabled}
              onClick={trap.wait > 0 ? undefined : trap.onToggle}
            >
              {trap.wait > 0 ? <span data-testid="trap-wait">あと {trap.wait} ターン</span> : trap.on ? 'トラップ宣言中' : 'トラップ'}
            </button>
            <div className="bar__progress bar__progress--row" data-testid="progress">
              <div className="bar__count a-num">
                <b>{plannedCount}</b>/{total} 指定
              </div>
              <button className="a-btn a-btn--dark a-btn--sm bar__reset" onClick={onReset} disabled={disabled} data-testid="reset">
                <span>リセット</span>
              </button>
            </div>
          </>
        ) : (
          <div className="bar__progress" data-testid="progress">
            <div className="bar__dots">
              {Array.from({ length: total }, (_, i) => (
                <i key={i} className={i < plannedCount ? 'is-on' : ''} />
              ))}
            </div>
            <div className="bar__count a-num">
              <b>{plannedCount}</b>/{total} 指定
            </div>
          </div>
        )}
        {!(trap && !passStyle) && (
          <button className="a-btn a-btn--dark a-btn--sm bar__reset" onClick={onReset} disabled={disabled} data-testid="reset">
            <span>リセット</span>
          </button>
        )}
      </div>
      <button className="a-btn a-btn--yellow a-btn--lg bar__exec" onClick={onExecute} disabled={disabled} data-testid="execute">
        <span>実行！</span>
      </button>
    </footer>
  );
}
