import { describe, expect, it } from 'vitest';
import { claimAllMissions, claimLogin, claimMission, claimableCount, loginBonus, missionStates, MISSIONS, rolloverDaily } from './missions';
import { applyMatchResult, defaultSave, levelUp, type SaveData } from './save';
import { applyGacha } from './gacha';
import { META } from './config';

const D1 = '2026-03-01';
const D2 = '2026-03-02';
const st = (s: SaveData, id: string, d = D1) => missionStates(s, d).find((m) => m.def.id === id)!;

describe('daily rollover', () => {
  it('resets daily counters and claims only when the date changes', () => {
    let s = applyMatchResult(defaultSave(), 's1', { blue: 1, red: 0 }, D1);
    expect(s.daily).toMatchObject({ date: D1, played: 1, won: 1 });
    expect(rolloverDaily(s, D1)).toBe(s);
    s = claimMission(s, 'd_play', D1);
    expect(s.daily.claimed).toEqual(['d_play']);
    const n = rolloverDaily(s, D2);
    expect(n.daily).toEqual({ date: D2, played: 0, won: 0, pulls: 0, claimed: [] });
    expect(n.record.won).toBe(1);
    expect(st(s, 'd_play', D2)).toMatchObject({ progress: 0, done: false, claimed: false });
  });
});

describe('missions', () => {
  it('progress sources', () => {
    let s = defaultSave();
    s = applyMatchResult(s, 's1', { blue: 3, red: 0 }, D1);
    expect(st(s, 'd_play').done).toBe(true);
    expect(st(s, 'd_win').done).toBe(true);
    expect(st(s, 'n_win1').done).toBe(true);
    expect(st(s, 'n_win5')).toMatchObject({ progress: 1, done: false });
    expect(st(s, 'n_goal10').progress).toBe(3);
    expect(st(s, 'n_own10').progress).toBe(6); // five starters + the starter keeper
    expect(st(s, 'd_scout').done).toBe(false);
    s = applyGacha(s, ['st_ouga'], 100, D1).save;
    expect(st(s, 'd_scout').done).toBe(true);
    expect(st(s, 'n_own10').progress).toBe(7);
    expect(st(s, 'n_lv').done).toBe(false);
    s = levelUp(s, 'st_kakeru');
    expect(st(s, 'n_lv').done).toBe(true);
    expect(st(s, 'n_s3').done).toBe(false);
    s = { ...s, stages: { ...s.stages, s3: { cleared: true, bestDiff: 1 }, s5: { cleared: true, bestDiff: 1 } } };
    expect(st(s, 'n_s3').done).toBe(true);
    expect(st(s, 'n_s5').done).toBe(true);
  });

  it('claim once, only when done', () => {
    let s = defaultSave();
    expect(claimMission(s, 'd_play', D1).coins).toBe(s.coins);
    s = applyMatchResult(s, 's1', { blue: 1, red: 0 }, D1);
    const before = s.coins;
    const c = claimMission(s, 'd_play', D1);
    expect(c.coins).toBe(before + 100);
    expect(claimMission(c, 'd_play', D1).coins).toBe(c.coins);
    const n = claimMission(c, 'n_win1', D1);
    expect(n.claimed).toEqual(['n_win1']);
    expect(claimMission(n, 'n_win1', D1).coins).toBe(n.coins);
    expect(claimMission(n, 'unknown', D1)).toBe(n);
  });

  it('claimAll sums rewards and claimableCount tracks', () => {
    const s = applyMatchResult(defaultSave(), 's1', { blue: 1, red: 0 }, D1);
    expect(claimableCount(s, D1)).toBe(3); // d_play, d_win, n_win1
    const { save, coins } = claimAllMissions(s, D1);
    expect(coins).toBe(100 + 150 + 300);
    expect(save.coins).toBe(s.coins + coins);
    expect(claimableCount(save, D1)).toBe(0);
    expect(claimAllMissions(save, D1).coins).toBe(0);
    expect(MISSIONS).toHaveLength(10);
  });
});

describe('login bonus', () => {
  it('cycles over 7 days and only once a day', () => {
    let s = defaultSave();
    expect(loginBonus(s, D1)).toEqual({ day: 1, coins: META.login.coins[0] });
    s = claimLogin(s, D1);
    expect(s.coins).toBe(META.startCoins + META.login.coins[0]);
    expect(loginBonus(s, D1)).toBeNull();
    expect(claimLogin(s, D1)).toBe(s);
    for (let i = 1; i < 7; i++) s = claimLogin(s, `2026-04-0${i}`);
    expect(s.login.day).toBe(7);
    expect(s.coins).toBe(META.startCoins + META.login.coins.reduce((a, b) => a + b, 0));
    expect(loginBonus(s, '2026-05-01')).toEqual({ day: 1, coins: META.login.coins[0] });
  });

  it('never grants when the date goes backwards', () => {
    let s = claimLogin(defaultSave(), '2026-06-10');
    expect(loginBonus(s, '2026-06-09')).toBeNull();
    expect(claimLogin(s, '2026-06-09')).toBe(s);
    expect(loginBonus(s, '2026-06-11')).not.toBeNull();
    s = claimLogin(s, '2026-06-11');
    expect(claimLogin(s, '2026-06-10')).toBe(s);
    expect(s.login.day).toBe(2);
  });
});
