/** Tuning values for the out-of-match layer (DESIGN.md §12). */
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
  defaultSettings: { timerOn: false, throughEarly: true, cutIn: true },
} as const;
