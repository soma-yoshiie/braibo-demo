import { getProfile } from '../../game/data/roster';
import { CharaBust, SpeedLines } from '../Chara';
import type { GoalFxView } from '../viewTypes';
import './Overlays.css';

export interface BannerView {
  id: number;
  text: string;
  sub?: string;
  team?: 'blue' | 'red';
  big?: boolean;
  /** Draw a small yellow offside flag before the text. */
  flag?: boolean;
}

export function EventBanner({ banner }: { banner: BannerView | null }) {
  if (!banner) return null;
  return (
    <div
      key={banner.id}
      className={`banner${banner.big ? ' banner--big' : ''}${banner.team ? ` banner--${banner.team}` : ''}`}
      data-testid="banner"
    >
      <div className="banner__band">
        <div className="banner__text">
          {banner.flag && (
            <svg className="banner__flag" viewBox="0 0 20 24" aria-hidden="true" data-testid="offside-flag">
              <path d="M3 2 L3 22" stroke="#e8e8e8" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 3 L18 3 L14 8.5 L18 14 L4 14 Z" fill="#ffd34d" stroke="#151a2d" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          )}
          {banner.text}
        </div>
        {banner.sub && <div className="banner__sub">{banner.sub}</div>}
      </div>
    </div>
  );
}

const CONFETTI = Array.from({ length: 8 }, (_, i) => i);

/**
 * Goal effect. With a scorer it is the full-screen cut-in (bust, GOAL!!, quote; a tap skips it);
 * without one (cut-ins off) it is the plain white flash + confetti. `fx.key` restarts the animation.
 */
export function GoalFx({ fx, onSkip }: { fx: GoalFxView | null; onSkip?: () => void }) {
  if (!fx) return null;
  const s = fx.scorer;
  if (!s) {
    return (
      <div className="goalfx" key={fx.key} aria-hidden="true" data-testid="goal-fx">
        <div className="goalfx__flash" />
        {CONFETTI.map((i) => (
          <i key={i} className={`goalfx__c goalfx__c--${i}`} />
        ))}
      </div>
    );
  }
  const p = getProfile(s.charId);
  return (
    <div className={`goalfx goalfx--cut goalfx--${s.team}`} key={fx.key} data-testid="goal-fx" onClick={onSkip} role="presentation">
      <div className="goalfx__bg a-halftone" />
      <div className="goalfx__lines">
        <SpeedLines />
      </div>
      <div className="goalfx__bust">
        <CharaBust look={p.look} team={s.team} expression="win" />
      </div>
      <div className="goalfx__title a-head a-head--yellow">GOAL!!</div>
      <div className="goalfx__who">
        <span className={`a-tag a-tag--${s.team}`}>#{p.number}</span>
        <b>{p.name}</b>
      </div>
      <div className="goalfx__quote a-panel a-panel--paper">「{p.quotes.goal}」</div>
      <div className="goalfx__skip a-num">TAP</div>
    </div>
  );
}
