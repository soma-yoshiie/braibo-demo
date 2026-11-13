import { useState } from 'react';
import type { TeamId } from '../../game/types';
import { Crest } from '../Chara';
import { BallIcon } from '../Player/PlayerToken';
import './HUD.css';

interface Props {
  score: Record<TeamId, number>;
  turn: number;
  maxTurns: number;
  /** 1 / 2 when the match has halves (null = no halves). */
  half?: 1 | 2 | null;
  possession: TeamId | 'loose';
  /** null = timer disabled */
  secondsLeft: number | null;
  /** Length of one planning timer in seconds (for the bar). */
  timerMax: number;
  /** Team whose score just changed (plays a bump animation). */
  bump?: { team: TeamId; key: number } | null;
  onOpenLog: () => void;
  onRestart: () => void;
  onHome: () => void;
  busy?: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
}

const TEAM_NAME: Record<TeamId, string> = { blue: '蒼嵐', red: '紅蓮' };

function PossBall() {
  return (
    <svg className="hud__ball" viewBox="-0.24 -0.24 0.48 0.48" width="18" height="18" data-testid="possession-ball">
      <BallIcon r={0.22} />
    </svg>
  );
}

function fmt(sec: number): string {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const POSS_LABEL: Record<TeamId | 'loose', string> = {
  blue: '蒼嵐ボール',
  red: '紅蓮ボール',
  loose: 'ルーズボール',
};

type Confirm = null | 'restart' | 'home';

export function HUD({
  score,
  turn,
  maxTurns,
  half = null,
  possession,
  secondsLeft,
  timerMax,
  bump,
  onOpenLog,
  onRestart,
  onHome,
  busy,
  menuOpen,
  onMenuOpenChange,
}: Props) {
  const [confirming, setConfirming] = useState<Confirm>(null);
  const setMenuOpen = onMenuOpenChange;
  const closeMenu = () => {
    setMenuOpen(false);
    setConfirming(null);
  };
  const warn = secondsLeft !== null && secondsLeft < 10;
  const pctLeft = secondsLeft === null ? 0 : Math.max(0, Math.min(1, secondsLeft / Math.max(1, timerMax)));
  const num = (team: TeamId) => (
    <span
      key={bump && bump.team === team ? bump.key : 'n'}
      className={`hud__num a-num hud__num--${team}${bump && bump.team === team ? ' is-bump' : ''}`}
    >
      {score[team]}
    </span>
  );
  const crest = (team: TeamId) => (
    <span className="hud__crest">
      <Crest team={team} size={26} />
      {possession === team && <PossBall />}
    </span>
  );
  return (
    <header className="hud" aria-label={POSS_LABEL[possession]}>
      <div className="hud__row">
        <button
          className="hud__btn"
          onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
          aria-label="メニュー"
          aria-expanded={menuOpen}
          data-testid="menu-button"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
            <path d="M5 7 H19 M5 12 H19 M5 17 H19" />
          </svg>
        </button>
        <div className="hud__plates">
          <div className="hud__plate hud__plate--blue">
            <div className="hud__plate-in">
              {crest('blue')}
              <span className="hud__name">{TEAM_NAME.blue}</span>
              {num('blue')}
            </div>
          </div>
          <div className="hud__plate hud__plate--red">
            <div className="hud__plate-in">
              {num('red')}
              <span className="hud__name">{TEAM_NAME.red}</span>
              {crest('red')}
            </div>
          </div>
          {possession === 'loose' && (
            <span className="hud__loose a-num" data-testid="possession-loose">
              LOOSE
            </span>
          )}
        </div>
        <div className="hud__turnwrap">
        <div className="hud__turn" data-testid="turn">
          <span className="hud__turn-label a-num">TURN</span>
          <span className="hud__turn-val">
            <b className="a-num">{Math.min(turn, maxTurns)}</b>
            <span className="a-num">/{maxTurns}</span>
          </span>
        </div>
        {half && (
          <span className="hud__half" data-testid="half">
            {half === 1 ? '前半' : '後半'}
          </span>
        )}
        </div>
      </div>
      {secondsLeft !== null && (
      <div className={`hud__clock${warn ? ' is-warn' : ''}`}>
        <span className="hud__clock-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
            <path d="M12 7 V12 L15.5 14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </span>
        <span className="hud__timer a-num" data-testid="hud-timer">
          {fmt(secondsLeft ?? 0)}
        </span>
        <span className="hud__bar" aria-hidden="true">
          <i style={{ width: `${pctLeft * 100}%` }} />
        </span>
      </div>
      )}
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
      {menuOpen && (
        <>
          <div className="hud__scrim" onClick={closeMenu} />
          <div className="hud__menu a-panel" data-testid="hud-menu">
            {confirming ? (
              <>
                <div className="hud__confirm">{confirming === 'home' ? '試合をやめてホームへ戻りますか？' : '本当にやり直しますか？'}</div>
                <div className="hud__confirm-row">
                  <button
                    className="a-btn a-btn--red a-btn--sm"
                    data-testid={confirming === 'home' ? 'home-confirm-yes' : 'restart-yes'}
                    onClick={() => {
                      const go = confirming;
                      closeMenu();
                      if (go === 'home') onHome();
                      else onRestart();
                    }}
                  >
                    <span>はい</span>
                  </button>
                  <button
                    className="a-btn a-btn--dark a-btn--sm"
                    data-testid={confirming === 'home' ? 'home-confirm-no' : 'restart-no'}
                    onClick={closeMenu}
                  >
                    <span>いいえ</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  className="a-btn a-btn--dark a-btn--sm a-btn--block"
                  data-testid="menu-log"
                  onClick={() => {
                    closeMenu();
                    onOpenLog();
                  }}
                >
                  <span>試合ログ</span>
                </button>
                <button
                  className="a-btn a-btn--dark a-btn--sm a-btn--block"
                  data-testid="menu-restart"
                  disabled={busy}
                  onClick={() => setConfirming('restart')}
                >
                  <span data-testid="restart">最初からやり直す</span>
                </button>
                <button
                  className="a-btn a-btn--dark a-btn--sm a-btn--block"
                  data-testid="menu-home"
                  disabled={busy}
                  onClick={() => setConfirming('home')}
                >
                  <span>ホームへ戻る</span>
                </button>
                <button className="a-btn a-btn--dark a-btn--sm a-btn--block" onClick={closeMenu}>
                  <span>閉じる</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </header>
  );
}
