import type { PlayerId, TeamId, Vec } from '../game/types';

/** A token as displayed (position is in fractional cell units and may be mid-animation). */
export interface TokenView {
  id: PlayerId;
  team: TeamId;
  abbr: string;
  /** Roster id (look, number and rarity come from `getProfile`). */
  charId: string;
  number: number;
  x: number;
  y: number;
  hasBall: boolean;
  /** Keep drawn above its cell-mate (holder whose ball is in flight). */
  top?: boolean;
  /** Blue token whose destination has been set this turn. */
  planned?: boolean;
  /** Duel clash: scale up. */
  clash?: boolean;
  /** WIN / LOSE tag shown above the token. */
  tag?: { kind: 'win' | 'lose'; label: string };
  /** Movement duration override in ms. */
  moveMs?: number;
}

/** Offset / scale of a token that shares its cell with an opponent (cell units, relative to the cell centre). */
export interface TokenLayout {
  dx: number;
  dy: number;
  s: number;
}

export type BallView =
  | { kind: 'held' }
  | { kind: 'free'; x: number; y: number; snap?: boolean; arc?: number; flightKey?: number; ms?: number };

export interface TrajectoryView {
  from: Vec;
  to: Vec;
  /** Arc height in cells (0 = straight). */
  arc: number;
}

export interface PlanView {
  id: PlayerId;
  abbr: string;
  charId: string;
  number: number;
  from: Vec;
  to: Vec;
  stay: boolean;
}

export interface ArrowView {
  from: Vec;
  /** Target in cell coordinates (may be off-board for shots). */
  to: Vec;
  style: 'pass' | 'lofted' | 'cross' | 'shoot';
  label?: string;
  /** Small glyph shown before the label (→ / ⌒). */
  glyph?: string;
  /** Warning colour (OFFSIDE?). */
  warn?: boolean;
}

export interface PassTargetView {
  id: PlayerId;
  label: string;
  enabled: boolean;
  /** Receiver would be offside: show the OFFSIDE badge instead of the percentage. */
  offside?: boolean;
}

/** Impact burst at a duel position. */
export interface BurstView {
  id: string;
  x: number;
  y: number;
  team: TeamId;
}

export interface SpaceCellView {
  x: number;
  y: number;
  enemy: boolean;
}

export interface RadialMenuItem {
  key: 'shoot' | 'pass' | 'cross' | 'keep' | 'stay' | 'info';
  label: string;
  /** Second line (e.g. a percentage). */
  sub?: string;
  enabled: boolean;
  active?: boolean;
  onTap: () => void;
}

export interface RadialMenuView {
  /** Anchor token position in cell units. */
  x: number;
  y: number;
  items: RadialMenuItem[];
}

export interface LogLine {
  id: number;
  turn: number;
  text: string;
}

/** The player shown in the action bar's strip. */
export interface SelectedView {
  team: TeamId;
  charId: string;
  name: string;
  title: string;
  number: number;
  abbr: string;
  rarity: 3 | 4 | 5;
}

/** Duel cut-in (DESIGN-UI §14.10). Rates are 0..1 and add up to 1. */
export interface DuelCutInView {
  key: number;
  aerial: boolean;
  blue: { charId: string; value: number };
  red: { charId: string; value: number };
  blueRate: number;
  winner: TeamId;
  resultLine: string;
}

/** Goal cut-in: the scorer. Without it the old flash + confetti plays. */
export interface GoalFxView {
  key: number;
  scorer?: { charId: string; team: TeamId };
}

/** Trap cut-in (DESIGN-UI §16.2): the declaring side's rear-most player. */
export interface TrapCutInView {
  key: number;
  charId: string;
  team: TeamId;
}

/** Marks on the participants of the blue offside-trap declaration (§16.1). */
export interface TrapMarkView {
  id: PlayerId;
  charId: string;
  number: number;
  abbr: string;
  /** Current cell. */
  x: number;
  y: number;
  /** Cell one step ahead; equal to `y` when the step is blocked (the player stays). */
  toY: number;
}

/** The trap button and its marks on the pitch. */
export interface TrapView {
  on: boolean;
  /** Turns until the next declaration is possible (0 = can declare). */
  wait: number;
  marks: TrapMarkView[];
  onToggle: () => void;
}

export interface HalfTimeView {
  score: Record<TeamId, number>;
  kickoffTeam: TeamId;
}
