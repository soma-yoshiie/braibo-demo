import './Overlays.css';

export interface BannerView {
  id: number;
  text: string;
  sub?: string;
  team?: 'blue' | 'red';
  big?: boolean;
}

export function EventBanner({ banner }: { banner: BannerView | null }) {
  if (!banner) return null;
  return (
    <div
      key={banner.id}
      className={`banner${banner.big ? ' banner--big' : ''}${banner.team ? ` banner--${banner.team}` : ''}`}
      data-testid="banner"
    >
      <div className="banner__text">{banner.text}</div>
      {banner.sub && <div className="banner__sub">{banner.sub}</div>}
    </div>
  );
}
