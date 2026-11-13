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
  /**
   * v0.5 rule switch for space passes (DESIGN.md §5). Missing = RULES.throughPass.defaultMode.
   * Always read it through `throughPassMode(state)`.
   */
  throughPass?: ThroughPassMode;
  /** v0.8 offside-trap switch (DESIGN.md §14.1). Missing = RULES.trap.enabled. Read it through `trapEnabled(state)`. */
  trap?: boolean;
  /** v0.8: per team, the first turn number on which a trap may be declared again (missing = 1). */
  trapReady?: Record<TeamId, number>;
  /** v0.8 two-halves switch (DESIGN.md §14.2). Missing = MATCH.halves. Read it through `halvesEnabled(state)`. */
  halves?: boolean;
  /** v0.8: team that took the opening kickoff (missing = MATCH.firstKickoff). */
  firstKickoff?: TeamId;
}

/**
 * early: a space pass is kicked BEFORE movement from turn-start positions (offside judged there too).
 * legacy: v0.4 behaviour (kicked after movement, judged on final positions).
 */
export type ThroughPassMode = 'early' | 'legacy';

// ---------------------------------------------------------------------------
// Plans (input of a turn)
// ---------------------------------------------------------------------------

/** ground = ゴロ (short, accurate, interceptable anywhere on the lane); lofted = 浮き玉 (long, less accurate, interceptable only near both ends). */
export type PassStyle = 'ground' | 'lofted';

export type BallActionPlan =
  | { kind: 'keep' }
  | { kind: 'pass'; targetId: PlayerId; style?: PassStyle } // style defaults to 'ground'
  /** Pass toward an empty cell ("through ball"). Whoever stands there after movement gets it; nobody => loose ball. */
  | { kind: 'spacePass'; target: Vec; style?: PassStyle }
  | { kind: 'cross'; targetId: PlayerId }
  | { kind: 'shoot' };

export type BallActionKind = BallActionPlan['kind'];

export interface TeamPlan {
  team: TeamId;
  /** Destination per player id. A missing entry means "stay". */
  moves: Partial<Record<PlayerId, Vec>>;
  /** Only used when a player of this team holds the ball at planning time. */
  ballAction?: BallActionPlan;
  /** v0.8: declare an offside trap (only valid while the opponent holds the ball and the cooldown is over). */
  trap?: boolean;
}

export type TurnPlans = Record<TeamId, TeamPlan>;

// ---------------------------------------------------------------------------
// Turn resolution output
// ---------------------------------------------------------------------------

export type DuelKind = 'ground' | 'aerial';

export type TurnEvent =
  | { type: 'move'; playerId: PlayerId; from: Vec; to: Vec }
  /** A player who tried to move but was sent back by a same-team conflict (v0.4: duels never bounce anyone). */
  | { type: 'bounce'; playerId: PlayerId; from: Vec; to: Vec; reason: 'teammate' }
  /** A stationary player who lost a same-team conflict and was pushed to the nearest empty cell. */
  | { type: 'displace'; playerId: PlayerId; from: Vec; to: Vec }
  /**
   * v0.4: a ground duel only happens where the ball is (carrier's cell, carrier swap, or a contested
   * loose ball), at most once per turn, and BOTH players stay in the cell afterwards. Opponents may
   * share a cell without any duel/event when the ball is not involved. See DESIGN.md §4.
   */
  | {
      type: 'duel';
      kind: DuelKind;
      pos: Vec;
      aId: PlayerId;
      bId: PlayerId;
      winnerId: PlayerId;
      /** Always true for `kind: 'ground'` since v0.4. */
      forBall: boolean;
      /** True when the duel was for a loose ball (no carrier bonus); a `pickup` by the winner follows. */
      loose?: boolean;
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
      style: PassStyle;
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
      /** v0.5: early through pass (kicked before movement; `from` is the kicker's turn-start cell). */
      early?: boolean;
      /** v0.5 early only: `intercepted` by a tight marker ON the target cell after movement (not on the lane at the kick). */
      marked?: boolean;
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
  /**
   * The intended receiver was in an offside position when the pass/cross was played (judged at final positions).
   * The pass is void and the ball is awarded to `toPlayerId` (defending team).
   */
  | {
      type: 'offside';
      team: TeamId; // attacking team that was caught offside
      passerId: PlayerId;
      receiverId: PlayerId;
      toPlayerId: PlayerId;
      from: Vec;
      to: Vec;
      style: PassStyle;
      /** v0.5: early through pass, judged on turn-start positions (`from` is the kicker's turn-start cell). */
      early?: boolean;
      /** v0.8: the receiver is onside when the trap participants are put one step back (the declaration made the foul). */
      byTrap?: true;
    }
  /** A planned pass/cross could not be attempted (e.g. receiver ended out of range). The carrier keeps the ball. */
  | {
      type: 'actionCancelled';
      playerId: PlayerId;
      action: BallActionKind;
      reason: 'outOfRange' | 'invalidTarget';
    }
  /** v0.8: a valid offside-trap declaration. First event of the turn. `from === to` for a participant that did not step. */
  | { type: 'trap'; team: TeamId; steps: { playerId: PlayerId; from: Vec; to: Vec }[] }
  /** v0.8: end of the first half (last event of that turn). The second half is kicked off by `kickoffTeam`. */
  | { type: 'halfTime'; score: Record<TeamId, number>; kickoffTeam: TeamId }
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
  style: PassStyle;
  distance: number;
  pAccurate: number;
  pIntercepted: number;
  /** pAccurate * (1 - pIntercepted); 0 when out of range or offside */
  pComplete: number;
  interceptors: { playerId: PlayerId; pIntercept: number }[];
  inRange: boolean;
  /** Receiver would be offside given the defender positions used for the estimate. */
  offside: boolean;
}

export interface CrossEstimate {
  distance: number;
  pDelivery: number;
  valid: boolean; // cross conditions satisfied from these positions
  offside: boolean; // receiver would be offside (pGoal = 0)
  defenderId?: PlayerId;
  pWinAerial: number; // 1 if uncontested
  pHeaderGoal: number; // 0 if out of header range
  /** pDelivery * pWinAerial * pHeaderGoal */
  pGoal: number;
}
