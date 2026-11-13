/** Tuning values for the out-of-match layer (DESIGN.md §12, §13). */
export const META = {
  startCoins: 3000,
  gacha: {
    cost1: 100,
    cost10: 1000,
    rates: { 5: 0.03, 4: 0.17, 3: 0.8 } as Record<3 | 4 | 5, number>,
    /** The 10th pull of a 10-pull is at least this rarity. */
    guaranteedMin10: 4 as 3 | 4 | 5,
    dupRefund: { 3: 10, 4: 40, 5: 150 } as Record<3 | 4 | 5, number>,
  },
  reward: { win: 300, draw: 150, lose: 100 },
  defaultSettings: { timerOn: false, throughEarly: true, cutIn: true, trap: true },
  /** Experience per match (perGoal counts the player's own goals). */
  exp: { win: 100, draw: 60, lose: 40, perGoal: 10 },
  /** Exp needed to leave rank r = base + step * (r - 1). */
  rank: { base: 100, step: 50, bonusCoins: 200 },
  /** costs[Lv - 1] = coins to go from Lv to Lv + 1. Each level adds +1 to every stat. */
  level: { max: 6, costs: [200, 400, 600, 800, 1000] as readonly number[] },
  /** Daily login coins, cycling every 7 claimed days. */
  login: { coins: [100, 100, 150, 150, 200, 200, 500] as readonly number[] },
} as const;
