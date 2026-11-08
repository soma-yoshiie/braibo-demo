import { useState } from 'react';
import type { TeamId } from '../../game/types';
import './HUD.css';

interface Props {
  score: Record<TeamId, number>;
  turn: number;
  maxTurns: number;
  possession: TeamId | 'loose';
  /** null = timer disabled */
  secondsLeft: number | null;
  onOpenLog: () => void;
  onRestart: () => void;
  busy?: boolean;
}

function fmt(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const POSS_LABEL: Record<TeamId | 'loose', string> = {
  blue: '青ボール',
  red: '赤ボール',
  loose: 'ルーズボール',
};

export function HUD({ score, turn, maxTurns, possession, secondsLeft, onOpenLog, onRestart, busy }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const closeMenu = () => {
    setMenuOpen(false);
    setConfirming(false);
  };
  const urgent = secondsLeft !== null && secondsLeft <= 10;
  return (
    <header className="hud">
      <div className="hud__score" data-testid="score" aria-label="スコア">
        <span className="hud__num hud__num--blue">{score.blue}</span>
        <span className="hud__dash">-</span>
        <span className="hud__num hud__num--red">{score.red}</span>
      </div>
      <div className="hud__mid">
        <div className="hud__turn" data-testid="turn">
          ターン {Math.min(turn, maxTurns)} / {maxTurns}
        </div>
        <div className={`hud__poss hud__poss--${possession}`} data-testid="possession">
          <i className="hud__poss-dot" />
          {POSS_LABEL[possession]}
        </div>
      </div>
      {secondsLeft !== null && (
        <div className={`hud__timer${urgent ? ' is-urgent' : ''}`} data-testid="timer">
          {fmt(secondsLeft)}
        </div>
      )}
      <div className="hud__btns">
        <button className="hud__btn" onClick={onOpenLog} aria-label="ログ" data-testid="log-button">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 6h14M5 12h14M5 18h9" />
          </svg>
        </button>
        <button className="hud__btn" onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))} aria-label="メニュー" data-testid="menu-button">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>
      {menuOpen && (
        <>
          <div className="hud__scrim" onClick={closeMenu} />
          <div className="hud__menu">
            {confirming ? (
              <>
                <div className="hud__confirm">本当にやり直しますか？</div>
                <div className="hud__confirm-row">
                  <button
                    data-testid="restart-yes"
                    onClick={() => {
                      closeMenu();
                      onRestart();
                    }}
                  >
                    はい
                  </button>
                  <button data-testid="restart-no" onClick={closeMenu}>
                    いいえ
                  </button>
                </div>
              </>
            ) : (
              <>
                <button data-testid="restart" disabled={busy} onClick={() => setConfirming(true)}>
                  最初からやり直す
                </button>
                <button onClick={closeMenu}>閉じる</button>
              </>
            )}
          </div>
        </>
      )}
    </header>
  );
}
