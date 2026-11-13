import type { Rng } from '../game/types';
import { SCOUT_POOL, type Rarity } from '../game/data/roster';
import { META } from './config';
import { rolloverDaily, type SaveData } from './save';

export interface PullResult { charId: string; rarity: Rarity; isNew: boolean; refund: number }

const RARITIES: Rarity[] = [5, 4, 3];

const idsOf = (rarity: Rarity): string[] => SCOUT_POOL.filter((p) => p.rarity === rarity).map((p) => p.id);

/** Rarity weights for a slot (guaranteed slot drops rarities below the minimum). */
function slotRates(guaranteed: boolean): { rarity: Rarity; rate: number }[] {
  const rows = RARITIES.filter((r) => !guaranteed || r >= META.gacha.guaranteedMin10).map((rarity) => ({
    rarity,
    rate: META.gacha.rates[rarity],
  }));
  const total = rows.reduce((a, r) => a + r.rate, 0);
  return rows.map((r) => ({ rarity: r.rarity, rate: r.rate / total }));
}

function pullOne(rng: Rng, guaranteed: boolean): string {
  const rows = slotRates(guaranteed);
  const r = rng.next();
  let acc = 0;
  let rarity = rows[rows.length - 1].rarity;
  for (const row of rows) {
    acc += row.rate;
    if (r < acc) {
      rarity = row.rarity;
      break;
    }
  }
  const ids = idsOf(rarity);
  const i = Math.min(ids.length - 1, Math.floor(rng.next() * ids.length));
  return ids[i];
}

export function canPull(save: SaveData, count: 1 | 10): boolean {
  return save.coins >= (count === 1 ? META.gacha.cost1 : META.gacha.cost10);
}

export function rollGacha(rng: Rng, count: 1 | 10): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(pullOne(rng, count === 10 && i === 9));
  return out;
}

export function applyGacha(save: SaveData, charIds: string[], cost: number, today: string): { save: SaveData; results: PullResult[] } {
  const base = rolloverDaily(save, today);
  const owned = { ...save.owned };
  let refunds = 0;
  const results: PullResult[] = charIds.map((charId) => {
    const rarity = SCOUT_POOL.find((p) => p.id === charId)?.rarity;
    if (!rarity) throw new Error(`Not a scout character: ${charId}`);
    const isNew = (owned[charId] ?? 0) < 1;
    const refund = isNew ? 0 : META.gacha.dupRefund[rarity];
    owned[charId] = (owned[charId] ?? 0) + 1;
    refunds += refund;
    return { charId, rarity, isNew, refund };
  });
  return {
    save: {
      ...base,
      coins: base.coins - cost + refunds,
      owned,
      pulls: base.pulls + charIds.length,
      daily: { ...base.daily, pulls: base.daily.pulls + charIds.length },
    },
    results,
  };
}

export function gachaRates(): { slot: 'normal' | 'guaranteed'; rows: { rarity: Rarity; rate: number; each: number; ids: string[] }[] }[] {
  const make = (slot: 'normal' | 'guaranteed') => ({
    slot,
    rows: slotRates(slot === 'guaranteed').map(({ rarity, rate }) => {
      const ids = idsOf(rarity);
      return { rarity, rate, each: rate / ids.length, ids };
    }),
  });
  return [make('normal'), make('guaranteed')];
}
