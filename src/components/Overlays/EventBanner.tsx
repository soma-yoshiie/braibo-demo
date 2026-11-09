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
              <path d="M4 3 L18 3 L14 8.5 L18 14 L4 14 Z" fill="#ffd400" stroke="#1a1400" strokeWidth="1.2" strokeLinejoin="round" />
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

/** White flash + confetti shown on a goal. `fxKey` restarts the animation. */
export function GoalFx({ fxKey }: { fxKey: number | null }) {
  if (fxKey === null) return null;
  return (
    <div className="goalfx" key={fxKey} aria-hidden="true" data-testid="goal-fx">
      <div className="goalfx__flash" />
      {CONFETTI.map((i) => (
        <i key={i} className={`goalfx__c goalfx__c--${i}`} />
      ))}
    </div>
  );
}
