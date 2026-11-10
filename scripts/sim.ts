/**
 * AI-vs-AI simulation: `npm run sim -- [games=200] [seed=1] [early|legacy]`.
 * Runs the same number of games under the legacy and the early (v0.5) space-pass rule and prints a comparison.
 */
import type { ThroughPassMode, TurnEvent } from '../src/game/types';
import { createMatch } from '../src/game/engine/match';
import { createRng } from '../src/game/engine/rng';
import { resolveTurn } from '../src/game/engine/resolve';
import { AI_WEIGHTS, planAiTurn } from '../src/game/ai/simpleAi';
import { ballHolder } from '../src/game/engine/match';

// Tuning aid: `AIW_tpBonus=0.2 npm run sim -- 100 1 early` overrides AI_WEIGHTS.tpBonus for this run only.
for (const [k, v] of Object.entries(process.env)) {
  if (k.startsWith('AIW_') && v !== undefined) (AI_WEIGHTS as unknown as Record<string, number>)[k.slice(4)] = Number(v);
}

interface Stats {
  games: number;
  goals: number;
  offsides: number;
  blueWins: number;
  redWins: number;
  draws: number;
  spaceAttempts: number;
  spaceComplete: number;
  spaceOffside: number;
  breakawayGoals: number;
  crosses: number;
  footPasses: number;
  outcomes: Record<string, number>;
}

function run(mode: ThroughPassMode, games: number, seed: number): Stats {
  const rng = createRng(seed);
  const st: Stats = {
    games, goals: 0, offsides: 0, blueWins: 0, redWins: 0, draws: 0, spaceAttempts: 0, spaceComplete: 0,
    spaceOffside: 0, breakawayGoals: 0, crosses: 0, footPasses: 0, outcomes: {},
  };
  for (let g = 0; g < games; g++) {
    let state = createMatch({ throughPass: mode, firstKickoff: g % 2 === 0 ? 'blue' : 'red' });
    /** playerId -> turns at which they received a space pass (complete). */
    const received = new Map<string, number[]>();
    while (state.phase !== 'finished') {
      const holder = ballHolder(state);
      const plans = { blue: planAiTurn(state, 'blue', rng), red: planAiTurn(state, 'red', rng) };
      const r = resolveTurn(state, plans, rng);
      const events: TurnEvent[] = r.events;
      const action = holder ? plans[holder.team].ballAction : undefined;
      const cancelled = events.some((e) => e.type === 'actionCancelled');
      if (action && !cancelled) {
        if (action.kind === 'spacePass') st.spaceAttempts++;
        else if (action.kind === 'cross') st.crosses++;
        else if (action.kind === 'pass') st.footPasses++;
      }
      for (const e of events) {
        if (e.type === 'offside') {
          st.offsides++;
          if (plans[e.team].ballAction?.kind === 'spacePass') st.spaceOffside++;
          if (plans[e.team].ballAction?.kind === 'spacePass') st.outcomes.offside = (st.outcomes.offside ?? 0) + 1;
        } else if (e.type === 'pass' && e.space) {
          st.outcomes[e.outcome] = (st.outcomes[e.outcome] ?? 0) + 1;
        }
        if (e.type === 'pass' && e.space && e.outcome === 'complete' && e.receiverId) {
          st.spaceComplete++;
          received.set(e.receiverId, [...(received.get(e.receiverId) ?? []), state.turn]);
        } else if (e.type === 'goal') {
          st.goals++;
          const turns = received.get(e.scorerId) ?? [];
          if (turns.some((t) => state.turn - t === 1 || state.turn - t === 2)) st.breakawayGoals++;
        }
      }
      state = r.after;
    }
    const { blue, red } = state.score;
    if (blue > red) st.blueWins++;
    else if (red > blue) st.redWins++;
    else st.draws++;
  }
  return st;
}

const games = Number(process.argv[2] ?? 200) || 200;
const seed = Number(process.argv[3] ?? 1) || 1;
const only = process.argv[4]; // optional: 'early' | 'legacy' (skip the other column while tuning)
const a = only === 'early' ? undefined : run('legacy', games, seed);
const b = only === 'legacy' ? undefined : run('early', games, seed);

const f = (x: number, d = 2) => x.toFixed(d);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const rows: [string, (s: Stats) => string][] = [
  ['得点 / 試合', (s) => f(s.goals / s.games)],
  ['オフサイド / 試合', (s) => f(s.offsides / s.games)],
  ['青勝', (s) => pct(s.blueWins / s.games)],
  ['赤勝', (s) => pct(s.redWins / s.games)],
  ['引分', (s) => pct(s.draws / s.games)],
  ['スペースパス試行 / 試合', (s) => f(s.spaceAttempts / s.games)],
  ['  成功率 (complete / 試行)', (s) => pct(s.spaceAttempts ? s.spaceComplete / s.spaceAttempts : 0)],
  ['  うちオフサイド / 試合', (s) => f(s.spaceOffside / s.games)],
  ['裏抜けからの得点 / 全得点', (s) => pct(s.goals ? s.breakawayGoals / s.goals : 0)],
  ['  内訳 / 試合', (s) => Object.entries(s.outcomes).map(([k, v]) => `${k}:${f(v / s.games)}`).join(' ')],
  ['クロス試行 / 試合', (s) => f(s.crosses / s.games)],
  ['足元パス試行 / 試合', (s) => f(s.footPasses / s.games)],
];
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - [...s].reduce((w, c) => w + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));
console.log(`games=${games} seed=${seed}`);
console.log(`${pad('', 30)}${pad('legacy', 12)}early`);
for (const [label, fn] of rows) console.log(`${pad(label, 30)}${pad(a ? fn(a) : '-', 12)}${b ? fn(b) : '-'}`);
if (process.env.SIM_BRIEF && b) {
  console.log(
    `BRIEF goals=${f(b.goals / b.games)} off=${f(b.offsides / b.games)} att=${f(b.spaceAttempts / b.games)} succ=${pct(b.spaceComplete / Math.max(1, b.spaceAttempts))} brk=${pct(b.breakawayGoals / Math.max(1, b.goals))} W/L/D=${b.blueWins}/${b.redWins}/${b.draws}`,
  );
}
