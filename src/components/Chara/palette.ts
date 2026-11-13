// global.css :root と同じ値（トークン）＋ キャラ絵だけで使う派生色。
export const INK = '#151a2d'; // --ink
export const GOLD = '#ffd34d'; // --c-yellow
export const GOLD_LO = '#e09a12'; // --c-yellow-lo
export const SKY = '#9ceaff'; // --c-sky

export type TeamId = 'blue' | 'red';

export interface TeamColors {
  jer: string; // ジャージ上
  jerD: string; // ジャージ下
  main: string; // 帯・アクセント
  light: string; // 札の上
  rim: string; // リムライト
  b1: string; // 地の中心
  b2: string; // 地の中間（--c-*-hi 系）
  b3: string; // 地の外（--c-*-lo 系）
  glow: string;
}

export const TEAM: Record<TeamId, TeamColors> = {
  blue: { jer: '#25a4ff', jerD: '#0a45b8', main: '#1c46c8', light: '#25a4ff', rim: SKY, b1: '#d6f8ff', b2: '#25a4ff', b3: '#0a45b8', glow: '#00c2ff' },
  red: { jer: '#ff3b3b', jerD: '#b81224', main: '#b81224', light: '#ff8a00', rim: '#ff9a6a', b1: '#fff0c4', b2: '#ff5a2a', b3: '#b81224', glow: '#ff6a2a' },
};

export const SKIN = {
  fair: { base: '#ffd9bb', shade: '#e9a888', mouth: '#b4574c' },
  tan: { base: '#eab07c', shade: '#c9835a', mouth: '#9c4a3c' },
  brown: { base: '#a96c45', shade: '#7f4a2d', mouth: '#5e2a26' },
} as const;

/** GK のユニフォーム色（チームの色とは別。メダルの地・縁はチーム色のまま）。 */
export const KEEPER: Record<TeamId, { jer: string; jerD: string; main: string }> = {
  blue: { jer: '#c4ec4a', jerD: '#6d9a14', main: '#6d9a14' },
  red: { jer: '#7b8494', jerD: '#2b303c', main: '#2b303c' },
};

/** global.css の --t-* と同じ値。 */
export const TYPE_COLOR = {
  physical: '#f08a24',
  speed: '#27b36a',
  technical: '#8b5cf6',
  support: '#1fa9c9',
  playmaker: '#e8559c',
} as const;
export const TYPE_GLYPH = { physical: '力', speed: '速', technical: '技', support: '援', playmaker: '司' } as const;
export const TYPE_LABEL = {
  physical: 'フィジカル', speed: 'スピード', technical: 'テクニカル', support: 'サポート', playmaker: 'プレイメーカー',
} as const;
