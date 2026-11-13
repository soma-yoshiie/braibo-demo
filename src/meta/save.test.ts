import { describe, expect, it } from 'vitest';
import { rolloverDaily, canLevelUp, expNeed, levelUp, levelUpCost, summarizeMatch, teamPower, applyMatchResult, defaultSave, lineupIds, matchReward, parseSave, setLineup } from './save';
import { META } from './config';
import { RIVAL_LINEUP, STARTER_IDS } from '../game/data/roster';
import { getCharacter } from '../game/data/characters';
import { STAGES, isUnlocked, nextStage, stageLineup } from './stages';

const T = '2026-01-01';

describe('save', () => {
  it('default save', () => {
    const s = defaultSave();
    expect(s.coins).toBe(META.startCoins);
    expect(lineupIds(s)).toEqual(['st_kakeru', 'wg_sora', 'ls_taiga', 'ic_shinobu', 'df_daigo']);
    for (const id of Object.values(STARTER_IDS)) expect(s.owned[id]).toBe(1);
    expect(parseSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('repairs garbage', () => {
    for (const g of [null, undefined, 5, 'x', []]) expect(parseSave(g).coins).toBe(META.startCoins);
    for (const c of ['a', -5, NaN, null]) expect(parseSave({ coins: c }).coins).toBe(0);
    expect(parseSave({}).coins).toBe(0);
    expect(parseSave(null)).toEqual(defaultSave());
  });

  it('repairs missing / bad fields', () => {
    const s = parseSave({ coins: -5, owned: { st_ouga: 2, rv_enji: 3, ghost: 1, wg_hayate: 0 }, settings: { timerOn: 'x', cutIn: false }, record: { played: 2.7, won: NaN }, pulls: 'z' });
    expect(s.coins).toBe(0);
    expect(s.owned.st_ouga).toBe(2);
    expect(s.owned.rv_enji).toBeUndefined();
    expect(s.owned.ghost).toBeUndefined();
    expect(s.owned.wg_hayate).toBeUndefined();
    expect(s.settings.cutIn).toBe(false);
    expect(s.settings.timerOn).toBe(defaultSave().settings.timerOn);
    expect(s.record).toEqual({ played: 2, won: 0, drawn: 0, lost: 0, goals: 0 });
    expect(s.pulls).toBe(0);
  });

  it('keeps valid coins and lineup, resets unowned or wrong-role lineup', () => {
    const ok = parseSave({ coins: 42, owned: { st_ouga: 1 }, lineup: { striker: 'st_ouga' } });
    expect(ok.coins).toBe(42);
    expect(ok.lineup.striker).toBe('st_ouga');
    const bad = parseSave({
      owned: { st_ouga: 1 },
      lineup: { striker: 'st_raiga', wing: 'st_ouga', longShooter: 'rv_kagari', interceptor: 7, physicalDefender: 'nope' },
    });
    expect(bad.lineup).toEqual(defaultSave().lineup);
  });

  it('setLineup accepts owned same-role and rejects the rest', () => {
    const s = parseSave({ owned: { st_ouga: 1 } });
    expect(setLineup(s, 'striker', 'st_ouga').lineup.striker).toBe('st_ouga');
    expect(setLineup(s, 'striker', 'st_raiga')).toBe(s); // unowned
    expect(setLineup(s, 'wing', 'st_ouga')).toBe(s); // wrong role
    expect(setLineup(s, 'striker', 'ghost')).toBe(s);
    expect(setLineup(s, 'striker', 'rv_enji')).toBe(s);
  });

  it('matchReward and applyMatchResult', () => {
    expect(matchReward({ blue: 2, red: 1 })).toEqual({ result: 'win', coins: META.reward.win });
    expect(matchReward({ blue: 1, red: 1 })).toEqual({ result: 'draw', coins: META.reward.draw });
    expect(matchReward({ blue: 0, red: 3 })).toEqual({ result: 'lose', coins: META.reward.lose });
    const s0 = defaultSave();
    const s1 = applyMatchResult(applyMatchResult(applyMatchResult(s0, 'none', { blue: 1, red: 0 }, T), 'none', { blue: 0, red: 0 }, T), 'none', { blue: 0, red: 1 }, T);
    expect(s1.record).toEqual({ played: 3, won: 1, drawn: 1, lost: 1, goals: 1 });
    // exp 110 + 60 + 40 = 210 -> rank 2 (need 100), rank 3 (need 150) not reached: 210-100 = 110
    expect(s1.rank).toBe(2);
    expect(s1.coins).toBe(s0.coins + META.reward.win + META.reward.draw + META.reward.lose + META.rank.bonusCoins);
    expect(s0.record.played).toBe(0);
  });
});

describe('v2', () => {
  it('migrates v1 data', () => {
    const v1 = { v: 1, coins: 777, owned: { st_ouga: 2 }, lineup: { striker: 'st_ouga' }, settings: { timerOn: true, throughEarly: false, cutIn: false },
      record: { played: 4, won: 2, drawn: 1, lost: 1 }, pulls: 12 };
    const s = parseSave(v1);
    expect(s.v).toBe(2);
    expect(s.coins).toBe(777);
    expect(s.lineup.striker).toBe('st_ouga');
    expect(s.record).toEqual({ played: 4, won: 2, drawn: 1, lost: 1, goals: 0 });
    expect(s.pulls).toBe(12);
    expect(s.rank).toBe(1);
    expect(s.levels).toEqual({});
    expect(s.stages).toEqual({});
    expect(s.login).toEqual({ lastDate: '', day: 0 });
    expect(parseSave(s)).toEqual(s);
  });

  it('repairs levels, stages, rank and exp', () => {
    const s = parseSave({ owned: { st_ouga: 1 }, levels: { st_ouga: 99, wg_hayate: 3, st_kakeru: 0, ghost: 2 }, rank: 2, exp: 9999,
      stages: { s1: { cleared: true, bestDiff: 2.9 }, s2: 'x', zz: { cleared: true, bestDiff: 1 } } });
    expect(s.levels).toEqual({ st_ouga: META.level.max });
    expect(s.exp).toBe(expNeed(2) - 1);
    expect(s.stages).toEqual({ s1: { cleared: true, bestDiff: 2 } });
  });

  it('lineupIds applies +(Lv-1)', () => {
    const s = { ...defaultSave(), levels: { st_kakeru: 3, wg_sora: 1, df_daigo: 6 } };
    expect(lineupIds(s)).toEqual(['st_kakeru+2', 'wg_sora', 'ls_taiga', 'ic_shinobu', 'df_daigo+5']);
  });

  it('teamPower sums the 8 stats, including +n', () => {
    const a = teamPower(['striker']);
    expect(a).toBe(55 + 60 + 85 + 45 + 55 + 40 + 35 + 30);
    expect(teamPower(['striker+2'])).toBe(a + 16);
  });

  it('level up: cost, max, insufficient coins, unowned', () => {
    const s0 = defaultSave();
    expect(levelUpCost(s0, 'st_kakeru')).toBe(META.level.costs[0]);
    const s1 = levelUp(s0, 'st_kakeru');
    expect(s1.levels.st_kakeru).toBe(2);
    expect(s1.coins).toBe(s0.coins - META.level.costs[0]);
    expect(s1.levelUps).toBe(1);
    expect(levelUp(s0, 'st_ouga')).toBe(s0);
    const poor = { ...s0, coins: 199 };
    expect(canLevelUp(poor, 'st_kakeru')).toBe(false);
    expect(levelUp(poor, 'st_kakeru')).toBe(poor);
    let s = { ...s0, coins: 100000 };
    for (let i = 0; i < 10; i++) s = levelUp(s, 'st_kakeru');
    expect(s.levels.st_kakeru).toBe(META.level.max);
    expect(s.levelUps).toBe(META.level.max - 1);
    expect(s.coins).toBe(100000 - META.level.costs.reduce((a, b) => a + b, 0));
    expect(canLevelUp(s, 'st_kakeru')).toBe(false);
  });

  it('exp carries over across multiple rank-ups', () => {
    const s0 = { ...defaultSave(), exp: 90 };
    // 90 + 100 + 10*20 = 390 -> -100 (r1) = 290 -> -150 (r2) = 140 -> r3 need 200, stays
    const sum = summarizeMatch(s0, 'none', { blue: 20, red: 0 });
    expect(sum.expGain).toBe(300);
    expect([sum.rankAfter, sum.expAfter, sum.expNeedAfter]).toEqual([3, 140, 200]);
    expect(sum.rankUpCoins).toBe(2 * META.rank.bonusCoins);
  });

  it('stages: unlock chain, first clear once, draw does not clear, bestDiff', () => {
    const s0 = defaultSave();
    expect(isUnlocked(s0, 's1')).toBe(true);
    expect(isUnlocked(s0, 's2')).toBe(false);
    expect(nextStage(s0).id).toBe('s1');
    const d = applyMatchResult(s0, 's1', { blue: 1, red: 1 }, T);
    expect(d.stages.s1).toEqual({ cleared: false, bestDiff: 0 });
    expect(isUnlocked(d, 's2')).toBe(false);
    const w = applyMatchResult(d, 's1', { blue: 3, red: 1 }, T);
    expect(w.stages.s1).toEqual({ cleared: true, bestDiff: 2 });
    expect(isUnlocked(w, 's2')).toBe(true);
    expect(nextStage(w).id).toBe('s2');
    expect(summarizeMatch(w, 's1', { blue: 1, red: 0 }).firstClear).toBe(0);
    const w2 = applyMatchResult(w, 's1', { blue: 1, red: 0 }, T);
    expect(w2.stages.s1).toEqual({ cleared: true, bestDiff: 2 });
    const l = applyMatchResult(w2, 's1', { blue: 0, red: 4 }, T);
    expect(l.stages.s1).toEqual({ cleared: true, bestDiff: 2 });
    expect(summarizeMatch(s0, 's1', { blue: 1, red: 0 }).firstClear).toBe(300);
    expect(nextStage({ ...s0, stages: Object.fromEntries(STAGES.map((s) => [s.id, { cleared: true, bestDiff: 1 }])) }).id).toBe('s5');
  });

  it('stageLineup applies plus to the rival lineup', () => {
    expect(stageLineup(STAGES[0])).toEqual(RIVAL_LINEUP);
    expect(stageLineup(STAGES[4])[0]).toBe('rv_enji+7');
    expect(getCharacter(stageLineup(STAGES[4])[0]).stats.shoot).toBe(92);
  });

  it('summarizeMatch equals the delta applied by applyMatchResult', () => {
    const cases: [string, { blue: number; red: number }, number][] = [
      ['s1', { blue: 2, red: 0 }, 0], ['s1', { blue: 1, red: 1 }, 0], ['s2', { blue: 0, red: 2 }, 0],
      ['s1', { blue: 5, red: 0 }, 95], ['none', { blue: 1, red: 0 }, 0], ['s1', { blue: 9, red: 2 }, 999],
    ];
    for (const [stage, score, exp] of cases) {
      const s0 = { ...defaultSave(), exp: Math.min(exp, 99) };
      const sum = summarizeMatch(s0, stage, score);
      const s1 = applyMatchResult(s0, stage, score, T);
      expect(s1.coins - s0.coins).toBe(sum.totalCoins);
      expect(s1.rank).toBe(sum.rankAfter);
      expect(s1.exp).toBe(sum.expAfter);
      expect(sum.rankBefore).toBe(s0.rank);
      expect(sum.expBefore).toBe(s0.exp);
      expect(sum.totalCoins).toBe(sum.coins + sum.firstClear + sum.rankUpCoins);
      expect(s1.record.goals).toBe(score.blue);
      expect(s1.daily).toMatchObject({ played: 1, won: score.blue > score.red ? 1 : 0 });
    }
    // first clear + rank up
    const s0 = { ...defaultSave(), exp: 99 };
    const sum = summarizeMatch(s0, 's1', { blue: 1, red: 0 });
    expect(sum.firstClear).toBe(300);
    expect(sum.rankUpCoins).toBe(200);
    // unknown stage: rewards and exp apply, no stage record
    const u = applyMatchResult(defaultSave(), 'zzz', { blue: 1, red: 0 }, T);
    expect(u.stages).toEqual({});
    expect(u.coins).toBe(META.startCoins + META.reward.win + META.rank.bonusCoins); // 110 exp ranks up once
  });

  it('stage rewardMul multiplies match coins (rounded), not exp; summary equals applied delta', () => {
    expect(STAGES.map((x) => x.plus)).toEqual([0, 1, 3, 5, 7]);
    expect(STAGES.map((x) => x.rewardMul)).toEqual([1, 1.2, 1.4, 1.7, 2]);
    const s0 = defaultSave();
    const cases: [string, { blue: number; red: number }][] = [['s2', { blue: 1, red: 0 }], ['s3', { blue: 0, red: 0 }], ['s4', { blue: 0, red: 1 }], ['s5', { blue: 2, red: 1 }], ['zzz', { blue: 0, red: 1 }]];
    for (const [id, score] of cases) {
      const sum = summarizeMatch(s0, id, score);
      const mul = STAGES.find((x) => x.id === id)?.rewardMul ?? 1;
      expect(sum.coins).toBe(Math.round(matchReward(score).coins * mul));
      expect(sum.expGain).toBe(META.exp[sum.result] + META.exp.perGoal * score.blue);
      expect(applyMatchResult(s0, id, score, T).coins - s0.coins).toBe(sum.totalCoins);
    }
    expect(summarizeMatch(s0, 's4', { blue: 0, red: 1 }).coins).toBe(170);
    expect(summarizeMatch(s0, 's3', { blue: 0, red: 0 }).coins).toBe(210);
  });

  it('daily rollover only moves forward', () => {
    let s = applyMatchResult(defaultSave(), 's1', { blue: 1, red: 0 }, '2026-05-10');
    s = applyMatchResult(s, 's1', { blue: 1, red: 0 }, '2026-05-09'); // clock went back
    expect(s.daily).toMatchObject({ date: '2026-05-10', played: 2, won: 2 });
    expect(rolloverDaily(s, '2026-05-09')).toBe(s);
    expect(rolloverDaily(s, '2026-05-11').daily.played).toBe(0);
  });
});
