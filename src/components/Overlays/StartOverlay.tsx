import './Overlays.css';

interface Props {
  timerOn: boolean;
  seconds: number;
  onToggleTimer: (v: boolean) => void;
  onStart: () => void;
}

export function StartOverlay({ timerOn, seconds, onToggleTimer, onStart }: Props) {
  return (
    <div className="overlay overlay--start" data-testid="start-overlay">
      <div className="card">
        <h1 className="card__title">BRAIBO</h1>
        <p className="card__text">
          5人の移動先を決めて「ターン実行」。敵と同時に動き、移動後の位置でパス・シュートが決まります。
        </p>
        <label className="toggle">
          <span>作戦タイマー（{seconds}秒）</span>
          <input type="checkbox" checked={timerOn} onChange={(e) => onToggleTimer(e.target.checked)} />
          <i className="toggle__track" />
        </label>
        <button className="cta" onClick={onStart} data-testid="start-button">
          キックオフ
        </button>
      </div>
    </div>
  );
}
