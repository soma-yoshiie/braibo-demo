/**
 * AI-vs-AI simulation: `npm run sim -- [games=200] [seed=1] [early|legacy|both] [trap=on|off|both] [halves=on|off|both]`.
 * Columns = space-pass mode x trap x halves. Defaults: early, trap=both, halves=on, i.e. "trap on vs trap off".
 * `legacy` / `early` / `both` keep their old meaning (which space-pass rule); `both` prints one column per rule.
 */
import type { ThroughPassMode, TurnEvent } from '../src/game/types';
import { createMatch } from '../src/game/engine/match';
import { halfTurns } from '../src/game/rules/config';
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
  trapDecl: number;
  trapDeclBlue: number;
  trapDeclRed: number;
  trapHits: number;
  /** [attempts, completions] of foot passes / through passes, over all turns and over turns with a declared trap. */
  foot: [number, number];
  footT: [number, number];
  thr: [number, number];
  thrT: [number, number];
  trapBy: Record<string, number>;
  goalsHalf: [number, number];
  outcomes: Record<string, number>;
}

interface Variant { mode: ThroughPassMode; trap: boolean; halves: boolean }

function run(v: Variant, games: number, seed: number): Stats {
  const mode = v.mode;
  const rng = createRng(seed);
  const st: Stats = {
    games, goals: 0, offsides: 0, blueWins: 0, redWins: 0, draws: 0, spaceAttempts: 0, spaceComplete: 0,
    spaceOffside: 0, breakawayGoals: 0, crosses: 0, footPasses: 0, outcomes: {},
    trapDecl: 0, trapDeclBlue: 0, trapDeclRed: 0, trapHits: 0, foot: [0, 0], footT: [0, 0], thr: [0, 0], thrT: [0, 0], trapBy: {}, goalsHalf: [0, 0],
  };
  for (let g = 0; g < games; g++) {
    let state = createMatch({ throughPass: mode, trap: v.trap, halves: v.halves, firstKickoff: g % 2 === 0 ? 'blue' : 'red' });
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
      const trapTurn = events.some((e) => e.type === 'trap');
      if (action && !cancelled && (action.kind === 'pass' || action.kind === 'spacePass')) {
        const done = events.some((e) => e.type === 'pass' && e.outcome === 'complete') ? 1 : 0;
        const [all, inT] = action.kind === 'pass' ? [st.foot, st.footT] : [st.thr, st.thrT];
        all[0]++;
        all[1] += done;
        if (trapTurn) {
          inT[0]++;
          inT[1] += done;
        }
      }
      for (const e of events) {
        if (e.type === 'offside') {
          st.offsides++;
          if (e.byTrap) {
            st.trapHits++;
            const k = plans[e.team].ballAction?.kind ?? '?';
            st.trapBy[k] = (st.trapBy[k] ?? 0) + 1;
          }
          if (plans[e.team].ballAction?.kind === 'spacePass') st.spaceOffside++;
          if (plans[e.team].ballAction?.kind === 'spacePass') st.outcomes.offside = (st.outcomes.offside ?? 0) + 1;
        } else if (e.type === 'pass' && e.space) {
          st.outcomes[e.outcome] = (st.outcomes[e.outcome] ?? 0) + 1;
        }
        if (e.type === 'pass' && e.space && e.outcome === 'complete' && e.receiverId) {
          st.spaceComplete++;
          received.set(e.receiverId, [...(received.get(e.receiverId) ?? []), state.turn]);
        } else if (e.type === 'trap') {
          st.trapDecl++;
          if (e.team === 'blue') st.trapDeclBlue++;
          else st.trapDeclRed++;
        } else if (e.type === 'goal') {
          st.goals++;
          st.goalsHalf[state.turn <= halfTurns(state) ? 0 : 1]++;
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
const rest = process.argv.slice(4);
const named = (k: string, def: string): string => rest.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? def;
const modeArg = rest.find((a) => a === 'early' || a === 'legacy' || a === 'both') ?? 'early';
const modes: ThroughPassMode[] = modeArg === 'both' ? ['legacy', 'early'] : [modeArg];
const flag = (k: string, def: string): boolean[] => {
  const v = named(k, def);
  return v === 'both' ? [true, false] : [v !== 'off'];
};
const variants: Variant[] = [];
for (const mode of modes) for (const trap of flag('trap', 'both')) for (const halves of flag('halves', 'on')) variants.push({ mode, trap, halves });
const results = variants.map((v) => run(v, games, seed));

const f = (x: number, d = 2) => x.toFixed(d);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const rows: [string, (s: Stats) => string][] = [
  ['得点 / 試合', (s) => f(s.goals / s.games)],
  ['  前半 / 後半', (s) => `${f(s.goalsHalf[0] / s.games)} / ${f(s.goalsHalf[1] / s.games)}`],
  ['オフサイド / 試合', (s) => f(s.offsides / s.games)],
  ['  うちトラップ / その他', (s) => `${f(s.trapHits / s.games)} / ${f((s.offsides - s.trapHits) / s.games)}`],
  ['トラップ宣言 / 試合 (合計)', (s) => f(s.trapDecl / s.games)],
  ['  青 / 赤', (s) => `${f(s.trapDeclBlue / s.games)} / ${f(s.trapDeclRed / s.games)}`],
  ['  的中率 (byTrap / 宣言)', (s) => (s.trapDecl ? pct(s.trapHits / s.trapDecl) : '-')],
  ['  byTrap内訳 (足元/スルー/クロス)', (s) => `${s.trapBy.pass ?? 0} / ${s.trapBy.spacePass ?? 0} / ${s.trapBy.cross ?? 0}`],
  ['足元パス成功率 全ターン', (s) => pct(s.foot[0] ? s.foot[1] / s.foot[0] : 0)],
  ['  宣言ターン', (s) => (s.footT[0] ? `${pct(s.footT[1] / s.footT[0])} (n=${s.footT[0]})` : '-')],
  ['スルーパス成功率 全ターン', (s) => pct(s.thr[0] ? s.thr[1] / s.thr[0] : 0)],
  ['  宣言ターン', (s) => (s.thrT[0] ? `${pct(s.thrT[1] / s.thrT[0])} (n=${s.thrT[0]})` : '-')],
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
const head = (v: Variant) => `${v.mode}${v.trap ? ' trap' : ' -'}${v.halves ? ' halves' : ' -'}`;
console.log(`games=${games} seed=${seed}`);
console.log(`${pad('', 30)}${variants.map((v) => pad(head(v), 22)).join('')}`);
for (const [label, fn] of rows) console.log(`${pad(label, 30)}${results.map((r) => pad(fn(r), 22)).join('')}`);
if (process.env.SIM_BRIEF) {
  results.forEach((b, i) =>
    console.log(
      `BRIEF ${head(variants[i] as Variant)} goals=${f(b.goals / b.games)} off=${f(b.offsides / b.games)} decl=${f(b.trapDecl / b.games)} hit=${pct(b.trapDecl ? b.trapHits / b.trapDecl : 0)} att=${f(b.spaceAttempts / b.games)} succ=${pct(b.spaceComplete / Math.max(1, b.spaceAttempts))} W/L/D=${b.blueWins}/${b.redWins}/${b.draws}`,
    ),
  );
}
