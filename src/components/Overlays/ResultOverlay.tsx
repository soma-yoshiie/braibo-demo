import type { TeamId } from '../../game/types';
import './Overlays.css';

interface Props {
  score: Record<TeamId, number>;
  onAgain: () => void;
  onLog: () => void;
}

export function ResultOverlay({ score, onAgain, onLog }: Props) {
  const cls = score.blue > score.red ? 'win' : score.blue < score.red ? 'lose' : 'draw';
  const verdict = cls === 'win' ? 'WIN!!' : cls === 'lose' ? 'LOSE…' : 'DRAW';
  return (
    <div className="overlay overlay--result" data-testid="result-overlay">
      <div className="card card--result">
        <div className={`result__verdict result__verdict--${cls}`} data-testid="verdict">
          {verdict}
        </div>
        <div className="card__sub">試合終了</div>
        <div className="result__plate">
          <span className="result__team result__team--blue">青</span>
          <span className="result__score">
            <span className="result__blue">{score.blue}</span>
            <span className="result__dash">-</span>
            <span className="result__red">{score.red}</span>
          </span>
          <span className="result__team result__team--red">赤</span>
        </div>
        <div className="result__btns">
          <button className="gbtn gbtn--neutral" onClick={onLog} data-testid="result-log">
            ログ
          </button>
          <button className="gbtn gbtn--gold cta" onClick={onAgain} data-testid="again-button">
            もう一度
          </button>
        </div>
      </div>
    </div>
  );
}
