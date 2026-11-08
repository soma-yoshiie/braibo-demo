/**
 * BRAIBO core types.
 *
 * Coordinate system
 * -----------------
 *  - x: 0..cols-1 (left -> right as seen by the blue player)
 *  - y: 0..rows-1 (top -> bottom)
 *  - Blue defends the BOTTOM goal (y = rows) and attacks the TOP goal (y = -1).
 *  - Red defends the TOP goal and attacks the BOTTOM goal.
 *  - "forward" for a team is `forwardDir(team)`: blue = -1, red = +1 (on the y axis).
 *
 * Everything in `game/` is pure data + pure functions. Randomness is always
 * injected through an `Rng` so that every rule can be unit-tested.
 */

export type TeamId = 'blue' | 'red';

export interface Vec {
  x: number;
  y: number;
}

export type PlayerId = string; // `${team}-${index}` e.g. 'blue-0'

/** Seeded random source. `next()` returns a float in [0, 1). */
export interface Rng {
  next(): number;
}

// ---------------------------------------------------------------------------
// Character data (static, data-driven)
// ---------------------------------------------------------------------------

export type RoleId =
  | 'striker'
  | 'wing'
  | 'longShooter'
  | 'interceptor'
  | 'physicalDefender';

/**
 * One movement vector in TEAM-RELATIVE coordinates.
 *  - dy < 0 means "forward" (toward the enemy goal), dy > 0 means "back".
 *  - range: how many times the vector may be repeated (1 = single step,
 *    2 = may stop after 1 or 2 steps, shogi "slide" limited to `range`).
 * For the red team the engine mirrors dy (and only dy).
 */
export interface MoveStep {
  dx: number;
  dy: number;
  range: number;
}

/** All stats are on a 1..100 scale. 50 = average. */
export interface Stats {
  physical: number; // ground duels / tackles
  aerial: number; // aerial duels, headers
  shoot: number; // short/mid range shooting
  longShot: number; // long range shooting
  pass: number; // pass accuracy
  cross: number; // cross delivery
  intercept: number; // chance to cut passes on the lane
  block: number; // chance to block shots on the lane
}

export type SkillId =
  | 'counter' // extra move range on the turn after winning the ball
  | 'oneTouch' // shot bonus on the turn after receiving a pass
  | 'airBattler' // aerial duel / header bonus
  | 'passMaster' // longer passes and pass accuracy bonus
  | 'blockMaster'; // block bonus

export interface CharacterDef {
  id: string;
  name: string; // display name (Japanese)
  role: RoleId;
  abbr: string; // 2-letter badge, e.g. 'ST'
  moves: MoveStep[];
  stats: Stats;
  skills: SkillId[];
  description: string;
}

// ---------------------------------------------------------------------------
// Match state
// ---------------------------------------------------------------------------

export interface PlayerFlags {
  /** Turn number in which this player received a completed pass (for oneTouch). */
  receivedPassTurn?: number;
  /** Turn number in which this player won the ball by duel/intercept (for counter). */
  wonBallTurn?: number;
}

export interface PlayerState {
  id: PlayerId;
  team: TeamId;
  index: number; // 0..4, slot in the formation
  charId: string; // CharacterDef.id
  pos: Vec;
  flags: PlayerFlags;
}

export type BallState =
  | { kind: 'held'; playerId: PlayerId }
  | { kind: 'loose'; pos: Vec };

export type MatchPhase = 'planning' | 'finished';

export interface MatchState {
  /** 1-based number of the turn currently being planned. */
  turn: number;
  maxTurns: number;
  score: Record<TeamId, number>;
  players: PlayerState[]; // always 10, blue-0..4 then red-0..4
  ball: BallState;
  phase: MatchPhase;
  /** Team that took the most recent kickoff. */
  kickoffTeam: TeamId;
}

// ---------------------------------------------------------------------------
// Plans (input of a turn)
// ---------------------------------------------------------------------------

export type BallActionPlan =
  | { kind: 'keep' }
  | { kind: 'pass'; targetId: PlayerId }
  /** Pass toward an empty cell ("through ball"). Whoever stands there after movement gets it; nobody => loose ball. */
  | { kind: 'spacePass'; target: Vec }
  | { kind: 'cross'; targetId: PlayerId }
  | { kind: 'shoot' };

export type BallActionKind = BallActionPlan['kind'];

export interface TeamPlan {
  team: TeamId;
  /** Destination per player id. A missing entry means "stay". */
  moves: Partial<Record<PlayerId, Vec>>;
  /** Only used when a player of this team holds the ball at planning time. */
  ballAction?: BallActionPlan;
}

