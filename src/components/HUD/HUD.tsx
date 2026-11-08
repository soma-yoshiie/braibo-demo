import { useState } from 'react';
import type { TeamId } from '../../game/types';
import { BallIcon } from '../Player/PlayerToken';
import './HUD.css';

interface Props {
  score: Record<TeamId, number>;
  turn: number;
  maxTurns: number;
  possession: TeamId | 'loose';
  /** null = timer disabled */
  secondsLeft: number | null;
  totalSeconds: number;
  /** Team whose score just changed (plays a bump animation). */
  bump?: { team: TeamId; key: number } | null;
  onOpenLog: () => void;
  onRestart: () => void;
  busy?: boolean;
}

function Emblem({ team }: { team: TeamId }) {
  return (
    <svg className={`emblem emblem--${team}`} viewBox="-12 -12 24 24" width="26" height="26" aria-hidden="true">
      <defs>
        <radialGradient id={`emb-${team}`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor={team === 'blue' ? '#7db4ff' : '#ff8e96'} />
          <stop offset="0.6" stopColor={team === 'blue' ? '#3d8bff' : '#ff4d5a'} />
          <stop offset="1" stopColor={team === 'blue' ? '#1b4fb8' : '#b3202d'} />
        </radialGradient>
      </defs>
      <path
        d="M0 -11 L9.5 -7.5 L9.5 1.5 Q9.5 8 0 11.5 Q-9.5 8 -9.5 1.5 L-9.5 -7.5 Z"
        fill={`url(#emb-${team})`}
        stroke="#070d1a"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M0 -11 L9.5 -7.5 L9.5 1.5 Q9.5 8 0 11.5 Z" fill="rgba(255,255,255,0.12)" />
      <path d="M-5 -2 L0 -6.5 L5 -2 L3 4 L-3 4 Z" fill="#fff" fillOpacity="0.9" />
    </svg>
  );
}

function PossBall() {
  return (
    <svg className="hud__ball" viewBox="-0.22 -0.22 0.44 0.44" width="16" height="16" data-testid="possession-ball">
      <BallIcon r={0.2} />
    </svg>
  );
}

function fmt(sec: number): string {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const POSS_LABEL: Record<TeamId | 'loose', string> = {
  blue: '青ボール',
  red: '赤ボール',
  loose: 'ルーズボール',
};

export function HUD({
  score,
  turn,
  maxTurns,
  possession,
  secondsLeft,
  totalSeconds,
  bump,
  onOpenLog,
  onRestart,
  busy,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const closeMenu = () => {
    setMenuOpen(false);
    setConfirming(false);
  };
  const urgent = secondsLeft !== null && secondsLeft <= 10;
  const ratio = secondsLeft === null ? 0 : Math.max(0, Math.min(1, secondsLeft / totalSeconds));
  const num = (team: TeamId) => (
    <span
      key={bump && bump.team === team ? bump.key : 'n'}
      className={`hud__num hud__num--${team}${bump && bump.team === team ? ' is-bump' : ''}`}
    >
      {score[team]}
    </span>
  );
  return (
    <header className="hud" aria-label={POSS_LABEL[possession]}>
      <div className="hud__plate">
        <div className="hud__side hud__side--blue">
          <Emblem team="blue" />
          <span className="hud__scorewrap">
            {num('blue')}
            {possession === 'blue' && <PossBall />}
          </span>
        </div>
        <div className="hud__mid">
          <div className="hud__turn" data-testid="turn">
            <span className="hud__turn-label">TURN</span>
            <b>{Math.min(turn, maxTurns)}</b>
            <span className="hud__turn-max">/{maxTurns}</span>
          </div>
          {possession === 'loose' && <PossBall />}
        </div>
        <div className="hud__side hud__side--red">
          <span className="hud__scorewrap">
            {num('red')}
            {possession === 'red' && <PossBall />}
          </span>
          <Emblem team="red" />
        </div>
        {/* hidden machine-readable score for tests / a11y */}
        <span className="sr" data-testid="score" aria-label="スコア">
          {score.blue}-{score.red}
        </span>
        <span className="sr" data-testid="possession">
          {POSS_LABEL[possession]}
        </span>
        {secondsLeft !== null && (
          <span className="sr" data-testid="timer">
            {fmt(secondsLeft)}
          </span>
        )}
        <div className="hud__btns">
          <button className="hud__btn" onClick={onOpenLog} aria-label="ログ" data-testid="log-button">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M5 6h14M5 12h14M5 18h9" />
            </svg>
          </button>
          <button
            className="hud__btn"
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
            aria-label="メニュー"
            data-testid="menu-button"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <circle cx="12" cy="5" r="2.2" />
              <circle cx="12" cy="12" r="2.2" />
              <circle cx="12" cy="19" r="2.2" />
            </svg>
          </button>
        </div>
      </div>
      {secondsLeft !== null && (
        <div className={`hud__timerbar${urgent ? ' is-urgent' : ''}`} aria-hidden="true">
          <i style={{ transform: `scaleX(${ratio})` }} />
        </div>
      )}
      {menuOpen && (
        <>
          <div className="hud__scrim" onClick={closeMenu} />
          <div className="hud__menu">
            {confirming ? (
              <>
                <div className="hud__confirm">本当にやり直しますか？</div>
                <div className="hud__confirm-row">
                  <button
                    className="gbtn gbtn--danger"
                    data-testid="restart-yes"
                    onClick={() => {
                      closeMenu();
                      onRestart();
                    }}
                  >
                    はい
                  </button>
                  <button className="gbtn gbtn--neutral" data-testid="restart-no" onClick={closeMenu}>
                    いいえ
                  </button>
                </div>
              </>
            ) : (
              <>
                <button className="gbtn gbtn--neutral" data-testid="restart" disabled={busy} onClick={() => setConfirming(true)}>
                  最初からやり直す
                </button>
                <button className="gbtn gbtn--neutral" onClick={closeMenu}>
                  閉じる
                </button>
              </>
            )}
          </div>
        </>
      )}
    </header>
  );
}
