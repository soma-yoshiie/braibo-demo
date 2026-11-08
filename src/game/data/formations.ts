import type { TeamId, Vec } from '../types';
import { BOARD } from '../rules/config';

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
  { charId: 'striker', pos: { x: 3, y: 5 } },
  { charId: 'wing', pos: { x: 1, y: 6 } },
  { charId: 'longShooter', pos: { x: 5, y: 6 } },
  { charId: 'interceptor', pos: { x: 2, y: 7 } },
  { charId: 'physicalDefender', pos: { x: 3, y: 8 } },
];

/** Mirror a blue-relative position for the red team. */
export function mirrorPos(pos: Vec): Vec {
  return { x: BOARD.cols - 1 - pos.x, y: BOARD.rows - 1 - pos.y };
}

export function formationPos(team: TeamId, slot: FormationSlot): Vec {
  return team === 'blue' ? { ...slot.pos } : mirrorPos(slot.pos);
}
