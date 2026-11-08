import type { Rng } from '../types';

/** Deterministic mulberry32 PRNG. Same seed => same sequence. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Rng that returns the given values in order (for tests). Repeats the last value. */
export function fixedRng(values: number[]): Rng {
  let i = 0;
  return {
    next() {
      const v = values[Math.min(i, values.length - 1)];
      i++;
      return v;
    },
  };
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
