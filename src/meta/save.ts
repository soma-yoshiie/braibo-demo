import type { RoleId, TeamId } from '../game/types';
import { ROLE_ORDER, SCOUT_POOL, STARTER_IDS, getProfile } from '../game/data/roster';
import { META } from './config';

export interface SaveSettings { timerOn: boolean; throughEarly: boolean; cutIn: boolean }
export interface SaveData {
  v: 1;
  coins: number;
  owned: Record<string, number>;
  lineup: Record<RoleId, string>;
  settings: SaveSettings;
  record: { played: number; won: number; drawn: number; lost: number };
  pulls: number;
}

const OWNABLE = new Set(SCOUT_POOL.map((p) => p.id));

function starterLineup(): Record<RoleId, string> {
  return { ...STARTER_IDS };
}

export function defaultSave(): SaveData {
  const owned: Record<string, number> = {};
  for (const role of ROLE_ORDER) owned[STARTER_IDS[role]] = 1;
  return {
    v: 1,
    coins: META.startCoins,
    owned,
    lineup: starterLineup(),
    settings: { ...META.defaultSettings },
    record: { played: 0, won: 0, drawn: 0, lost: 0 },
    pulls: 0,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const count = (x: unknown, fallback: number): number =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : fallback;
const bool = (x: unknown, fallback: boolean): boolean => (typeof x === 'boolean' ? x : fallback);

export function parseSave(raw: unknown): SaveData {
  const def = defaultSave();
  if (!isObj(raw)) return def;
  const owned: Record<string, number> = { ...def.owned };
  if (isObj(raw.owned)) {
    for (const [id, n] of Object.entries(raw.owned)) {
      if (OWNABLE.has(id) && typeof n === 'number' && Number.isFinite(n) && n >= 1) owned[id] = Math.floor(n);
    }
  }
  const lineup = starterLineup();
  if (isObj(raw.lineup)) {
    for (const role of ROLE_ORDER) {
      const id = raw.lineup[role];
      if (typeof id === 'string' && (owned[id] ?? 0) >= 1 && OWNABLE.has(id) && getProfile(id).role === role) lineup[role] = id;
    }
  }
  const s = isObj(raw.settings) ? raw.settings : {};
  const r = isObj(raw.record) ? raw.record : {};
  return {
    v: 1,
    coins: count(raw.coins, def.coins),
    owned,
    lineup,
    settings: {
      timerOn: bool(s.timerOn, def.settings.timerOn),
      throughEarly: bool(s.throughEarly, def.settings.throughEarly),
      cutIn: bool(s.cutIn, def.settings.cutIn),
    },
    record: {
      played: count(r.played, 0),
      won: count(r.won, 0),
      drawn: count(r.drawn, 0),
      lost: count(r.lost, 0),
    },
    pulls: count(raw.pulls, 0),
  };
}

/** Slot order (ST, WG, LS, IC, DF). */
export function lineupIds(save: SaveData): string[] {
  return ROLE_ORDER.map((r) => save.lineup[r]);
}

export function setLineup(save: SaveData, role: RoleId, charId: string): SaveData {
  if ((save.owned[charId] ?? 0) < 1) return save;
  let profileRole: RoleId;
  try {
    profileRole = getProfile(charId).role;
  } catch {
    return save;
  }
  if (profileRole !== role || !OWNABLE.has(charId)) return save;
  return { ...save, lineup: { ...save.lineup, [role]: charId } };
}

export function matchReward(score: Record<TeamId, number>): { result: 'win' | 'draw' | 'lose'; coins: number } {
  if (score.blue > score.red) return { result: 'win', coins: META.reward.win };
  if (score.blue < score.red) return { result: 'lose', coins: META.reward.lose };
  return { result: 'draw', coins: META.reward.draw };
}

export function applyMatchResult(save: SaveData, score: Record<TeamId, number>): SaveData {
  const { result, coins } = matchReward(score);
  const rec = save.record;
  return {
    ...save,
    coins: save.coins + coins,
    record: {
      played: rec.played + 1,
      won: rec.won + (result === 'win' ? 1 : 0),
      drawn: rec.drawn + (result === 'draw' ? 1 : 0),
      lost: rec.lost + (result === 'lose' ? 1 : 0),
    },
  };
}
