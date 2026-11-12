import { describe, expect, it } from 'vitest';
import { CHARACTERS, ROLE_LABEL, getCharacter } from './characters';
import { ROLE_ORDER, RIVAL_LINEUP, ROSTER, SCOUT_POOL, STARTER_IDS, getProfile } from './roster';
import { DEFAULT_FORMATION } from './formations';
import { createMatch } from '../engine/match';
import type { Stats } from '../types';

describe('roster', () => {
  it('has 20 profiles with unique ids and short original quotes', () => {
    expect(ROSTER).toHaveLength(20);
    expect(new Set(ROSTER.map((p) => p.id)).size).toBe(20);
    for (const p of ROSTER) {
      for (const q of Object.values(p.quotes)) {
        expect(q.length).toBeGreaterThan(0);
        expect(q.length).toBeLessThanOrEqual(20);
      }
      expect(p.look.hairHi).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('every roster id resolves through getCharacter with its name and role', () => {
    for (const p of ROSTER) {
      const c = getCharacter(p.id);
      expect(c.id).toBe(p.id);
      expect(c.name).toBe(p.name);
      expect(c.role).toBe(p.role);
      expect(c.moves).toEqual(getCharacter(p.role).moves);
    }
  });

  it('starters and rivals have exactly the archetype stats', () => {
    for (const id of [...Object.values(STARTER_IDS), ...RIVAL_LINEUP]) {
      const c = getCharacter(id);
      expect(c.stats).toEqual(getCharacter(c.role).stats);
    }
  });

  it('applies bonuses and clamps to 1..99', () => {
    const ouga = getCharacter('st_ouga');
    const base = getCharacter('striker').stats;
    expect(ouga.stats.shoot).toBe(94);
    expect(ouga.stats.aerial).toBe(base.aerial + 9);
    expect(ouga.stats.pass).toBe(base.pass);
    for (const p of ROSTER) for (const v of Object.values(getCharacter(p.id).stats)) expect(v).toBeGreaterThanOrEqual(1);
    for (const p of ROSTER) for (const k of Object.keys(getCharacter(p.id).stats) as (keyof Stats)[]) expect(getCharacter(p.id).stats[k]).toBeLessThanOrEqual(99);
    const genbu = getCharacter('df_genbu');
    expect(genbu.stats.block).toBe(94);
  });

  it('keeps archetypes unchanged', () => {
    expect(CHARACTERS).toHaveLength(5);
    expect(getCharacter('striker').stats.shoot).toBe(85);
    expect(Object.keys(ROLE_LABEL)).toHaveLength(5);
  });

  it('pool: 15 scout, 5 rival, 3 per role with one of each rarity', () => {
    expect(SCOUT_POOL).toHaveLength(15);
    expect(ROSTER.filter((p) => p.group === 'rival')).toHaveLength(5);
    for (const role of ROLE_ORDER) {
      const ps = SCOUT_POOL.filter((p) => p.role === role);
      expect(ps.map((p) => p.rarity).sort()).toEqual([3, 4, 5]);
    }
  });

  it('starter and rival lineups follow the formation role order', () => {
    expect(ROLE_ORDER.map((r) => getProfile(STARTER_IDS[r]).role)).toEqual(ROLE_ORDER);
    expect(RIVAL_LINEUP.map((id) => getProfile(id).role)).toEqual(DEFAULT_FORMATION.map((s) => getCharacter(s.charId).role));
    for (const r of ROLE_ORDER) expect(getProfile(STARTER_IDS[r]).rarity).toBe(3);
  });

  it('getProfile of an archetype borrows the starter look', () => {
    const p = getProfile('wing');
    expect(p.name).toBe(getCharacter('wing').name);
    expect(p.look).toEqual(getProfile(STARTER_IDS.wing).look);
    expect(() => getProfile('nobody')).toThrow();
    expect(() => getCharacter('nobody')).toThrow();
  });
});

describe('createMatch lineups', () => {
  it('assigns charIds per slot and keeps positions', () => {
    const base = createMatch();
    const m = createMatch({ lineups: { blue: ['st_ouga', 'wg_sora', 'ls_kou', 'ic_rei', 'df_genbu'], red: RIVAL_LINEUP } });
    expect(m.players.filter((p) => p.team === 'blue').map((p) => p.charId)).toEqual(['st_ouga', 'wg_sora', 'ls_kou', 'ic_rei', 'df_genbu']);
    expect(m.players.filter((p) => p.team === 'red').map((p) => p.charId)).toEqual(RIVAL_LINEUP);
    expect(m.players.map((p) => p.pos)).toEqual(base.players.map((p) => p.pos));
  });

  it('partial lineups fall back to the formation and no lineups is unchanged', () => {
    const m = createMatch({ lineups: { red: RIVAL_LINEUP } });
    expect(m.players.filter((p) => p.team === 'blue').map((p) => p.charId)).toEqual(DEFAULT_FORMATION.map((s) => s.charId));
    expect(createMatch()).toEqual(createMatch({}));
    expect(createMatch().players[0].charId).toBe('striker');
  });
});
