import { describe, expect, it } from 'vitest';
import { applyMatchResult, defaultSave, lineupIds, matchReward, parseSave, setLineup } from './save';
import { META } from './config';
import { STARTER_IDS } from '../game/data/roster';

describe('save', () => {
  it('default save', () => {
    const s = defaultSave();
    expect(s.coins).toBe(META.startCoins);
    expect(lineupIds(s)).toEqual(['st_kakeru', 'wg_sora', 'ls_taiga', 'ic_shinobu', 'df_daigo']);
    for (const id of Object.values(STARTER_IDS)) expect(s.owned[id]).toBe(1);
    expect(parseSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('repairs garbage', () => {
    for (const g of [null, undefined, 5, 'x', [], { coins: 'a' }]) expect(parseSave(g).coins).toBe(META.startCoins);
    expect(parseSave(null)).toEqual(defaultSave());
  });

  it('repairs missing / bad fields', () => {
    const s = parseSave({ coins: -5, owned: { st_ouga: 2, rv_enji: 3, ghost: 1, wg_hayate: 0 }, settings: { timerOn: 'x', cutIn: false }, record: { played: 2.7, won: NaN }, pulls: 'z' });
    expect(s.coins).toBe(META.startCoins);
    expect(s.owned.st_ouga).toBe(2);
    expect(s.owned.rv_enji).toBeUndefined();
    expect(s.owned.ghost).toBeUndefined();
    expect(s.owned.wg_hayate).toBeUndefined();
    expect(s.settings.cutIn).toBe(false);
    expect(s.settings.timerOn).toBe(defaultSave().settings.timerOn);
    expect(s.record).toEqual({ played: 2, won: 0, drawn: 0, lost: 0 });
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
    const s1 = applyMatchResult(applyMatchResult(applyMatchResult(s0, { blue: 1, red: 0 }), { blue: 0, red: 0 }), { blue: 0, red: 1 });
    expect(s1.record).toEqual({ played: 3, won: 1, drawn: 1, lost: 1 });
    expect(s1.coins).toBe(s0.coins + META.reward.win + META.reward.draw + META.reward.lose);
    expect(s0.record.played).toBe(0);
  });
});
