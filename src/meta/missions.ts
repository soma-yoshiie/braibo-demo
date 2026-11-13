import { SCOUT_POOL } from '../game/data/roster';
import { META } from './config';
import { rolloverDaily, type SaveData } from './save';

export { rolloverDaily };

export interface MissionDef { id: string; kind: 'daily' | 'normal'; title: string; goal: number; reward: number }
export interface MissionState { def: MissionDef; progress: number; done: boolean; claimed: boolean }

export const MISSIONS: MissionDef[] = [
  { id: 'd_play', kind: 'daily', title: '試合を 1 回する', goal: 1, reward: 100 },
  { id: 'd_win', kind: 'daily', title: '試合に 1 回勝つ', goal: 1, reward: 150 },
  { id: 'd_scout', kind: 'daily', title: 'スカウトを 1 回引く', goal: 1, reward: 50 },
  { id: 'n_win1', kind: 'normal', title: '初勝利', goal: 1, reward: 300 },
  { id: 'n_win5', kind: 'normal', title: '通算 5 勝', goal: 5, reward: 500 },
  { id: 'n_goal10', kind: 'normal', title: '通算 10 ゴール', goal: 10, reward: 300 },
  { id: 'n_own10', kind: 'normal', title: '選手を 10 人集める', goal: 10, reward: 500 },
  { id: 'n_lv', kind: 'normal', title: '選手を 1 回強化する', goal: 1, reward: 200 },
  { id: 'n_s3', kind: 'normal', title: '地区決勝をクリア', goal: 1, reward: 500 },
  { id: 'n_s5', kind: 'normal', title: '紅蓮・本気をクリア', goal: 1, reward: 1000 },
];

const POOL_IDS = new Set(SCOUT_POOL.map((p) => p.id));

function rawProgress(save: SaveData, id: string): number {
  switch (id) {
    case 'd_play': return save.daily.played;
    case 'd_win': return save.daily.won;
    case 'd_scout': return save.daily.pulls;
    case 'n_win1':
    case 'n_win5': return save.record.won;
    case 'n_goal10': return save.record.goals;
    case 'n_own10': return Object.keys(save.owned).filter((k) => POOL_IDS.has(k) && save.owned[k] >= 1).length;
    case 'n_lv': return save.levelUps;
    case 'n_s3': return save.stages.s3?.cleared ? 1 : 0;
    case 'n_s5': return save.stages.s5?.cleared ? 1 : 0;
    default: return 0;
  }
}

function stateOf(save: SaveData, def: MissionDef): MissionState {
  const raw = rawProgress(save, def.id);
  return {
    def,
    progress: Math.min(raw, def.goal),
    done: raw >= def.goal,
    claimed: (def.kind === 'daily' ? save.daily.claimed : save.claimed).includes(def.id),
  };
}

export function missionStates(save: SaveData, today: string): MissionState[] {
  const s = rolloverDaily(save, today);
  return MISSIONS.map((d) => stateOf(s, d));
}

export function claimMission(save: SaveData, id: string, today: string): SaveData {
  const s = rolloverDaily(save, today);
  const def = MISSIONS.find((m) => m.id === id);
  if (!def) return save;
  const st = stateOf(s, def);
  if (!st.done || st.claimed) return s === save ? save : s;
  return def.kind === 'daily'
    ? { ...s, coins: s.coins + def.reward, daily: { ...s.daily, claimed: [...s.daily.claimed, id] } }
    : { ...s, coins: s.coins + def.reward, claimed: [...s.claimed, id] };
}

export function claimAllMissions(save: SaveData, today: string): { save: SaveData; coins: number } {
  let cur = rolloverDaily(save, today);
  let coins = 0;
  for (const st of missionStates(cur, today)) {
    if (st.done && !st.claimed) {
      cur = claimMission(cur, st.def.id, today);
      coins += st.def.reward;
    }
  }
  return { save: cur, coins };
}

export function claimableCount(save: SaveData, today: string): number {
  return missionStates(save, today).filter((m) => m.done && !m.claimed).length;
}

// --- login bonus -------------------------------------------------------------

/** Today's login reward if not yet claimed. `day` is the 1-based position in the 7-day cycle (1..7). */
export function loginBonus(save: SaveData, today: string): { day: number; coins: number } | null {
  if (!(today > save.login.lastDate)) return null;
  const i = save.login.day % META.login.coins.length;
  return { day: i + 1, coins: META.login.coins[i] };
}

export function claimLogin(save: SaveData, today: string): SaveData {
  const b = loginBonus(save, today);
  if (!b) return save;
  return { ...save, coins: save.coins + b.coins, login: { lastDate: today, day: save.login.day + 1 } };
}
