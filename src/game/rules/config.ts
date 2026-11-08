/**
 * All tunable numbers live here. Nothing in this file is final: it is the
 * balancing surface of the prototype. Engine/AI/UI must read values from
 * here instead of hard-coding them.
 */

export interface BoardConfig {
  cols: number;
  rows: number;
  /** Column of the goal mouth (center cell of the end line). */
  goalX: number;
  /** Columns counted as "wide" (crosses may be delivered from here). */
  wideColumns: number[];
  /** Columns counted as "central" (cross targets must be here). */
  centralColumns: number[];
  /** A cross target must be within this many rows of the attacking end line. */
  crossZoneRows: number;
}

export const BOARD: BoardConfig = {
  cols: 7,
  rows: 10,
  goalX: 3,
  wideColumns: [0, 1, 5, 6],
  centralColumns: [2, 3, 4],
  crossZoneRows: 4,
};

export interface MatchConfig {
  maxTurns: number;
  /** At kickoff, the non-kicking team's slot-0 player is pulled back this many rows toward its own goal. */
  kickoffGap: number;
  /** Planning time per turn in seconds. 0 disables the timer. */
  planningSeconds: number;
  /** Team that kicks off at the start of the match. */
  firstKickoff: 'blue' | 'red';
}

export const MATCH: MatchConfig = {
  maxTurns: 20,
  kickoffGap: 1,
  planningSeconds: 60,
  firstKickoff: 'blue',
};

/** Probability tunables. Stat deltas use (stat - 50) / divisor. */
export const RULES = {
  // ---- ground duels (same-cell contact) -----------------------------------
  duel: {
    base: 0.5,
    physicalDivisor: 200, // +50 phys difference => +0.25
    carrierBonus: 0.05, // the ball carrier is slightly favoured to keep it
    min: 0.15,
    max: 0.85,
  },
  // ---- passes -------------------------------------------------------------
  pass: {
    maxDistance: 6, // euclidean, in cells
    base: 0.97,
    falloffPerCell: 0.05, // applied to (distance - 1)
    statDivisor: 400,
    min: 0.3,
    max: 0.98,
    /** Half-width (in cells) of the lane in which a defender may intercept. */
    laneWidth: 0.6,
    /** Accuracy penalty for a pass aimed at a cell instead of a player. */
    spacePenalty: 0.05,
    intercept: {
      base: 0.3,
      statDivisor: 250,
      /** Extra chance when standing exactly on the line (scaled by lane offset). */
      onLineBonus: 0.25,
      min: 0.05,
      max: 0.9,
    },
  },
  // ---- crosses ------------------------------------------------------------
  cross: {
    maxDistance: 6,
    base: 0.9,
    falloffPerCell: 0.04,
    statDivisor: 300,
    min: 0.3,
    max: 0.95,
    aerial: {
      base: 0.5,
      statDivisor: 200,
      min: 0.15,
      max: 0.85,
    },
    header: {
      maxDistance: 3.7, // from goal target point; covers every cell of the cross zone (corner cells are 3.64 away)
      base: 0.8,
      falloffPerCell: 0.14,
      statDivisor: 250,
      min: 0.05,
      max: 0.85,
    },
  },
  // ---- shots --------------------------------------------------------------
  shot: {
    base: 0.92,
    falloffPerCell: 0.11,
    statDivisor: 250,
    /** Up to this distance the `shoot` stat is used; beyond nearRange+blend, `longShot`. */
    nearRange: 2.5,
    blendRange: 2,
    /** Multiplier penalty for wide angles: p *= 1 - anglePenalty * sin(angle). */
    anglePenalty: 0.25,
    min: 0.03,
    max: 0.92,
    laneWidth: 0.6,
    block: {
      base: 0.95, // defender exactly 1 cell in front of the shooter
      falloffPerCell: 0.2, // applied to (distance from shooter - 1)
      statDivisor: 250,
      /** Penalty scaled by lane offset (0 on the line, full at laneWidth). */
      offLinePenalty: 0.3,
      min: 0.05,
      max: 0.97,
    },
  },
  // ---- skills -------------------------------------------------------------
  skills: {
    counterExtraRange: 1,
    oneTouchShotBonus: 0.12,
    airBattlerBonus: 0.12,
    passMasterExtraDistance: 2,
    passMasterAccuracyBonus: 0.05,
    blockMasterBonus: 0.1,
  },
} as const;

/** Goal target point (center of the goal mouth, half a cell beyond the end line). */
export function goalTarget(attackingTeam: 'blue' | 'red', board: BoardConfig = BOARD) {
  return attackingTeam === 'blue'
    ? { x: board.goalX, y: -0.5 }
    : { x: board.goalX, y: board.rows - 0.5 };
}

export function forwardDir(team: 'blue' | 'red'): 1 | -1 {
  return team === 'blue' ? -1 : 1;
}

export function otherTeam(team: 'blue' | 'red'): 'blue' | 'red' {
  return team === 'blue' ? 'red' : 'blue';
}
