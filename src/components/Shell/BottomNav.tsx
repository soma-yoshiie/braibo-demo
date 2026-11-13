import type { ReactNode } from 'react';
import { claimableCount } from '../../meta/missions';
import type { SaveData } from '../../meta/save';
import { useToday, type Screen } from './actions';
import './Shell.css';

export type Tab = 'home' | 'stage' | 'box' | 'team' | 'gacha' | 'mission';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
const ICONS: Record<Tab, ReactNode> = {
  home: <path d="M3 11 12 3l9 8M5.5 9.5V20h13V9.5M10 20v-6h4v6" {...stroke} />,
  stage: <path d="M5 21V4M5 5h12l-2.5 3.5L17 12H5" {...stroke} />,
  box: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" {...stroke} />,
  team: (
    <>
      <path d="M3 5h18v14H3zM12 5v14" {...stroke} />
      <circle cx="12" cy="12" r="2.6" {...stroke} />
    </>
  ),
  gacha: (
    <>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="m12 6.5 1.7 3.6 3.9.4-2.9 2.6.8 3.9L12 15l-3.5 2 .8-3.9-2.9-2.6 3.9-.4Z" {...stroke} />
    </>
  ),
  mission: <path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h3" {...stroke} />,
};
const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'ホーム' },
  { key: 'stage', label: 'ステージ' },
  { key: 'box', label: '選手' },
  { key: 'team', label: '編成' },
  { key: 'gacha', label: 'スカウト' },
  { key: 'mission', label: 'ミッション' },
];

export function BottomNav({ current, onNav, save }: { current: Tab; onNav: (s: Screen) => void; save: SaveData }) {
  const claimable = claimableCount(save, useToday());
  return (
    <nav className="bnav" aria-label="メニュー">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`bnav__btn${current === t.key ? ' is-on' : ''}`}
          onClick={() => onNav(t.key)}
          data-testid={`nav-${t.key}`}
          aria-current={current === t.key ? 'page' : undefined}
        >
          <span className="bnav__in">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{ICONS[t.key]}</svg>
            <span>{t.label}</span>
          </span>
          {t.key === 'mission' && claimable > 0 && (
            <span className="bnav__badge a-num" data-testid="nav-mission-badge">{claimable}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
