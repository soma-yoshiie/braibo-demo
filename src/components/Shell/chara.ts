import { CHARACTERS, getCharacter } from '../../game/data/characters';
import { getProfile, type CharaProfile } from '../../game/data/roster';
import type { RoleId, SkillId, Stats } from '../../game/types';
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

export const teamOf = (p: CharaProfile): TeamId => (p.group === 'rival' ? 'red' : 'blue');

export function roleAbbr(role: RoleId): string {
  return CHARACTERS.find((c) => c.role === role)?.abbr ?? '';
}

export function baseStats(role: RoleId): Stats {
  return getCharacter(role).stats;
}

export function charaInfo(id: string) {
  const profile = getProfile(id);
  const def = getCharacter(id);
  return { profile, def, abbr: def.abbr, team: teamOf(profile) };
}

export const ROLE_FILTERS: { key: 'all' | RoleId; label: string }[] = [
  { key: 'all', label: '全員' },
  { key: 'striker', label: 'ST' },
  { key: 'wing', label: 'WG' },
  { key: 'longShooter', label: 'LS' },
  { key: 'interceptor', label: 'IC' },
  { key: 'physicalDefender', label: 'DF' },
];
