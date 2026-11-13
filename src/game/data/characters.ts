import type { CharacterDef, Stats, TypeId } from '../types';
import { ROSTER, splitCharId } from './roster';
import { DEFAULT_POSITION, GK_BASE, GK_TYPE_MOD, POSITION_MOD, TYPE_LABEL } from './positions';

const mk = (id: TypeId, description: string, moves: CharacterDef['moves'], stats: Stats, skills: CharacterDef['skills']): CharacterDef => ({
  id,
  type: id,
  position: DEFAULT_POSITION[id],
  name: TYPE_LABEL[id],
  abbr: DEFAULT_POSITION[id],
  description,
  moves,
  stats,
  skills,
});

/**
 * The five types (DESIGN.md §15.1). A type owns movement, base stats and skills; the id of a type is also
 * a valid character id (a bare, uncorrected player, used by tests and as the base of the roster).
 * Movement vectors are TEAM-RELATIVE: dy < 0 is forward.
 */
export const CHARACTERS: CharacterDef[] = [
  mk(
    'physical',
    '移動は周囲1マス。競り合い・空中戦・ブロックが強い。',
    [
      { dx: 0, dy: -1, range: 1 },
      { dx: 0, dy: 1, range: 1 },
      { dx: -1, dy: 0, range: 1 },
      { dx: 1, dy: 0, range: 1 },
      { dx: -1, dy: -1, range: 1 },
      { dx: 1, dy: -1, range: 1 },
      { dx: -1, dy: 1, range: 1 },
      { dx: 1, dy: 1, range: 1 },
    ],
    { physical: 90, aerial: 85, shoot: 35, longShot: 30, pass: 50, cross: 35, intercept: 55, block: 85 },
    ['blockMaster', 'airBattler'],
  ),
  mk(
    'speed',
    '前後左右に広く動ける。クロスが得意、競り合いは弱い。',
    [
      { dx: 0, dy: -1, range: 2 },
      { dx: -1, dy: 0, range: 2 },
      { dx: 1, dy: 0, range: 2 },
      { dx: -1, dy: -1, range: 1 },
      { dx: 1, dy: -1, range: 1 },
      { dx: 0, dy: 1, range: 1 },
    ],
    { physical: 40, aerial: 40, shoot: 60, longShot: 45, pass: 70, cross: 85, intercept: 45, block: 30 },
    [],
  ),
  mk(
    'technical',
    '前方へ最大2マス。近距離シュートが強いが守備は苦手。',
    [
      { dx: 0, dy: -1, range: 2 },
      { dx: -1, dy: -1, range: 1 },
      { dx: 1, dy: -1, range: 1 },
      { dx: -1, dy: 0, range: 1 },
      { dx: 1, dy: 0, range: 1 },
      { dx: 0, dy: 1, range: 1 },
    ],
    { physical: 55, aerial: 60, shoot: 85, longShot: 45, pass: 55, cross: 40, intercept: 35, block: 30 },
    ['oneTouch'],
  ),
  mk(
    'support',
    '斜めに素早く動きパスコースを遮断する。ボール奪取率が高い。',
    [
      { dx: -1, dy: -1, range: 2 },
      { dx: 1, dy: -1, range: 2 },
      { dx: -1, dy: 1, range: 2 },
      { dx: 1, dy: 1, range: 2 },
      { dx: 0, dy: -1, range: 1 },
      { dx: 0, dy: 1, range: 1 },
    ],
    { physical: 60, aerial: 55, shoot: 50, longShot: 45, pass: 65, cross: 50, intercept: 90, block: 55 },
    ['counter'],
  ),
  mk(
    'playmaker',
    '移動は狭いが長いパスとミドルシュートが得意。',
    [
      { dx: 0, dy: -1, range: 1 },
      { dx: 0, dy: 1, range: 1 },
      { dx: -1, dy: 0, range: 1 },
      { dx: 1, dy: 0, range: 1 },
      { dx: -1, dy: -1, range: 1 },
      { dx: 1, dy: -1, range: 1 },
    ],
    { physical: 45, aerial: 45, shoot: 55, longShot: 80, pass: 80, cross: 50, intercept: 40, block: 35 },
    ['passMaster'],
  ),
];

const BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

const clamp = (v: number): number => Math.min(99, Math.max(1, v));

const PROFILE_BY_ID = new Map(ROSTER.map((p) => [p.id, p]));
const ROSTER_CACHE = new Map<string, CharacterDef>();

function resolveBase(id: string): CharacterDef {
  const c = BY_ID.get(id);
  if (c) return c;
  const cached = ROSTER_CACHE.get(id);
  if (cached) return cached;
  const profile = PROFILE_BY_ID.get(id);
  const base = profile ? BY_ID.get(profile.type) : undefined;
  if (!profile || !base) throw new Error(`Unknown character: ${id}`);
  // Field players: type base + position correction + bonus. Goalkeepers: common base + type slope + bonus.
  const stats: Stats =
    profile.position === 'GK'
      ? { ...GK_BASE }
      : { ...base.stats };
  const mod: Partial<Stats> = profile.position === 'GK' ? GK_TYPE_MOD[profile.type] : POSITION_MOD[profile.position];
  for (const k of Object.keys(stats) as (keyof Stats)[]) stats[k] = clamp(stats[k] + (mod[k] ?? 0) + (profile.bonus[k] ?? 0));
  const out: CharacterDef = { ...base, id: profile.id, name: profile.name, position: profile.position, abbr: profile.position, stats, ...(profile.position === 'GK' ? { skills: [] } : {}) };
  ROSTER_CACHE.set(id, out);
  return out;
}

/**
 * Resolves archetype ids, roster ids (§12.1) and `x+n` ids (all stats +n, capped at 99, §13.1).
 * Throws on anything unknown or a malformed suffix.
 */
export function getCharacter(id: string): CharacterDef {
  const { base, plus } = splitCharId(id);
  const def = resolveBase(base);
  if (plus === 0) return def;
  const cached = ROSTER_CACHE.get(id);
  if (cached) return cached;
  const stats = { ...def.stats };
  for (const k of Object.keys(stats) as (keyof Stats)[]) stats[k] = clamp(stats[k] + plus);
  const out: CharacterDef = { ...def, id, stats };
  ROSTER_CACHE.set(id, out);
  return out;
}

