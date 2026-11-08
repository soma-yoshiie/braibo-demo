import type { TeamId } from '../../game/types';
import './Overlays.css';

interface Props {
  score: Record<TeamId, number>;
  onAgain: () => void;
  onLog: () => void;
}

export function ResultOverlay({ score, onAgain, onLog }: Props) {
  const verdict = score.blue > score.red ? '勝利' : score.blue < score.red ? '敗北' : '引き分け';
  const cls = score.blue > score.red ? 'win' : score.blue < score.red ? 'lose' : 'draw';
  return (
    <div className="overlay overlay--result" data-testid="result-overlay">
      <div className="card">
        <div className="card__sub">試合終了</div>
        <div className="result__score">
          <span className="result__blue">{score.blue}</span>
          <span className="result__dash">-</span>
          <span className="result__red">{score.red}</span>
        </div>
        <div className={`result__verdict result__verdict--${cls}`}>{verdict}</div>
        <button className="result__log" onClick={onLog} data-testid="result-log">
          ログ
        </button>
        <button className="cta" onClick={onAgain} data-testid="again-button">
          もう一度
        </button>
      </div>
    </div>
  );
}
