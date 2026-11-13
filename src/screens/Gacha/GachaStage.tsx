import { useEffect, useRef, useState } from 'react';
import { BallG, CharaBust, SpeedLines, Stars } from '../../components/Chara';
import { Avatar } from '../../components/Shell/CharaCard';
import { charaInfo } from '../../components/Shell/chara';
import type { PullResult } from '../../meta/gacha';
import type { Rarity } from '../../game/data/roster';

export type StagePhase = 'ball' | 'card' | 'result';

interface Props {
  results: PullResult[];
  canAgain: boolean;
  onClose: () => void;
  onAgain: () => void;
  /** QA only: start in this phase and do not advance by timer. */
  hold?: StagePhase;
  holdIndex?: number;
}

const prefersReduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 16-point star used as the burst shape.
const STAR = Array.from({ length: 32 }, (_, i) => {
  const a = (i * Math.PI) / 16;
  const r = i % 2 ? 34 : 50;
  return `${(50 + r * Math.sin(a)).toFixed(1)}% ${(50 - r * Math.cos(a)).toFixed(1)}%`;
}).join(',');

export function GachaStage({ results, canAgain, onClose, onAgain, hold, holdIndex = 0 }: Props) {
  const [phase, setPhase] = useState<StagePhase>(() => hold ?? (prefersReduced() ? 'result' : 'ball'));
  const [idx, setIdx] = useState(hold ? holdIndex : 0);
  const born = useRef(performance.now());
  const skip = () => {
    if (performance.now() - born.current < 350) return; // a double tap on a pull button must not skip the reveal
    setPhase('result');
  };
  const best = results.reduce<Rarity>((m, r) => (r.rarity > m ? r.rarity : m), 3);

  useEffect(() => {
    if (hold || phase === 'result') return;
    const cur = results[idx];
    const ms = phase === 'ball' ? 1700 : cur.rarity === 5 ? 2600 : results.length === 1 ? 1500 : 850;
    const t = window.setTimeout(() => {
      if (phase === 'ball') {
        setIdx(0);
        setPhase('card');
      } else if (idx + 1 < results.length) setIdx(idx + 1);
      else setPhase('result');
    }, ms);
    return () => window.clearTimeout(t);
  }, [phase, idx, hold, results]);

  return (
    <div className={`gstage gstage--t${best}`} data-testid="gacha-stage">
      <div className="gstage__bg a-stage" />
      {phase === 'ball' && (
        <div className="gstage__ballwrap" key="ball">
          <div className="gstage__ring" />
          <div className="gstage__burst" style={{ clipPath: `polygon(${STAR})` }} />
          <svg className="gstage__ball" viewBox="-14 -14 28 28" aria-hidden="true">
            <BallG r={12} />
          </svg>
          <div className="gstage__flash" />
        </div>
      )}
      {phase === 'card' && <RevealCard key={idx} r={results[idx]} index={idx} total={results.length} />}
      {phase === 'result' && (
        <div className="gres" data-testid="gacha-result">
          <h2 className="a-head a-head--lg gres__title">RESULT</h2>
          <ul className={`gres__list${results.length === 1 ? ' is-single' : ''}`}>
            {results.map((r, i) => {
              const { profile, def } = charaInfo(r.charId);
              return (
                <li key={i} className={`gres__item gres__item--r${r.rarity}`} style={{ animationDelay: `${Math.min(i, 9) * 50}ms` }} data-testid={`gacha-card-${i}`}>
                  <span className="gres__face"><Avatar id={r.charId} /></span>
                  <span className="gres__text">
                    <Stars rarity={r.rarity} size={results.length === 1 ? 18 : 12} />
                    <b className="gres__name">{def.name}</b>
                    <span className="gres__title2">{profile.title}</span>
                    {r.isNew ? <span className="gres__tag a-tag">NEW</span> : <span className="gres__tag a-tag a-tag--dark">+{r.refund}コイン</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          {!canAgain && <p className="gres__short" data-testid="gacha-again-short">コインが足りません</p>}
          <div className="gres__btns">
            <button type="button" className="a-btn a-btn--dark" onClick={onClose} data-testid="gacha-result-close"><span>閉じる</span></button>
            <button type="button" className="a-btn a-btn--yellow" onClick={onAgain} disabled={!canAgain} data-testid="gacha-again"><span>もう一度引く</span></button>
          </div>
        </div>
      )}
      {phase !== 'result' && (
        <button type="button" className="gstage__skip" onClick={skip} data-testid="gacha-skip" aria-label="スキップ">
          <span>TAPでスキップ</span>
        </button>
      )}
    </div>
  );
}

function RevealCard({ r, index, total }: { r: PullResult; index: number; total: number }) {
  const { profile, def, team } = charaInfo(r.charId);
  if (r.rarity === 5) {
    return (
      <div className="gcut" data-testid="gacha-cut">
        <div className="gcut__bg" />
        <div className="gcut__rays"><SpeedLines /></div>
        <div className="gcut__bust"><CharaBust look={profile.look} team={team} expression="win" /></div>
        <div className="gcut__text">
          <div className="gcut__rare a-num">★5 SUPER RARE</div>
          <div className="gcut__title a-head a-head--yellow">{profile.title}</div>
          <div className="gcut__name a-head">{def.name}</div>
          <Stars rarity={5} size={26} />
        </div>
        {r.isNew && <span className="gcut__new a-tag">NEW</span>}
        {total > 1 && <span className="gcut__count a-num">{index + 1} / {total}</span>}
      </div>
    );
  }
  return (
    <div className="grev" data-testid="gacha-reveal">
      <div className={`grev__card grev__card--r${r.rarity} a-panel`}>
        <div className="grev__rays"><SpeedLines /></div>
        <div className="grev__bust"><CharaBust look={profile.look} team={team} /></div>
        <div className="grev__info">
          <Stars rarity={r.rarity} size={18} />
          <span className="grev__title">{profile.title}</span>
          <b className="a-head a-head--lg grev__name">{def.name}</b>
        </div>
        {r.isNew && <span className="grev__new a-tag">NEW</span>}
      </div>
      {total > 1 && <span className="grev__count a-num">{index + 1} / {total}</span>}
    </div>
  );
}
