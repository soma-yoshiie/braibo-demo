import './ActionBar.css';

interface Props {
  plannedCount: number;
  total: number;
  disabled: boolean;
  onReset: () => void;
  onExecute: () => void;
}

export function ActionBar({ plannedCount, total, disabled, onReset, onExecute }: Props) {
  return (
    <footer className="bar">
      <button className="gbtn gbtn--neutral bar__reset" onClick={onReset} disabled={disabled} data-testid="reset">
        リセット
      </button>
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
      <button className="gbtn gbtn--gold bar__exec" onClick={onExecute} disabled={disabled} data-testid="execute">
        <span className="bar__play">▶</span> ターン実行
      </button>
    </footer>
  );
}
