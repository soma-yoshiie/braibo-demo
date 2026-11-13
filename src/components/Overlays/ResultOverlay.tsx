import { useEffect, useState } from 'react';
import { getProfile } from '../../game/data/roster';
import type { TeamId } from '../../game/types';
import { expNeed, matchReward } from '../../meta/save';
import type { ResultSummary } from '../../meta/save';
import { CharaBust, Crest, SpeedLines } from '../Chara';
import { prefersReducedMotion } from '../Shell/actions';
import './Overlays.css';

interface Props {
  score: Record<TeamId, number>;
  /** Slot-ordered lineups: slot 0 is the ace shown on the result screen. */
  blue: string[];
  red: string[];
  /** What the match gave (null / undefined until the shell has saved it). */
  summary?: ResultSummary | null;
  onAgain: () => void;
  onHome: () => void;
  onLog: () => void;
}

const FILL_MS = 800;

/** EXP bar: fills from `expBefore`, and on every rank-up fills to the end, stamps RANK UP!, restarts from 0. */
function ExpBar({ s }: { s: ResultSummary }) {
  const segs: { rank: number; from: number; to: number; need: number }[] = [];
  for (let r = s.rankBefore; r <= s.rankAfter; r++) {
    const need = r === s.rankAfter ? s.expNeedAfter : expNeed(r);
    segs.push({ rank: r, from: r === s.rankBefore ? s.expBefore : 0, to: r === s.rankAfter ? s.expAfter : need, need });
  }
  const last = segs.length - 1;
  const instant = prefersReducedMotion();
  const [i, setI] = useState(instant ? last : 0);
  const [filled, setFilled] = useState(instant);
  const [stamp, setStamp] = useState(false);
  useEffect(() => {
    if (instant) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
    let t = 80;
    for (let k = 0; k <= last; k++) {
      at(t, () => {
        setI(k);
        setFilled(true);
      });
      t += FILL_MS + 50;
      if (k < last) {
        at(t, () => setStamp(true));
        t += 550;
        at(t, () => {
          setStamp(false);
          setI(k + 1);
          setFilled(false);
        });
        t += 60;
      }
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const seg = segs[i] as (typeof segs)[number];
  const done = i === last && filled;
  const full = i < last && filled;
  const pct = (filled ? (full ? 1 : seg.to / seg.need) : seg.from / seg.need) * 100;
  const shown = filled ? seg.to : seg.from;
  return (
    <div className="result__exp a-panel" data-testid="result-exp">
      <span className="result__rank a-num">
        RANK <b>{seg.rank}</b>
        {last > 0 && i === last && <em className="result__rankmark a-tag">RANK UP!</em>}
      </span>
      <span className="result__expbar">
        <i style={{ width: `${pct}%`, transition: filled && !instant ? `width ${FILL_MS}ms ease-out` : 'none' }} />
      </span>
      <span className="result__expnum a-num">
        {done || full ? (full ? seg.need : shown) : shown}/{seg.need}
      </span>
      <span className="result__gain a-num">+{s.expGain} EXP</span>
      {stamp && <span className="result__rankup a-head a-head--yellow">RANK UP!</span>}
    </div>
  );
}

export function ResultOverlay({ score, blue, red, summary, onAgain, onHome, onLog }: Props) {
  const cls = score.blue > score.red ? 'win' : score.blue < score.red ? 'lose' : 'draw';
  const verdict = cls === 'win' ? 'WIN!!' : cls === 'lose' ? 'LOSE…' : 'DRAW';
  const total = summary ? summary.totalCoins : matchReward(score).coins;
  // the winning side's ace speaks; on a draw the user's ace
  const aceTeam: TeamId = cls === 'lose' ? 'red' : 'blue';
  const ace = getProfile((aceTeam === 'red' ? red : blue)[0] ?? '');
  const quote = cls === 'draw' ? ace.quotes.duel : ace.quotes.goal;
  // the loser's ace answers in a smaller line (not on a draw)
  const loser = cls === 'draw' ? null : getProfile((aceTeam === 'red' ? blue : red)[0] ?? '');
  const cleared = !!summary && summary.firstClear > 0;
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
        {cleared && <div className="result__clear a-head a-head--yellow">STAGE CLEAR!</div>}
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
        {summary && <ExpBar s={summary} />}
        <div className="result__reward a-panel">
          <div className="result__total" data-testid="result-reward">
            <span className="result__coin" aria-hidden="true">C</span>
            <b className="a-num">+{total}</b>
            <span>コイン</span>
          </div>
          {summary && (
            <div className="result__chips">
              <span className="result__chip">
                試合 <b className="a-num">+{summary.coins}</b>
              </span>
              {summary.firstClear > 0 && (
                <span className="result__chip result__chip--gold">
                  <em className="a-tag">FIRST CLEAR</em> <b className="a-num">+{summary.firstClear}</b>
                </span>
              )}
              {summary.rankUpCoins > 0 && (
                <span className="result__chip">
                  ランクアップ <b className="a-num">+{summary.rankUpCoins}</b>
                </span>
              )}
            </div>
          )}
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
