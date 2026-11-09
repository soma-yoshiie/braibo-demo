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
      <div className="card card--start">
        <h1 className="logo" aria-label="BRAIBO">
          <svg viewBox="0 0 300 78" className="logo__svg" role="img" aria-hidden="true">
            <defs>
              <linearGradient id="logo-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff3c4" />
                <stop offset="0.5" stopColor="#e5bd5a" />
                <stop offset="1" stopColor="#a8822c" />
              </linearGradient>
            </defs>
            <text x="150" y="62" textAnchor="middle" className="logo__shadow">
              BRAIBO
            </text>
            <text x="150" y="58" textAnchor="middle" className="logo__text">
              BRAIBO
            </text>
          </svg>
        </h1>
        <div className="card__tag">BRAIN × BALL</div>
        <ol className="howto">
          <li>
            <i>1</i>青の選手をタップして移動先を指定
          </li>
          <li>
            <i>2</i>ボール保持者はシュート・パス・クロスを選ぶ
          </li>
          <li>
            <i>3</i>「ターン実行」で敵と同時に動き出す！
          </li>
        </ol>
        <p className="howto__note">敵と同じマスにも並べる。競り合いはボールがあるマスだけ、負けてもその場に残る。</p>
        <label className="toggle">
          <span>作戦タイマー（{seconds}秒）</span>
          <input type="checkbox" checked={timerOn} onChange={(e) => onToggleTimer(e.target.checked)} />
          <i className="toggle__track" />
        </label>
        <button className="gbtn gbtn--gold cta" onClick={onStart} data-testid="start-button">
          キックオフ
        </button>
      </div>
    </div>
  );
}
