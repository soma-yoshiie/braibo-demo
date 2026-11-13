import { describe, expect, it } from 'vitest';
import { applyGacha, canPull, gachaRates, rollGacha } from './gacha';
import { defaultSave } from './save';
import { META } from './config';
import { createRng, fixedRng } from '../game/engine/rng';
import { SCOUT_POOL } from '../game/data/roster';

const D = '2026-01-01';
const rarityOf = (id: string) => SCOUT_POOL.find((p) => p.id === id)?.rarity;

describe('rollGacha', () => {
  it('exact rarity boundaries with fixedRng', () => {
    const r5 = META.gacha.rates[5];
    const r45 = r5 + META.gacha.rates[4];
    expect(rarityOf(rollGacha(fixedRng([0, 0]), 1)[0])).toBe(5);
    expect(rarityOf(rollGacha(fixedRng([r5 - 1e-9, 0]), 1)[0])).toBe(5);
    expect(rarityOf(rollGacha(fixedRng([r5, 0]), 1)[0])).toBe(4);
    expect(rarityOf(rollGacha(fixedRng([r45 - 1e-9, 0]), 1)[0])).toBe(4);
    expect(rarityOf(rollGacha(fixedRng([r45, 0]), 1)[0])).toBe(3);
    expect(rarityOf(rollGacha(fixedRng([0.999999, 0.999999]), 1)[0])).toBe(3);
  });

  it('second draw picks uniformly within the rarity', () => {
    const ids5 = SCOUT_POOL.filter((p) => p.rarity === 5).map((p) => p.id);
    expect(rollGacha(fixedRng([0, 0]), 1)[0]).toBe(ids5[0]);
    expect(rollGacha(fixedRng([0, 0.999999]), 1)[0]).toBe(ids5[ids5.length - 1]);
  });

  it('10-pull has length 10 and a 4+ on the 10th even with the worst rolls', () => {
    const ids = rollGacha(fixedRng([0.99]), 10);
    expect(ids).toHaveLength(10);
    expect(ids.slice(0, 9).every((id) => rarityOf(id) === 3)).toBe(true);
    expect(rarityOf(ids[9])).toBe(4);
    for (let seed = 0; seed < 300; seed++) expect(rarityOf(rollGacha(createRng(seed), 10)[9])!).toBeGreaterThanOrEqual(4);
  });

  it('guaranteed slot splits 4/5 by 15/85', () => {
    const rolls = (r: number) => [...Array(18).fill(0.99), r, 0];
    expect(rarityOf(rollGacha(fixedRng(rolls(0.1499)), 10)[9])).toBe(5);
    expect(rarityOf(rollGacha(fixedRng(rolls(0.1501)), 10)[9])).toBe(4);
  });

  it('empirical rates within tolerance', () => {
    const rng = createRng(12345);
    const n = 40000;
    const c = { 3: 0, 4: 0, 5: 0 };
    for (let i = 0; i < n; i++) c[rarityOf(rollGacha(rng, 1)[0])!]++;
    expect(Math.abs(c[5] / n - 0.03)).toBeLessThan(0.006);
    expect(Math.abs(c[4] / n - 0.17)).toBeLessThan(0.01);
    expect(Math.abs(c[3] / n - 0.8)).toBeLessThan(0.012);
  });
});

describe('applyGacha', () => {
  it('deducts cost, marks new, refunds duplicates (also inside one 10-pull)', () => {
    const s = defaultSave();
    const { save, results } = applyGacha(s, ['st_ouga', 'st_ouga', 'st_ouga', 'wg_sora', 'st_raiga'], 300, D);
    expect(results.map((r) => r.isNew)).toEqual([true, false, false, false, true]);
    expect(results.map((r) => r.refund)).toEqual([0, 150, 150, 10, 0]);
    expect(save.owned.st_ouga).toBe(3);
    expect(save.owned.wg_sora).toBe(2);
    expect(save.coins).toBe(s.coins - 300 + 310);
    expect(save.pulls).toBe(5);
    expect(s.owned.st_ouga).toBeUndefined();
  });

  it('increments daily.pulls and rolls the day over', () => {
    const a = applyGacha(defaultSave(), ['st_ouga'], 100, D).save;
    expect(a.daily).toMatchObject({ date: D, pulls: 1 });
    const b = applyGacha(a, ['st_ouga', 'st_raiga'], 100, D).save;
    expect(b.daily.pulls).toBe(3);
    const c = applyGacha(b, ['st_ouga'], 100, '2026-01-02').save;
    expect(c.daily).toMatchObject({ date: '2026-01-02', pulls: 1 });
  });

  it('rejects unknown ids', () => {
    expect(() => applyGacha(defaultSave(), ['rv_enji'], 100, D)).toThrow();
  });
});

describe('canPull', () => {
  it('checks coins against cost', () => {
    const s = defaultSave();
    expect(canPull({ ...s, coins: META.gacha.cost1 }, 1)).toBe(true);
    expect(canPull({ ...s, coins: META.gacha.cost1 - 1 }, 1)).toBe(false);
    expect(canPull({ ...s, coins: META.gacha.cost10 }, 10)).toBe(true);
    expect(canPull({ ...s, coins: META.gacha.cost10 - 1 }, 10)).toBe(false);
  });
});

describe('gachaRates', () => {
  it('rows sum to 1 per slot and cover the pool', () => {
    const tables = gachaRates();
    expect(tables.map((t) => t.slot)).toEqual(['normal', 'guaranteed']);
    for (const t of tables) {
      expect(t.rows.reduce((a, r) => a + r.rate, 0)).toBeCloseTo(1, 10);
      for (const r of t.rows) expect(r.each * r.ids.length).toBeCloseTo(r.rate, 10);
    }
    expect(tables[0].rows.map((r) => r.ids.length)).toEqual([6, 6, 6]);
    expect(tables[1].rows.map((r) => [r.rarity, r.rate])).toEqual([[5, expect.closeTo(0.15, 10)], [4, expect.closeTo(0.85, 10)]]);
  });
});
