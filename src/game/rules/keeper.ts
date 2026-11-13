import type { MatchState, Stats, TeamId } from '../types';
import { getCharacter } from '../data/characters';

/** Stats of the goalkeeper of `team` (the DEFENDING team of a shot), or undefined when that team has none. */
export function keeperStats(state: MatchState, team: TeamId): Stats | undefined {
  const id = state.keepers?.[team];
  return id ? getCharacter(id).stats : undefined;
}
