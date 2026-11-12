import type { ReactNode } from 'react';
import type { Screen } from './actions';
import './Shell.css';

type Tab = 'home' | 'box' | 'team' | 'gacha';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
const ICONS: Record<Tab, ReactNode> = {
  home: <path d="M3 11 12 3l9 8M5.5 9.5V20h13V9.5M10 20v-6h4v6" {...stroke} />,
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
};
const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'ホーム' },
  { key: 'box', label: '選手' },
  { key: 'team', label: '編成' },
  { key: 'gacha', label: 'スカウト' },
];

export function BottomNav({ current, onNav }: { current: Tab; onNav: (s: Screen) => void }) {
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
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">{ICONS[t.key]}</svg>
            <span>{t.label}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}
