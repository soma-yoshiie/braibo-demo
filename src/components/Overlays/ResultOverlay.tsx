import { getProfile } from '../../game/data/roster';
import type { TeamId } from '../../game/types';
import { matchReward } from '../../meta/save';
import { CharaBust, Crest, SpeedLines } from '../Chara';
import './Overlays.css';

interface Props {
  score: Record<TeamId, number>;
  /** Slot-ordered lineups: slot 0 is the ace shown on the result screen. */
  blue: string[];
  red: string[];
  onAgain: () => void;
  onHome: () => void;
  onLog: () => void;
}

export function ResultOverlay({ score, blue, red, onAgain, onHome, onLog }: Props) {
  const cls = score.blue > score.red ? 'win' : score.blue < score.red ? 'lose' : 'draw';
  const verdict = cls === 'win' ? 'WIN!!' : cls === 'lose' ? 'LOSE…' : 'DRAW';
  const { coins } = matchReward(score);
  // the winning side's ace speaks; on a draw the user's ace
  const aceTeam: TeamId = cls === 'lose' ? 'red' : 'blue';
  const ace = getProfile((aceTeam === 'red' ? red : blue)[0] ?? '');
  const quote = cls === 'draw' ? ace.quotes.duel : ace.quotes.goal;
  // the loser's ace answers in a smaller line (not on a draw)
  const loser = cls === 'draw' ? null : getProfile((aceTeam === 'red' ? blue : red)[0] ?? '');
  return (
    <div className={`overlay overlay--result a-stage result--${cls}`} data-testid="result-overlay">
      <div className="result__bg a-halftone" />
      <div className="result__lines">
        <SpeedLines />
      </div>
      <div className="result__bust">
        <CharaBust look={ace.look} team={aceTeam} expression={cls === 'draw' ? 'normal' : 'win'} />
      </div>
      <div className="result__main">
        <div className={`result__verdict a-head result__verdict--${cls}`} data-testid="verdict">
          {verdict}
        </div>
        <div className="result__plate a-panel">
          <span className="result__team result__team--blue">
            <Crest team="blue" size={22} />
            <b>蒼嵐</b>
          </span>
          <span className="result__score a-num">
            <span className="result__blue">{score.blue}</span>
            <span className="result__dash">-</span>
            <span className="result__red">{score.red}</span>
          </span>
          <span className="result__team result__team--red">
            <b>紅蓮</b>
            <Crest team="red" size={22} />
          </span>
        </div>
        <div className="result__quote a-panel a-panel--paper">
          <span className={`a-tag a-tag--${aceTeam}`}>#{ace.number} {ace.name}</span>
          <p>「{quote}」</p>
          {loser && (
            <p className="result__quote-lose">
              {loser.name}「{loser.quotes.lose}」
            </p>
          )}
        </div>
        <div className="result__reward a-panel" data-testid="result-reward">
          <span className="result__coin" aria-hidden="true">C</span>
          <b className="a-num">+{coins}</b>
          <span>コイン</span>
        </div>
        <div className="result__btns">
          <button className="a-btn a-btn--yellow a-btn--lg a-btn--block" onClick={onAgain} data-testid="again-button">
            <span>もう一度</span>
          </button>
          <div className="result__btns2">
            <button className="a-btn a-btn--dark" onClick={onHome} data-testid="result-home">
              <span>ホームへ</span>
            </button>
            <button className="a-btn a-btn--dark" onClick={onLog} data-testid="result-log">
              <span>ログ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