export type TurnPlans = Record<TeamId, TeamPlan>;

// ---------------------------------------------------------------------------
// Turn resolution output
// ---------------------------------------------------------------------------

export type DuelKind = 'ground' | 'aerial';

export type TurnEvent =
  | { type: 'move'; playerId: PlayerId; from: Vec; to: Vec }
  /** A player who tried to move but was sent back (same-team conflict or lost duel). */
  | { type: 'bounce'; playerId: PlayerId; from: Vec; to: Vec; reason: 'teammate' | 'duel' }
  /** A stationary player who lost a duel and was pushed to a nearby cell. */
  | { type: 'displace'; playerId: PlayerId; from: Vec; to: Vec }
  | {
      type: 'duel';
      kind: DuelKind;
      pos: Vec;
      aId: PlayerId;
      bId: PlayerId;
      winnerId: PlayerId;
      forBall: boolean;
      pAWins: number;
    }
  | { type: 'pickup'; playerId: PlayerId; pos: Vec }
  | {
      type: 'pass';
      passerId: PlayerId;
      /** Intended receiver (absent for a space pass). */
      targetId?: PlayerId;
      /** True when the pass was aimed at a cell rather than a player. */
      space?: boolean;
      from: Vec;
      to: Vec;
      /**
       * complete: a teammate holds the ball (receiverId) — for a space pass, a teammate stood on the cell.
       * toEnemy: (space pass) an enemy stood on the target cell and took the ball (receiverId).
       * loose: (space pass) the cell was empty; the ball lies there (loosePos = to).
       * intercepted / failed: as before.
       */
      outcome: 'complete' | 'intercepted' | 'failed' | 'toEnemy' | 'loose';
      receiverId?: PlayerId;
      interceptorId?: PlayerId;
      loosePos?: Vec;
      pSuccess: number;
    }
  | {
      type: 'cross';
      passerId: PlayerId;
      targetId: PlayerId;
      from: Vec;
      to: Vec;
      outcome: 'failed' | 'won' | 'lost' | 'uncontested';
      defenderId?: PlayerId;
      loosePos?: Vec;
      pDelivery: number;
    }
  | {
      type: 'shot';
      shooterId: PlayerId;
      kind: 'shot' | 'header';
      from: Vec;
      target: Vec; // goal target point (may be off-board)
      outcome: 'goal' | 'blocked' | 'missed';
      blockerId?: PlayerId;
      pGoal: number; // P(goal | not blocked)
    }
  /** A planned pass/cross could not be attempted (e.g. receiver ended out of range). The carrier keeps the ball. */
  | {
      type: 'actionCancelled';
      playerId: PlayerId;
      action: BallActionKind;
      reason: 'outOfRange' | 'invalidTarget';
    }
  | { type: 'goal'; team: TeamId; scorerId: PlayerId }
  | { type: 'goalKick'; team: TeamId; playerId: PlayerId }
  | { type: 'kickoff'; team: TeamId }
  | { type: 'matchEnd'; winner: TeamId | 'draw'; score: Record<TeamId, number> };

export interface TurnResult {
  /** State at the START of the turn (for animation). */
  before: MatchState;
  /**
   * State right after movement + ball action, BEFORE any kickoff reset.
   * Equals `after` when no goal was scored.
   */
  afterAction: MatchState;
  /** Authoritative state for the next turn (kickoff reset applied if a goal). */
  after: MatchState;
  events: TurnEvent[];
}

// ---------------------------------------------------------------------------
// Probability previews (UI / AI)
// ---------------------------------------------------------------------------

export interface ShotEstimate {
  distance: number;
  pGoalIfUnblocked: number;
  pBlocked: number;
  /** pGoalIfUnblocked * (1 - pBlocked) */
  pGoal: number;
  blockers: { playerId: PlayerId; pBlock: number }[];
}

export interface PassEstimate {
  distance: number;
  pAccurate: number;
  pIntercepted: number;
  /** pAccurate * (1 - pIntercepted) */
  pComplete: number;
  interceptors: { playerId: PlayerId; pIntercept: number }[];
  inRange: boolean;
}

export interface CrossEstimate {
  distance: number;
  pDelivery: number;
  valid: boolean; // cross conditions satisfied from these positions
  defenderId?: PlayerId;
  pWinAerial: number; // 1 if uncontested
  pHeaderGoal: number; // 0 if out of header range
  /** pDelivery * pWinAerial * pHeaderGoal */
  pGoal: number;
}
