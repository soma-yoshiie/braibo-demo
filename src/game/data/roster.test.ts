import { describe, expect, it } from 'vitest';
import { CHARACTERS, getCharacter } from './characters';
import { splitCharId, withPlus, RIVAL_LINEUP, ROSTER, SCOUT_POOL, STARTER_LINEUP, getProfile } from './roster';
import { DEFAULT_POSITION, GK_BASE, GK_TYPE_MOD, POSITION_MOD, POSITION_ORDER, TYPE_LABEL, TYPE_ORDER } from './positions';
import { DEFAULT_FORMATION } from './formations';
import { createMatch, getPlayer } from '../engine/match';
import type { Stats } from '../types';

describe('roster', () => {
  it('has 24 profiles with unique ids and short original quotes', () => {
    expect(ROSTER).toHaveLength(24);
    expect(new Set(ROSTER.map((p) => p.id)).size).toBe(24);
    for (const p of ROSTER) {
      for (const q of Object.values(p.quotes)) {
        expect(q.length).toBeGreaterThan(0);
        expect(q.length).toBeLessThanOrEqual(20);
      }
      expect(p.look.hairHi).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('every roster id resolves through getCharacter with its name, type, position and movement', () => {
    for (const p of ROSTER) {
      const c = getCharacter(p.id);
      expect(c.id).toBe(p.id);
      expect(c.name).toBe(p.name);
      expect(c.type).toBe(p.type);
      expect(c.position).toBe(p.position);
      expect(c.abbr).toBe(p.position);
      expect(c.moves).toEqual(getCharacter(p.type).moves);
    }
  });

  it('keeps the existing 20 ids and adds the four keepers', () => {
    const ids = ROSTER.map((p) => p.id);
    for (const id of ['st_kakeru', 'st_raiga', 'st_ouga', 'wg_sora', 'wg_tsubame', 'wg_hayate', 'ls_taiga', 'ls_iori', 'ls_kou', 'ic_shinobu', 'ic_jin', 'ic_rei', 'df_daigo', 'df_gou', 'df_genbu', 'rv_enji', 'rv_homura', 'rv_kagari', 'rv_ren', 'rv_gantetsu']) expect(ids).toContain(id);
    expect(ROSTER.filter((p) => p.position === 'GK').map((p) => p.id).sort()).toEqual(['gk_mikoto', 'gk_towa', 'gk_tsukasa', 'rv_jou']);
  });

  it('field players: type base + position correction (+ bonus); starters have no bonus', () => {
    // st_kakeru = technical FW: shoot 85 + 5, block 30 - 5
    const k = getCharacter('st_kakeru').stats;
    const t = getCharacter('technical').stats;
    expect(k.shoot).toBe(t.shoot + 5);
    expect(k.longShot).toBe(t.longShot + 3);
    expect(k.aerial).toBe(t.aerial + 2);
    expect(k.block).toBe(t.block - 5);
    expect(k.intercept).toBe(t.intercept - 5);
    expect(k.pass).toBe(t.pass);
    // wg_sora = speed MF
    const s = getCharacter('wg_sora').stats;
    const sp = getCharacter('speed').stats;
    expect(s.pass).toBe(sp.pass + 5);
    expect(s.cross).toBe(sp.cross + 3);
    expect(s.intercept).toBe(sp.intercept + 2);
    expect(s.physical).toBe(sp.physical - 5);
    expect(s.aerial).toBe(sp.aerial - 5);
    // df_daigo = physical DF
    const d = getCharacter('df_daigo').stats;
    const ph = getCharacter('physical').stats;
    expect(d.block).toBe(ph.block + 5);
    expect(d.intercept).toBe(ph.intercept + 3);
    expect(d.physical).toBe(ph.physical + 2);
    expect(d.shoot).toBe(ph.shoot - 5);
    expect(d.longShot).toBe(ph.longShot - 5);
  });

  it('a position correction sums to zero, and a bare type id has none', () => {
    for (const pos of ['FW', 'MF', 'DF'] as const) expect(Object.values(POSITION_MOD[pos]).reduce((a, b) => a + (b ?? 0), 0)).toBe(0);
    for (const t of TYPE_ORDER) {
      const c = getCharacter(t);
      expect(c.stats).toEqual(CHARACTERS.find((x) => x.id === t)?.stats);
      expect(c.position).toBe(DEFAULT_POSITION[t]);
    }
  });

  it('keepers: GK_BASE + type slope + bonus, clamped; skills none', () => {
    const sum = (o: Partial<Stats>) => Object.values(o).reduce((a, b) => a + (b ?? 0), 0);
    expect(GK_BASE).toEqual({ physical: 60, aerial: 60, shoot: 30, longShot: 30, pass: 60, cross: 40, intercept: 50, block: 60 });
    const tsukasa = getCharacter('gk_tsukasa');
    expect(tsukasa.stats).toEqual({ ...GK_BASE, aerial: 68 });
    expect(tsukasa.position).toBe('GK');
    expect(getCharacter('gk_towa').stats.block).toBe(60 + 6 + 5);
    expect(getCharacter('gk_towa').stats.aerial).toBe(60 + 3);
    expect(getCharacter('gk_mikoto').stats.block).toBe(60 + 3 + 9);
    expect(getCharacter('gk_mikoto').stats.aerial).toBe(60 + 3 + 8);
    expect(getCharacter('rv_jou').stats).toEqual(tsukasa.stats);
    expect(getCharacter('gk_tsukasa').skills).toEqual([]);
    for (const t of TYPE_ORDER) expect(sum(GK_TYPE_MOD[t])).toBeGreaterThan(0);
    expect(getCharacter('gk_mikoto+20').stats.block).toBe(92);
  });

  it('type changes of v0.9: speed lost passMaster, playmaker gained it; totals unchanged', () => {
    const sp = getCharacter('speed');
    const pm = getCharacter('playmaker');
    expect(sp.skills).toEqual([]);
    expect(pm.skills).toEqual(['passMaster']);
    expect([sp.stats.pass, sp.stats.shoot]).toEqual([70, 60]);
    expect([pm.stats.pass, pm.stats.longShot, pm.stats.shoot]).toEqual([80, 80, 55]);
    const tot = (c: ReturnType<typeof getCharacter>) => Object.values(c.stats).reduce((a, b) => a + b, 0);
    expect(tot(sp)).toBe(40 + 40 + 55 + 45 + 75 + 85 + 45 + 30);
    expect(tot(pm)).toBe(45 + 45 + 60 + 90 + 65 + 50 + 40 + 35);
  });

  it('applies bonuses and clamps to 1..99', () => {
    const ouga = getCharacter('st_ouga');
    const base = getCharacter('technical').stats;
    expect(ouga.stats.shoot).toBe(base.shoot + 5 + 9);
    expect(ouga.stats.aerial).toBe(base.aerial + 2 + 9);
    expect(ouga.stats.pass).toBe(base.pass);
    for (const p of ROSTER) for (const v of Object.values(getCharacter(p.id).stats)) expect(v).toBeGreaterThanOrEqual(1);
    for (const p of ROSTER) for (const k of Object.keys(getCharacter(p.id).stats) as (keyof Stats)[]) expect(getCharacter(p.id).stats[k]).toBeLessThanOrEqual(99);
    expect(getCharacter('df_genbu').stats.block).toBe(85 + 5 + 9);
  });

  it('keeps the five types', () => {
    expect(CHARACTERS).toHaveLength(5);
    expect(CHARACTERS.map((c) => c.id)).toEqual(TYPE_ORDER);
    expect(getCharacter('technical').stats.shoot).toBe(85);
    expect(Object.keys(TYPE_LABEL)).toHaveLength(5);
    expect(POSITION_ORDER).toEqual(['GK', 'DF', 'MF', 'FW']);
    expect(() => getCharacter('striker')).toThrow(); // the old role ids are gone
  });

  it('pool: 18 scout (6 five-star), 6 rival-side ids, lineups are valid', () => {
    expect(SCOUT_POOL).toHaveLength(18);
    expect(SCOUT_POOL.filter((p) => p.rarity === 5)).toHaveLength(6);
    expect(ROSTER.filter((p) => p.group === 'rival')).toHaveLength(6);
    for (const t of TYPE_ORDER) expect(SCOUT_POOL.filter((p) => p.type === t).length).toBeGreaterThan(0);
    expect(STARTER_LINEUP.field).toEqual(['st_kakeru', 'wg_sora', 'ls_taiga', 'ic_shinobu', 'df_daigo']);
    expect(STARTER_LINEUP.gk).toBe('gk_tsukasa');
    for (const l of [STARTER_LINEUP, RIVAL_LINEUP]) {
      expect(l.field).toHaveLength(5);
      expect(new Set(l.field).size).toBe(5);
      for (const id of l.field) expect(getProfile(id).position).not.toBe('GK');
      expect(getProfile(l.gk).position).toBe('GK');
      expect(getProfile(l.gk).rarity).toBe(3);
    }
    expect(RIVAL_LINEUP.gk).toBe('rv_jou');
  });

  it('getProfile of a type id borrows the starter look', () => {
    const p = getProfile('speed');
    expect(p.name).toBe(getCharacter('speed').name);
    expect(p.look).toEqual(getProfile('wg_sora').look);
    expect(() => getProfile('nobody')).toThrow();
    expect(() => getCharacter('nobody')).toThrow();
  });
});

describe('createMatch lineups', () => {
  it('places each team from its positions, with homes and a keeper (blue-first kickoff)', () => {
    const m = createMatch({ lineups: { blue: STARTER_LINEUP, red: RIVAL_LINEUP } });
    expect(m.players).toHaveLength(10);
    expect(m.players.filter((p) => p.team === 'blue').map((p) => p.charId)).toEqual(['st_kakeru', 'wg_sora', 'ls_taiga', 'ic_shinobu', 'df_daigo']);
    expect(m.keepers).toEqual({ blue: 'gk_tsukasa', red: 'rv_jou' });
    expect(m.homes?.['blue-1']).toEqual({ x: 1, y: 7 }); // the non-kicking layout
    expect(getPlayer(m, 'blue-0').pos).toEqual({ x: 3, y: 5 }); // the kicker is on the spot
    expect(getPlayer(m, 'red-0').pos).toEqual({ x: 3, y: 3 }); // FW row 6 mirrored
  });

  it('slots follow FW, MF, DF whatever order the lineup gives', () => {
    const m = createMatch({ lineups: { blue: { field: ['df_daigo', 'ls_taiga', 'st_kakeru', 'ic_shinobu', 'wg_sora'], gk: 'gk_tsukasa' } } });
    expect(m.players.filter((p) => p.team === 'blue').map((p) => p.charId)).toEqual(['st_kakeru', 'ls_taiga', 'wg_sora', 'df_daigo', 'ic_shinobu']);
  });

  it('a team without a lineup keeps the legacy formation and has no keeper; no lineups is unchanged', () => {
    const m = createMatch({ lineups: { red: RIVAL_LINEUP } });
    expect(m.players.filter((p) => p.team === 'blue').map((p) => p.charId)).toEqual(DEFAULT_FORMATION.map((s) => s.charId));
    expect(m.keepers).toEqual({ red: 'rv_jou' });
    expect(getPlayer(m, 'blue-0').pos).toEqual({ x: 3, y: 5 });
    expect(createMatch()).toEqual(createMatch({}));
    expect(createMatch().keepers).toBeUndefined();
    expect(createMatch().homes).toBeUndefined();
    expect(createMatch().players[0].charId).toBe('technical');
    expect(getPlayer(createMatch(), 'red-0').pos).toEqual({ x: 3, y: 3 });
  });
});

describe('+n ids', () => {
  it('splitCharId / withPlus', () => {
    expect(splitCharId('st_kakeru')).toEqual({ base: 'st_kakeru', plus: 0 });
    expect(splitCharId('st_kakeru+3')).toEqual({ base: 'st_kakeru', plus: 3 });
    expect(splitCharId('rv_enji+20').plus).toBe(20);
    for (const bad of ['a+0', 'a+21', 'a+1.5', 'a+', 'a+x', '+3', 'a+-1']) expect(() => splitCharId(bad)).toThrow();
    expect(withPlus('a', 0)).toBe('a');
    expect(withPlus('a', 4)).toBe('a+4');
    expect(() => withPlus('a', 21)).toThrow();
  });

  it('getCharacter adds n to every stat with clamping', () => {
    const base = getCharacter('st_kakeru');
    const c = getCharacter('st_kakeru+3');
    expect(c.id).toBe('st_kakeru+3');
    expect(c.name).toBe(base.name);
    for (const k of Object.keys(base.stats) as (keyof Stats)[]) expect(c.stats[k]).toBe(base.stats[k] + 3);
    expect(getCharacter('st_ouga+20').stats.shoot).toBe(99);
    expect(getCharacter('technical+2').stats.shoot).toBe(87);
    expect(getCharacter('technical+2').id).toBe('technical+2');
    for (const bad of ['st_kakeru+0', 'st_kakeru+21', 'st_kakeru+1.5', 'nobody+2']) expect(() => getCharacter(bad)).toThrow();
  });

  it('getProfile keeps content, only id changes', () => {
    const p = getProfile('wg_sora+4');
    expect(p).toEqual({ ...getProfile('wg_sora'), id: 'wg_sora+4' });
    expect(getProfile('speed+2').id).toBe('speed+2');
    expect(() => getProfile('nobody+2')).toThrow();
  });

  it('match accepts +n ids', () => {
    const m = createMatch({ lineups: { red: { field: RIVAL_LINEUP.field.map((id) => withPlus(id, 4)), gk: withPlus(RIVAL_LINEUP.gk, 4) } } });
    expect(m.players[5].charId).toBe('rv_enji+4');
    expect(m.keepers?.red).toBe('rv_jou+4');
  });
});
