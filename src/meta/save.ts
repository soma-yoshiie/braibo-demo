import type { RoleId, TeamId } from '../game/types';
import { ROLE_ORDER, SCOUT_POOL, STARTER_IDS, getProfile, withPlus } from '../game/data/roster';
import { getCharacter } from '../game/data/characters';
import { META } from './config';
import { STAGES, getStage } from './stages';

export interface SaveSettings { timerOn: boolean; throughEarly: boolean; cutIn: boolean }
export interface StageRecord { cleared: boolean; bestDiff: number | null }
export interface DailyState { date: string; played: number; won: number; pulls: number; claimed: string[] }
export interface SaveData {
  v: 2;
  coins: number;
  owned: Record<string, number>;
  lineup: Record<RoleId, string>;
  levels: Record<string, number>;
  settings: SaveSettings;
  record: { played: number; won: number; drawn: number; lost: number; goals: number };
  pulls: number;
  levelUps: number;
  rank: number;
  exp: number;
  stages: Record<string, StageRecord>;
  daily: DailyState;
  claimed: string[];
  login: { lastDate: string; day: number };
}

const OWNABLE = new Set(SCOUT_POOL.map((p) => p.id));

function starterLineup(): Record<RoleId, string> {
  return { ...STARTER_IDS };
}

export function emptyDaily(date: string): DailyState {
  return { date, played: 0, won: 0, pulls: 0, claimed: [] };
}

export function defaultSave(): SaveData {
  const owned: Record<string, number> = {};
  for (const role of ROLE_ORDER) owned[STARTER_IDS[role]] = 1;
  return {
    v: 2,
    coins: META.startCoins,
    owned,
    lineup: starterLineup(),
    levels: {},
    settings: { ...META.defaultSettings },
    record: { played: 0, won: 0, drawn: 0, lost: 0, goals: 0 },
    pulls: 0,
    levelUps: 0,
    rank: 1,
    exp: 0,
    stages: {},
    daily: emptyDaily(''),
    claimed: [],
    login: { lastDate: '', day: 0 },
  };
}

/** Exp needed to leave `rank`. */
export function expNeed(rank: number): number {
  return META.rank.base + META.rank.step * (rank - 1);
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const count = (x: unknown, fallback: number): number =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : fallback;
const bool = (x: unknown, fallback: boolean): boolean => (typeof x === 'boolean' ? x : fallback);
const strings = (x: unknown): string[] => (Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === 'string'))] : []);

/** Reads a v1 or v2 save (or garbage) and returns a valid v2 save. */
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
  const levels: Record<string, number> = {};
  if (isObj(raw.levels)) {
    for (const [id, n] of Object.entries(raw.levels)) {
      if (owned[id] !== undefined && typeof n === 'number' && Number.isFinite(n)) {
        const lv = Math.min(META.level.max, Math.max(1, Math.floor(n)));
        if (lv > 1) levels[id] = lv;
      }
    }
  }
  const s = isObj(raw.settings) ? raw.settings : {};
  const r = isObj(raw.record) ? raw.record : {};
  const rank = Math.max(1, count(raw.rank, 1));
  const exp = Math.min(count(raw.exp, 0), expNeed(rank) - 1);
  const stages: Record<string, StageRecord> = {};
  if (isObj(raw.stages)) {
    for (const st of STAGES) {
      const v = raw.stages[st.id];
      if (!isObj(v)) continue;
      const bd = v.bestDiff;
      stages[st.id] = {
        cleared: bool(v.cleared, false),
        bestDiff: typeof bd === 'number' && Number.isFinite(bd) ? Math.trunc(bd) : null,
      };
    }
  }
  const d = isObj(raw.daily) ? raw.daily : {};
  const lg = isObj(raw.login) ? raw.login : {};
  return {
    v: 2,
    coins: count(raw.coins, 0),
    owned,
    lineup,
    levels,
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
      goals: count(r.goals, 0),
    },
    pulls: count(raw.pulls, 0),
    levelUps: count(raw.levelUps, 0),
    rank,
    exp,
    stages,
    daily: {
      date: typeof d.date === 'string' ? d.date : '',
      played: count(d.played, 0),
      won: count(d.won, 0),
      pulls: count(d.pulls, 0),
      claimed: strings(d.claimed),
    },
    claimed: strings(raw.claimed),
    login: { lastDate: typeof lg.lastDate === 'string' ? lg.lastDate : '', day: count(lg.day, 0) },
  };
}

export function levelOf(save: SaveData, baseId: string): number {
  return Math.min(META.level.max, Math.max(1, save.levels[baseId] ?? 1));
}

/** Slot order (ST, WG, LS, IC, DF), each with `+(Lv-1)` applied. */
export function lineupIds(save: SaveData): string[] {
  return ROLE_ORDER.map((r) => withPlus(save.lineup[r], levelOf(save, save.lineup[r]) - 1));
}

