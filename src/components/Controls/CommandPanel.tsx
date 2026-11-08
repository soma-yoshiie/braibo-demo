import type { BallActionKind, PlayerId, Stats } from '../../game/types';
import type { CharacterDef } from '../../game/types';
import './CommandPanel.css';

export interface ChipView {
  id: PlayerId;
  abbr: string;
  planned: boolean;
  selected: boolean;
}

export interface InfoView {
  team: 'blue' | 'red';
  name: string;
  abbr: string;
  description: string;
  stats: Stats;
  role: CharacterDef['role'];
}

export interface ActionsView {
  current: BallActionKind;
  /** 'pass' | 'cross' while picking a target. */
  picking: 'pass' | 'cross' | null;
  shootPct: number;
  canPass: boolean;
  canCross: boolean;
}

interface Props {
  chips: ChipView[];
  info: InfoView | null;
  actions: ActionsView | null;
  plannedCount: number;
  total: number;
  disabled: boolean;
  notice?: string | null;
  onChip: (id: PlayerId) => void;
  onKeep: () => void;
  onPass: () => void;
  onCross: () => void;
  onShoot: () => void;
  onReset: () => void;
  onExecute: () => void;
}

const STAT_PICK: Record<InfoView['role'], [keyof Stats, string][]> = {
  striker: [['shoot', 'SHO'], ['pass', 'PAS'], ['physical', 'PHY']],
  wing: [['cross', 'CRS'], ['pass', 'PAS'], ['physical', 'PHY']],
  longShooter: [['longShot', 'LNG'], ['pass', 'PAS'], ['physical', 'PHY']],
  interceptor: [['intercept', 'INT'], ['physical', 'PHY'], ['pass', 'PAS']],
  physicalDefender: [['physical', 'PHY'], ['aerial', 'AIR'], ['block', 'BLK']],
};

export function CommandPanel(p: Props) {
  const { info, actions } = p;
  return (
    <footer className="panel">
      <div className="panel__chips">
        {p.chips.map((c) => (
          <button
            key={c.id}
            className={`chip${c.selected ? ' is-selected' : ''}${c.planned ? ' is-planned' : ''}`}
            onClick={() => p.onChip(c.id)}
            disabled={p.disabled}
            data-testid={`chip-${c.id}`}
          >
            {c.abbr}
            {c.planned && <span className="chip__check">✓</span>}
          </button>
        ))}
      </div>

      <div className={`panel__info${p.notice || (actions && (actions.picking || actions.current === 'shoot')) ? ' has-hint' : ''}`}>
        {info && (
          <div className="info__line">
            <span className={`info__name info__name--${info.team}`}>{info.name}</span>
            {!actions && <span className="info__abbr">{info.abbr}</span>}
            <span className="info__pills">
              {STAT_PICK[info.role].map(([k, label]) => (
                <span className="pill" key={k}>
                  {label} <b>{info.stats[k]}</b>
                </span>
              ))}
            </span>
          </div>
        )}
        {info && !actions && <div className="info__desc">{info.description}</div>}
        {actions && (
          <div className="actions" data-testid="actions">
            <button
              className={`act${actions.current === 'keep' && !actions.picking ? ' is-on' : ''}`}
              onClick={p.onKeep}
              disabled={p.disabled}
            >
              キープ
            </button>
            <button
              className={`act${actions.picking === 'pass' || (actions.current === 'pass' && !actions.picking) ? ' is-on' : ''}`}
              onClick={p.onPass}
              disabled={p.disabled || !actions.canPass}
            >
              パス
              {!actions.canPass && <small>対象なし</small>}
            </button>
            <button
              className={`act${actions.picking === 'cross' || (actions.current === 'cross' && !actions.picking) ? ' is-on' : ''}`}
              onClick={p.onCross}
              disabled={p.disabled || !actions.canCross}
            >
              クロス
              {!actions.canCross && <small>条件外</small>}
            </button>
            <button
              className={`act act--shoot${actions.current === 'shoot' && !actions.picking ? ' is-on' : ''}`}
              onClick={p.onShoot}
              disabled={p.disabled}
              data-testid="act-shoot"
            >
              シュート<small>{Math.round(actions.shootPct * 100)}%</small>
            </button>
          </div>
        )}
        {p.notice ? (
          <div className="panel__hint panel__hint--warn" data-testid="notice">
            {p.notice}
          </div>
        ) : actions && (actions.picking || actions.current === 'shoot') ? (
          <div className="panel__hint" data-testid="hint">
            {actions.picking === 'pass' && <b>パス先をタップ　</b>}
            {actions.picking === 'cross' && <b>クロス先をタップ(％=得点率)　</b>}
            ※相手の現在位置での推定値
          </div>
        ) : null}
      </div>

      <div className="panel__bottom">
        <button className="btn btn--ghost" onClick={p.onReset} disabled={p.disabled} data-testid="reset">
          リセット
        </button>
        <button className="btn btn--primary" onClick={p.onExecute} disabled={p.disabled} data-testid="execute">
          ▶ ターン実行<span className="btn__sub">{p.plannedCount}/{p.total} 指定</span>
        </button>
      </div>
    </footer>
  );
}
