import { useEffect, useState } from 'react';
import { getCharacter } from '../../game/data/characters';
import { getProfile } from '../../game/data/roster';
import { CharaBust, SpeedLines, Starburst } from '../Chara';
import type { DuelCutInView } from '../viewTypes';
import './Overlays.css';

const reducedMotion = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

function StatPlate({ team, charId, label, value }: { team: 'blue' | 'red'; charId: string; label: string; value: number }) {
  const p = getProfile(charId);
  return (
    <div className={`duel__plate duel__plate--${team}`}>
      <span className="duel__no a-num">{p.number}</span>
      <span className="duel__plate-txt">
        <span className="duel__nm">
          <b>{p.name}</b>
          <span className="duel__abbr a-num">{getCharacter(charId).abbr}</span>
        </span>
        <span className="duel__stat">
          <i>{label}</i>
          <em>
            <s style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
          </em>
        </span>
      </span>
      <span className="duel__val a-num">{value}</span>
    </div>
  );
}

/**
 * Duel cut-in (DESIGN-UI §14.10): the screen is split diagonally, blue bust top-left, red bust bottom-right.
 * The wrapper only draws; the controller owns the timing (1.6 s, a tap skips, reduced motion closes at 700 ms).
 */
export function DuelCutIn({ view, onSkip }: { view: DuelCutInView | null; onSkip: () => void }) {
  // keyed by the duel: every cut-in starts with a fresh `revealed` (no frame of the previous duel's result)
  return view ? <DuelBody key={view.key} view={view} onSkip={onSkip} /> : null;
}

function DuelBody({ view, onSkip }: { view: DuelCutInView; onSkip: () => void }) {
  const [revealed, setRevealed] = useState(reducedMotion);
  useEffect(() => {
    if (revealed) return;
    const t = setTimeout(() => setRevealed(true), 700);
    return () => clearTimeout(t);
  }, [revealed]);
  const blueP = getProfile(view.blue.charId);
  const redP = getProfile(view.red.charId);
  const label = view.aerial ? '空中戦' : 'フィジカル';
  const bluePct = Math.round(view.blueRate * 100);
  const winRate = view.winner === 'blue' ? view.blueRate : 1 - view.blueRate;
  const upset = winRate < 0.4;
  const winP = view.winner === 'blue' ? blueP : redP;
  const blueLoses = revealed && view.winner !== 'blue';
  const redLoses = revealed && view.winner !== 'red';
  return (
    <div
      className={`duel${revealed ? ' is-revealed' : ''}${view.aerial ? ' duel--air' : ''}`}
      data-testid="duel-cutin"
      onClick={onSkip}
      role="presentation"
    >
      <div className="duel__bg duel__bg--blue a-halftone" />
      <div className="duel__bg duel__bg--red a-halftone" />
      <div className="duel__lines">
        <SpeedLines />
      </div>
      <div className={`duel__bust duel__bust--blue${blueLoses ? ' is-lose' : ''}`}>
        <CharaBust look={blueP.look} team="blue" expression={blueLoses ? 'lose' : 'normal'} />
      </div>
      <div className={`duel__bust duel__bust--red${redLoses ? ' is-lose' : ''}`}>
        <CharaBust look={redP.look} team="red" expression={redLoses ? 'lose' : 'normal'} flip />
      </div>
      <StatPlate team="blue" charId={view.blue.charId} label={label} value={view.blue.value} />
      <StatPlate team="red" charId={view.red.charId} label={label} value={view.red.value} />
      <div className={`duel__win duel__win--${view.winner}`}>
        <Starburst points={12} />
        <b className="a-head">WIN!</b>
        {upset && <span>番狂わせ！</span>}
      </div>
      <div className="duel__title">
        <Starburst points={16} />
        <span className="duel__en a-head a-head--yellow">{view.aerial ? 'AIR' : 'DUEL'}</span>
        <span className="duel__jp a-head">{view.aerial ? '空中戦!!' : '競り合い!!'}</span>
      </div>
      <div className="duel__rate">
        <span className="duel__rate-cap a-num">WIN RATE</span>
        <div className="duel__rate-bar">
          <span className="duel__rate-blue a-num" style={{ flexBasis: `${bluePct}%` }}>
            {bluePct}%
          </span>
          <span className="duel__rate-red a-num" style={{ flexBasis: `${100 - bluePct}%` }}>
            {100 - bluePct}%
          </span>
        </div>
      </div>
      {revealed && (
        <div className="duel__say a-panel a-panel--paper">
          <span className={`duel__who a-tag a-tag--${view.winner}`}>
            {winP.name} #{winP.number}
          </span>
          <p>「{winP.quotes.duel}」</p>
          <div className={`duel__line duel__line--${view.winner}`}>{view.resultLine}</div>
        </div>
      )}
    </div>
  );
}