/** Sum of all 8 stats of the given characters (`+n` ids allowed). */
export function teamPower(charIds: string[]): number {
  let sum = 0;
  for (const id of charIds) for (const v of Object.values(getCharacter(id).stats)) sum += v;
  return sum;
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

// --- strengthening -----------------------------------------------------------

/** Coins for the next level of `baseId`, or null when it cannot be levelled (not owned / max). */
export function levelUpCost(save: SaveData, baseId: string): number | null {
  if ((save.owned[baseId] ?? 0) < 1) return null;
  const lv = levelOf(save, baseId);
  if (lv >= META.level.max) return null;
  return META.level.costs[lv - 1] ?? null;
}

export function canLevelUp(save: SaveData, baseId: string): boolean {
  const cost = levelUpCost(save, baseId);
  return cost !== null && save.coins >= cost;
}

export function levelUp(save: SaveData, baseId: string): SaveData {
  const cost = levelUpCost(save, baseId);
  if (cost === null || save.coins < cost) return save;
  return {
    ...save,
    coins: save.coins - cost,
    levels: { ...save.levels, [baseId]: levelOf(save, baseId) + 1 },
    levelUps: save.levelUps + 1,
  };
}

// --- daily -------------------------------------------------------------------

/** Clears the daily counters when `today` is later than the stored date (the clock never moves backwards). Same object otherwise. */
export function rolloverDaily(save: SaveData, today: string): SaveData {
  return today > save.daily.date ? { ...save, daily: emptyDaily(today) } : save;
}

// --- matches -----------------------------------------------------------------

export function matchReward(score: Record<TeamId, number>): { result: 'win' | 'draw' | 'lose'; coins: number } {
  if (score.blue > score.red) return { result: 'win', coins: META.reward.win };
  if (score.blue < score.red) return { result: 'lose', coins: META.reward.lose };
  return { result: 'draw', coins: META.reward.draw };
}

export interface ResultSummary {
  result: 'win' | 'draw' | 'lose';
  coins: number;
  firstClear: number;
  expGain: number;
  rankBefore: number;
  rankAfter: number;
  expBefore: number;
  expAfter: number;
  expNeedAfter: number;
  rankUpCoins: number;
  totalCoins: number;
}

/** What a finished match would give. Does not save. An unknown stageId counts as no stage. */
export function summarizeMatch(save: SaveData, stageId: string, score: Record<TeamId, number>): ResultSummary {
  const { result, coins: baseCoins } = matchReward(score);
  const stage = getStage(stageId);
  const coins = Math.round(baseCoins * (stage?.rewardMul ?? 1));
  const firstClear = stage && result === 'win' && !save.stages[stage.id]?.cleared ? stage.firstClear : 0;
  const expGain = META.exp[result] + META.exp.perGoal * score.blue;
  let rank = save.rank;
  let exp = save.exp + expGain;
  let rankUpCoins = 0;
  while (exp >= expNeed(rank)) {
    exp -= expNeed(rank);
    rank += 1;
    rankUpCoins += META.rank.bonusCoins;
  }
  return {
    result,
    coins,
    firstClear,
    expGain,
    rankBefore: save.rank,
    rankAfter: rank,
    expBefore: save.exp,
    expAfter: exp,
    expNeedAfter: expNeed(rank),
    rankUpCoins,
    totalCoins: coins + firstClear + rankUpCoins,
  };
}

export function applyMatchResult(save: SaveData, stageId: string, score: Record<TeamId, number>, today: string): SaveData {
  const sum = summarizeMatch(save, stageId, score);
  const base = rolloverDaily(save, today);
  const rec = base.record;
  const stage = getStage(stageId);
  const stages = { ...base.stages };
  if (stage) {
    const prev = base.stages[stage.id];
    const diff = score.blue - score.red;
    stages[stage.id] = {
      cleared: (prev?.cleared ?? false) || sum.result === 'win',
      bestDiff: prev?.bestDiff == null ? diff : Math.max(prev.bestDiff, diff),
    };
  }
  return {
    ...base,
    coins: base.coins + sum.totalCoins,
    rank: sum.rankAfter,
    exp: sum.expAfter,
    record: {
      played: rec.played + 1,
      won: rec.won + (sum.result === 'win' ? 1 : 0),
      drawn: rec.drawn + (sum.result === 'draw' ? 1 : 0),
      lost: rec.lost + (sum.result === 'lose' ? 1 : 0),
      goals: rec.goals + score.blue,
    },
    stages,
    daily: {
      ...base.daily,
      played: base.daily.played + 1,
      won: base.daily.won + (sum.result === 'win' ? 1 : 0),
    },
  };
}
