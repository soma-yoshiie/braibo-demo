import type { PlayerId, TeamId, Vec } from '../game/types';

/** A token as displayed (position is in fractional cell units and may be mid-animation). */
export interface TokenView {
  id: PlayerId;
  team: TeamId;
  abbr: string;
  x: number;
  y: number;
  hasBall: boolean;
}

export type BallView =
  | { kind: 'held' }
  | { kind: 'free'; x: number; y: number; snap?: boolean };

export interface PlanView {
  id: PlayerId;
  abbr: string;
  from: Vec;
  to: Vec;
  stay: boolean;
}

export interface ArrowView {
  from: Vec;
  /** Target in cell coordinates (may be off-board for shots). */
  to: Vec;
  style: 'pass' | 'cross' | 'shoot';
  label?: string;
}

export interface PassTargetView {
  id: PlayerId;
  label: string;
  enabled: boolean;
}

export interface BadgeView {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface LogLine {
  id: number;
  turn: number;
  text: string;
}

export interface StatPill {
  key: string;
  value: number;
}
