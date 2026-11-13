import type { FieldPosition, Position, Stats, TypeId } from '../types';

/** Type and position names (DESIGN.md §15.1). No imports from the other data files, so they can use this freely. */
export const TYPE_ORDER: TypeId[] = ['physical', 'speed', 'technical', 'support', 'playmaker'];
export const TYPE_LABEL: Record<TypeId, string> = {
  physical: 'フィジカル',
  speed: 'スピード',
  technical: 'テクニカル',
  support: 'サポート',
  playmaker: 'プレイメーカー',
};
export const TYPE_ABBR: Record<TypeId, string> = {
  physical: 'PHY',
  speed: 'SPD',
  technical: 'TEC',
  support: 'SUP',
  playmaker: 'PM',
};
export const POSITION_ORDER: Position[] = ['GK', 'DF', 'MF', 'FW'];
export const POSITION_LABEL: Record<Position, string> = {
  GK: 'ゴールキーパー',
  DF: 'ディフェンダー',
  MF: 'ミッドフィルダー',
  FW: 'フォワード',
};
/** Position of a bare type id (used as a character id) — it gets no position correction. */
export const DEFAULT_POSITION: Record<TypeId, Position> = {
  physical: 'DF',
  speed: 'MF',
  technical: 'FW',
  support: 'DF',
  playmaker: 'MF',
};

/** Field-player stat correction per position (sums to 0, §15.2). Tuning surface. */
export const POSITION_MOD: Record<FieldPosition, Partial<Stats>> = {
  FW: { shoot: 5, longShot: 3, aerial: 2, block: -5, intercept: -5 },
  MF: { pass: 5, cross: 3, intercept: 2, physical: -5, aerial: -5 },
  DF: { block: 5, intercept: 3, physical: 2, shoot: -5, longShot: -5 },
};

/** Goalkeeper common base (only `block` = save and `aerial` = high ball matter in a match). */
export const GK_BASE: Stats = {
  physical: 60,
  aerial: 60,
  shoot: 30,
  longShot: 30,
  pass: 60,
  cross: 40,
  intercept: 50,
  block: 60,
};

/** Goalkeeper slope per type. */
export const GK_TYPE_MOD: Record<TypeId, Partial<Stats>> = {
  physical: { aerial: 8 },
  speed: { block: 6 },
  technical: { block: 3, aerial: 3 },
  support: { aerial: 4, block: 2 },
  playmaker: { pass: 8 },
};
