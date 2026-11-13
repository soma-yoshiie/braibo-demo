import { useEffect, useRef, useState, type ReactNode } from 'react';
import { expNeed, type SaveData } from '../../meta/save';
import { prefersReducedMotion } from './actions';
import './Shell.css';

/** Counts a number up/down to `target` in 400ms (jumps with reduced motion). */
export function useCountUp(target: number): number {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const from = cur.current;
    if (from === target) return;
    if (prefersReducedMotion()) {
      cur.current = target;
      setV(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 400);
      const val = Math.round(from + (target - from) * (1 - (1 - k) * (1 - k)));
      cur.current = val;
      setV(val);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

export function Coins({ value }: { value: number }) {
  const shown = useCountUp(value);
  const moving = shown !== value;
  return (
    <div className={`coins${moving ? ' is-ticking' : ''}`} data-testid="coins" data-value={value}>
      <i className="coins__icon" aria-hidden="true" />
      <b className="a-num">{shown.toLocaleString('ja-JP')}</b>
    </div>
  );
}

export function RankBadge({ rank, exp }: { rank: number; exp: number }) {
  const need = expNeed(rank);
  return (
    <div className="rankbox" aria-label={`ランク ${rank}`}>
      <div className="rankbox__shield" data-testid="rank">
        <svg viewBox="-15 -16 30 36" width="34" height="41" aria-hidden="true">
          <path d="M-13 -14 H13 V3 C13 11 6 16 0 18 C-6 16 -13 11 -13 3Z" fill="#151a2d" stroke="#151a2d" strokeWidth="3" strokeLinejoin="round" />
          <path d="M-11 -12 H11 V3 C11 9.5 5 14 0 15.8 C-5 14 -11 9.5 -11 3Z" fill="#25a4ff" stroke="#ffd34d" strokeWidth="1.8" />
          <path d="M-11 -12 H11 V-5 C4 -3 -4 -3 -11 -5Z" fill="#fff" opacity=".35" />
        </svg>
        <b className="a-num">{rank}</b>
      </div>
      <div className="rankbox__col">
        <span className="a-num rankbox__lbl">RANK</span>
        <span className="rankbox__bar" data-testid="rank-exp" data-exp={exp} data-need={need}>
          <i style={{ width: `${Math.min(100, (exp / need) * 100)}%` }} />
        </span>
      </div>
    </div>
  );
}

interface Props {
  title: string;
  save: SaveData;
  right?: ReactNode;
}

export function TopBar({ title, save, right }: Props) {
  return (
    <header className="topbar">
      <RankBadge rank={save.rank} exp={save.exp} />
      <div className="topbar__title">
        <span className="a-head a-head--md">{title}</span>
      </div>
      <div className="topbar__right">
        <Coins value={save.coins} />
        {right}
      </div>
    </header>
  );
}
