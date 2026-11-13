import type { FieldPosition, TeamId, Vec } from '../types';
import { BOARD } from '../rules/config';
import { getCharacter } from './characters';

export interface FormationSlot {
  charId: string;
  /** Position for the BLUE team (attacking upward). Red is mirrored. */
  pos: Vec;
}

/**
 * Default 5-player formation, expressed for blue. Slot 0 is the kickoff
 * taker (must be at the center column, just inside own half).
 */
export const DEFAULT_FORMATION: FormationSlot[] = [
  { charId: 'technical', pos: { x: 3, y: 5 } },
  { charId: 'speed', pos: { x: 1, y: 6 } },
  { charId: 'playmaker', pos: { x: 5, y: 6 } },
  { charId: 'support', pos: { x: 2, y: 7 } },
  { charId: 'physical', pos: { x: 3, y: 8 } },
];

/** Mirror a blue-relative position for the red team. */
export function mirrorPos(pos: Vec): Vec {
  return { x: BOARD.cols - 1 - pos.x, y: BOARD.rows - 1 - pos.y };
}

export function formationPos(team: TeamId, slot: FormationSlot): Vec {
  return team === 'blue' ? { ...slot.pos } : mirrorPos(slot.pos);
}

// ---------------------------------------------------------------------------
// v0.9 free formation (DESIGN.md §15.4): the starting cells follow from the players' positions.
// ---------------------------------------------------------------------------

type Count = 1 | 2 | 3 | 4 | 5;
export type LayoutPhase = 'kick' | 'defend';

/** Tuning surface for the automatic layout (blue's view; red is mirrored). */
export const FORMATION: {
  /** Rows of the team that kicks off (its slot 0 then steps to `kickoffSpot`). */
  rows: Record<FieldPosition, number>;
  /** Rows of the team that does not kick off (also the AI's home rows). */
  defendRows: Record<FieldPosition, number>;
  /** In the 'defend' layout a DF that would share a cell with a MF steps back this many rows. */
  defendDrop: number;
  cols: Record<FieldPosition, Record<Count, number[]>>;
  /** Where the kicking team's slot 0 stands at a kickoff. */
  kickoffSpot: Vec;
} = {
  rows: { FW: 5, MF: 6, DF: 7 },
  defendRows: { FW: 6, MF: 7, DF: 7 },
  defendDrop: 1,
  cols: {
    FW: { 1: [3], 2: [2, 4], 3: [1, 3, 5], 4: [0, 2, 4, 6], 5: [1, 2, 3, 4, 5] },
    MF: { 1: [3], 2: [1, 5], 3: [1, 3, 5], 4: [0, 2, 4, 6], 5: [1, 2, 3, 4, 5] },
    DF: { 1: [3], 2: [2, 4], 3: [1, 3, 5], 4: [0, 2, 4, 6], 5: [1, 2, 3, 4, 5] },
  },
  kickoffSpot: { x: 3, y: 5 },
};

const SLOT_POSITIONS: FieldPosition[] = ['FW', 'MF', 'DF'];

function fieldPosition(charId: string): FieldPosition {
  const pos = getCharacter(charId).position;
  if (pos === 'GK') throw new Error(`A goalkeeper cannot play in the field: ${charId}`);
  return pos;
}

/** FW first, then MF, then DF; players of the same position keep their given order. Slot 0 takes the kickoff. */
export function fieldSlotOrder(charIds: string[]): string[] {
  const rank = (id: string): number => SLOT_POSITIONS.indexOf(fieldPosition(id));
  return charIds
    .map((id, i) => ({ id, i, r: rank(id) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.id);
}

/**
 * Blue-view cells for `charIds` (already in slot order, see `fieldSlotOrder`), one Vec per id.
 * 'kick' = the team that kicks off, 'defend' = the other team. In the front row (the row of slot 0) slot 0
 * takes the column nearest to the centre (the lower column on a tie); the others fill the free columns in order.
 * For 'kick' the caller still moves slot 0 onto `FORMATION.kickoffSpot`.
 * In 'defend' the MF and DF rows coincide: a DF that lands on a MF's cell steps back `FORMATION.defendDrop` rows.
 */
export function layoutField(charIds: string[], phase: LayoutPhase = 'kick'): Vec[] {
  const rows = phase === 'kick' ? FORMATION.rows : FORMATION.defendRows;
  const byPos = new Map<FieldPosition, number[]>();
  charIds.forEach((id, i) => {
    const pos = fieldPosition(id);
    byPos.set(pos, [...(byPos.get(pos) ?? []), i]);
  });
  const out: Vec[] = new Array<Vec>(charIds.length);
  for (const [pos, idxs] of byPos) {
    const n = Math.min(5, idxs.length) as Count;
    const free = [...FORMATION.cols[pos][n]];
    const colOf = new Map<number, number>();
    if (idxs.includes(0)) {
      let best = 0;
      free.forEach((c, k) => {
        if (Math.abs(c - 3) < Math.abs((free[best] as number) - 3)) best = k;
      });
      colOf.set(0, free.splice(best, 1)[0] as number);
    }
    for (const slot of idxs) if (!colOf.has(slot)) colOf.set(slot, free.shift() as number);
    for (const slot of idxs) out[slot] = { x: colOf.get(slot) as number, y: rows[pos] };
  }
  if (phase === 'defend') {
    const mf = charIds.map((_, i) => i).filter((i) => fieldPosition(charIds[i] as string) === 'MF').map((i) => out[i] as Vec);
    charIds.forEach((id, i) => {
      const c = out[i] as Vec;
      if (fieldPosition(id) === 'DF' && mf.some((m) => m.x === c.x && m.y === c.y)) out[i] = { x: c.x, y: c.y + FORMATION.defendDrop };
    });
  }
  return out;
}
