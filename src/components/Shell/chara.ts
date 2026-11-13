import { getCharacter } from '../../game/data/characters';
import { GK_BASE, GK_TYPE_MOD, POSITION_MOD } from '../../game/data/positions';
import { getProfile, splitCharId, type CharaProfile } from '../../game/data/roster';
import type { SkillId, Stats } from '../../game/types';
import type { TeamId } from '../Chara';

export const SKILL_LABEL: Record<SkillId, string> = {
  counter: 'カウンター',
  oneTouch: 'ワンタッチ',
  airBattler: 'エアバトラー',
  passMaster: 'パスマスター',
  blockMaster: 'ブロックマスター',
};

export const STAT_ORDER: (keyof Stats)[] = ['physical', 'aerial', 'shoot', 'longShot', 'pass', 'cross', 'intercept', 'block'];
export const STAT_LABEL: Record<keyof Stats, string> = {
  physical: 'フィジカル',
  aerial: '空中戦',
  shoot: 'シュート',
  longShot: '遠距離',
  pass: 'パス',
  cross: 'クロス',
  intercept: '奪取',
  block: 'ブロック',
};
/** Goalkeepers only: block is called セーブ, aerial ハイボール (DESIGN-UI §17.6). */
export const KEEPER_STAT_LABEL: Record<'block' | 'aerial', string> = { block: 'セーブ', aerial: 'ハイボール' };

export const teamOf = (p: CharaProfile): TeamId => (p.group === 'rival' ? 'red' : 'blue');

const clamp = (v: number): number => Math.min(99, Math.max(1, v));

/**
 * Base stats a character starts from: the type's base + position correction (field players), or the common
 * keeper base + the type's slope (goalkeepers). Anything above this is bonus / strengthening (shown as +n).
 */
export function baseStatsFor(id: string): Stats {
  const { base } = splitCharId(id);
  const p = getProfile(base);
  const t = getCharacter(p.type).stats;
  const start: Stats = p.position === 'GK' ? { ...GK_BASE } : { ...t };
  const mod: Partial<Stats> = p.position === 'GK' ? GK_TYPE_MOD[p.type] : POSITION_MOD[p.position];
  const out = { ...start };
  for (const k of STAT_ORDER) out[k] = clamp(start[k] + (mod[k] ?? 0));
  return out;
}

export function charaInfo(id: string) {
  const profile = getProfile(id);
  const def = getCharacter(id);
  return { profile, def, abbr: def.abbr, team: teamOf(profile), keeper: profile.position === 'GK' };
}

export const TYPE_FILTER_PREFIX = 'box-type-';
