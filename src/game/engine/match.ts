import type { MatchState, PlayerId, PlayerState, TeamId, ThroughPassMode, Vec } from '../types';
import { BOARD, MATCH, type MatchConfig } from '../rules/config';
import { DEFAULT_FORMATION, formationPos, type FormationSlot } from '../data/formations';
import { vecEq } from '../rules/geometry';

export type CreateMatchOptions = Partial<MatchConfig> & {
  formation?: FormationSlot[];
  throughPass?: ThroughPassMode;
  /** v0.8 rule switches (missing = RULES.trap.enabled / MATCH.halves). */
  trap?: boolean;
  halves?: boolean;
  /** Per team, slot-ordered charIds overriding the formation's charId (positions still come from the formation). */
  lineups?: Partial<Record<TeamId, string[]>>;
};

const TEAMS: TeamId[] = ['blue', 'red'];

export function createMatch(options: CreateMatchOptions = {}): MatchState {
  const formation = options.formation ?? DEFAULT_FORMATION;
  const firstKickoff = options.firstKickoff ?? MATCH.firstKickoff;
  const players: PlayerState[] = [];
  for (const team of TEAMS) {
    formation.forEach((slot, index) => {
      players.push({
        id: `${team}-${index}`,
        team,
        index,
        charId: options.lineups?.[team]?.[index] ?? slot.charId,
        pos: formationPos(team, slot),
        flags: {},
      });
    });
  }
  return kickoffState({
    turn: 1,
    maxTurns: options.maxTurns ?? MATCH.maxTurns,
    score: { blue: 0, red: 0 },
    players,
    ball: { kind: 'held', playerId: `${firstKickoff}-0` },
    phase: 'planning',
    kickoffTeam: firstKickoff,
    ...(options.throughPass ? { throughPass: options.throughPass } : {}),
    ...(options.trap !== undefined ? { trap: options.trap } : {}),
    ...(options.halves !== undefined ? { halves: options.halves } : {}),
    firstKickoff,
  }, firstKickoff, formation);
}

/** Reset positions to the formation, clear flags, give the ball to `kickoffTeam`-0. */
export function kickoffState(state: MatchState, kickoffTeam: TeamId, formation: FormationSlot[] = DEFAULT_FORMATION): MatchState {
  const gap = MATCH.kickoffGap;
  const formPos = (p: PlayerState): Vec => {
    const slot = formation[p.index];
    return slot ? formationPos(p.team, slot) : { ...p.pos };
  };
  /** Non-kicking team's slot 0 is pulled back toward its own goal (blue: +y, red: -y). */
  const pulledBack = (p: PlayerState): Vec => {
    const base = formPos(p);
    if (p.index !== 0 || p.team === kickoffTeam || gap === 0) return base;
    const y = Math.min(BOARD.rows - 1, Math.max(0, base.y + (p.team === 'blue' ? gap : -gap)));
    const cand = { x: base.x, y };
    const taken = state.players.some((q) => q.team === p.team && q.id !== p.id && vecEq(formPos(q), cand));
    return taken ? base : cand;
  };
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, pos: pulledBack(p), flags: {} })),
    ball: { kind: 'held', playerId: `${kickoffTeam}-0` },
    kickoffTeam,
  };
}

export function getPlayer(state: MatchState, id: PlayerId): PlayerState {
  const p = state.players.find((q) => q.id === id);
  if (!p) throw new Error(`Unknown player: ${id}`);
  return p;
}

export function playersOf(state: MatchState, team: TeamId): PlayerState[] {
  return state.players.filter((p) => p.team === team);
}

export function ballHolder(state: MatchState): PlayerState | undefined {
  return state.ball.kind === 'held' ? getPlayer(state, state.ball.playerId) : undefined;
}

/** All players standing on `pos` (at most one per team since v0.4), optionally only of `team`. */
export function playersAt(state: MatchState, pos: Vec, team?: TeamId): PlayerState[] {
  return state.players.filter((p) => vecEq(p.pos, pos) && (team === undefined || p.team === team));
}

/** First player on `pos` (of `team` if given). A cell can hold one player per team: pass `team` or use `playersAt`. */
export function playerAt(state: MatchState, pos: Vec, team?: TeamId): PlayerState | undefined {
  return playersAt(state, pos, team)[0];
}
