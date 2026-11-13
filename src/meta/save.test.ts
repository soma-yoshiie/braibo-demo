import { describe, expect, it } from 'vitest';
import { rolloverDaily, canLevelUp, expNeed, levelUp, levelUpCost, summarizeMatch, teamPower, applyMatchResult, defaultSave, lineupOf, matchReward, parseSave, setFieldSlot, setKeeper, formationCounts } from './save';
import { META } from './config';
import { RIVAL_LINEUP, STARTER_LINEUP } from '../game/data/roster';
import { getCharacter } from '../game/data/characters';
import { STAGES, isUnlocked, nextStage, stageLineup } from './stages';

const T = '2026-01-01';

describe('save', () => {
  it('default save', () => {
    const s = defaultSave();
    expect(s.coins).toBe(META.startCoins);
    expect(s.v).toBe(3);
    expect(lineupOf(s)).toEqual({ field: ['st_kakeru', 'wg_sora', 'ls_taiga', 'ic_shinobu', 'df_daigo'], gk: 'gk_tsukasa' });
    for (const id of [...STARTER_LINEUP.field, STARTER_LINEUP.gk]) expect(s.owned[id]).toBe(1);
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
    expect(s.settings.trap).toBe(true); // v0.8 field missing -> true
    expect(s.record).toEqual({ played: 2, won: 0, drawn: 0, lost: 0, goals: 0 });
    expect(s.pulls).toBe(0);
  });

  it('keeps a valid v3 lineup and repairs the bad slots', () => {
    const ok = parseSave({ v: 3, coins: 42, owned: { st_ouga: 1, gk_towa: 1, df_gou: 1 }, lineup: { field: ['df_gou', 'st_ouga', 'wg_sora', 'ic_shinobu', 'df_daigo'], gk: 'gk_towa' } });
    expect(ok.coins).toBe(42);
    expect(ok.lineup).toEqual({ field: ['df_gou', 'st_ouga', 'wg_sora', 'ic_shinobu', 'df_daigo'], gk: 'gk_towa' }); // order kept
    const bad = parseSave({
      owned: { st_ouga: 1 },
      lineup: { field: ['st_raiga' /* unowned */, 'st_ouga', 'st_ouga' /* duplicate */, 'gk_tsukasa' /* a keeper */, 7], gk: 'st_ouga' },
    });
    // st_ouga kept in slot 1; the other slots get unused starters in order; a bad gk is the starter keeper
    expect(bad.lineup).toEqual({ field: ['st_kakeru', 'st_ouga', 'ls_taiga', 'ic_shinobu', 'df_daigo'], gk: 'gk_tsukasa' });
    expect(parseSave({ lineup: { field: 'x', gk: 3 } }).lineup).toEqual(defaultSave().lineup);
    expect(parseSave({ owned: { gk_towa: 1 }, lineup: { field: STARTER_LINEUP.field, gk: 'gk_mikoto' } }).lineup.gk).toBe('gk_tsukasa'); // keeper not owned
    for (const raw of [bad, ok]) expect(new Set(raw.lineup.field).size).toBe(5);
  });

  it('setFieldSlot: owned non-keepers only; a player already in another slot swaps', () => {
    const s = parseSave({ owned: { st_ouga: 1, df_gou: 1 } });
    const a = setFieldSlot(s, 0, 'st_ouga');
    expect(a.lineup.field).toEqual(['st_ouga', 'wg_sora', 'ls_taiga', 'ic_shinobu', 'df_daigo']);
    expect(setFieldSlot(s, 0, 'st_raiga')).toBe(s); // unowned
    expect(setFieldSlot(s, 0, 'ghost')).toBe(s);
    expect(setFieldSlot(s, 0, 'rv_enji')).toBe(s);
    expect(setFieldSlot(s, 0, 'gk_tsukasa')).toBe(s); // a keeper cannot play in the field
    expect(setFieldSlot(s, 0, 'st_kakeru')).toBe(s); // already there
    const swapped = setFieldSlot(s, 4, 'st_kakeru'); // st_kakeru was in slot 0
    expect(swapped.lineup.field).toEqual(['df_daigo', 'wg_sora', 'ls_taiga', 'ic_shinobu', 'st_kakeru']);
    expect(new Set(swapped.lineup.field).size).toBe(5);
  });

  it('setKeeper: owned goalkeepers only', () => {
    const s = parseSave({ owned: { gk_towa: 1, st_ouga: 1 } });
    expect(setKeeper(s, 'gk_towa').lineup.gk).toBe('gk_towa');
    expect(setKeeper(s, 'gk_mikoto')).toBe(s); // unowned
    expect(setKeeper(s, 'st_ouga')).toBe(s); // not a keeper
    expect(setKeeper(s, 'gk_tsukasa')).toBe(s); // already
  });

  it('formationCounts counts positions of the field five', () => {
    expect(formationCounts(defaultSave().lineup)).toEqual({ FW: 1, MF: 2, DF: 2 });
    expect(formationCounts({ field: ['st_kakeru', 'st_raiga', 'ls_kou', 'wg_hayate', 'df_daigo'], gk: 'gk_tsukasa' })).toEqual({ FW: 4, MF: 0, DF: 1 });
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

describe('v3', () => {
  it('migrates v1 data', () => {
    const v1 = { v: 1, coins: 777, owned: { st_ouga: 2 }, lineup: { striker: 'st_ouga' }, settings: { timerOn: true, throughEarly: false, cutIn: false },
      record: { played: 4, won: 2, drawn: 1, lost: 1 }, pulls: 12 };
    const s = parseSave(v1);
    expect(s.v).toBe(3);
    expect(s.coins).toBe(777);
    expect(s.settings).toEqual({ timerOn: true, throughEarly: false, cutIn: false, trap: true });
    // old role order: striker, wing, longShooter, interceptor, physicalDefender; the keeper is the starter keeper
    expect(s.lineup).toEqual({ field: ['st_ouga', 'wg_sora', 'ls_taiga', 'ic_shinobu', 'df_daigo'], gk: 'gk_tsukasa' });
    expect(s.owned.gk_tsukasa).toBe(1);
    expect(s.record).toEqual({ played: 4, won: 2, drawn: 1, lost: 1, goals: 0 });
    expect(s.pulls).toBe(12);
    expect(s.rank).toBe(1);
    expect(s.levels).toEqual({});
    expect(s.stages).toEqual({});
    expect(s.login).toEqual({ lastDate: '', day: 0 });
    expect(parseSave(s)).toEqual(s);
  });

  it('migrates a v2 role-keyed lineup, keeping the order and adding the keeper', () => {
    const v2 = { v: 2, coins: 5, owned: { st_ouga: 1, ls_kou: 1, df_gou: 1 }, lineup: { striker: 'st_ouga', wing: 'wg_sora', longShooter: 'ls_kou', interceptor: 'ic_shinobu', physicalDefender: 'df_gou' } };
    const s = parseSave(v2);
    expect(s.v).toBe(3);
    expect(s.lineup).toEqual({ field: ['st_ouga', 'wg_sora', 'ls_kou', 'ic_shinobu', 'df_gou'], gk: 'gk_tsukasa' });
    expect(s.owned.gk_tsukasa).toBe(1);
    expect(parseSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('repairs levels, stages, rank and exp', () => {
    const s = parseSave({ owned: { st_ouga: 1 }, levels: { st_ouga: 99, wg_hayate: 3, st_kakeru: 0, ghost: 2 }, rank: 2, exp: 9999,
      stages: { s1: { cleared: true, bestDiff: 2.9 }, s2: 'x', zz: { cleared: true, bestDiff: 1 } } });
    expect(s.levels).toEqual({ st_ouga: META.level.max });
    expect(s.exp).toBe(expNeed(2) - 1);
    expect(s.stages).toEqual({ s1: { cleared: true, bestDiff: 2 } });
  });

  it('lineupOf applies +(Lv-1), orders the field FW, MF, DF, and levels the keeper', () => {
    const s = { ...defaultSave(), levels: { st_kakeru: 3, wg_sora: 1, df_daigo: 6, gk_tsukasa: 2 } };
    expect(lineupOf(s)).toEqual({ field: ['st_kakeru+2', 'wg_sora', 'ls_taiga', 'ic_shinobu', 'df_daigo+5'], gk: 'gk_tsukasa+1' });
    const rev = { ...s, lineup: { ...s.lineup, field: [...s.lineup.field].reverse() } };
    expect(lineupOf(rev).field).toEqual(['st_kakeru+2', 'ls_taiga', 'wg_sora', 'df_daigo+5', 'ic_shinobu']); // stable inside a position
  });

  it('teamPower sums the 8 stats of the six, including +n', () => {
    const l = { field: ['technical', 'speed', 'playmaker', 'support', 'physical'], gk: 'gk_tsukasa' };
    const total = (id: string) => Object.values(getCharacter(id).stats).reduce((a, b) => a + b, 0);
    const a = teamPower(l);
    expect(a).toBe(l.field.reduce((n, id) => n + total(id), 0) + total('gk_tsukasa'));
    expect(teamPower({ ...l, gk: 'gk_tsukasa+2' })).toBe(a + 16);
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
    expect(stageLineup(STAGES[4]).field[0]).toBe('rv_enji+7');
    expect(stageLineup(STAGES[4]).gk).toBe('rv_jou+7');
    expect(getCharacter(stageLineup(STAGES[4]).field[0] as string).stats.shoot).toBe(97); // technical 85 + FW 5 + 7
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
