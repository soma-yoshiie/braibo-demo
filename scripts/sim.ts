/**
 * AI-vs-AI simulation:
 * `npm run sim -- [games=200] [seed=1] [early|legacy|both] [trap=on|off|both] [halves=on|off|both] [keeper=on|off|both]
 *                [blue=id,id,id,id,id] [red=...] [bluegk=id] [redgk=id]`.
 * Columns = space-pass mode x trap x halves x keeper. Defaults: early, trap=both, halves=on, keeper=on, i.e. "trap on vs trap off".
 * Teams: the roster starting six (蒼嵐, STARTER_LINEUP) against 紅蓮 (RIVAL_LINEUP). `blue=` / `red=` take the five field ids,
 * `bluegk=` / `redgk=` the keeper. `formation=legacy` ignores the lineups (the v0.8 five-a-side formation, no keeper). keeper=off removes both keepers (the lineups' field players are kept).
 * `legacy` / `early` / `both` keep their old meaning (which space-pass rule); `both` prints one column per rule.
 */
import type { ThroughPassMode, TurnEvent } from '../src/game/types';
import { createMatch } from '../src/game/engine/match';
import { RULES, halfTurns } from '../src/game/rules/config';
import { FORMATION } from '../src/game/data/formations';
import { CHARACTERS } from '../src/game/data/characters';
import { RIVAL_LINEUP, STARTER_LINEUP } from '../src/game/data/roster';
import type { TeamLineup } from '../src/game/types';
import { createRng } from '../src/game/engine/rng';
import { resolveTurn } from '../src/game/engine/resolve';
import { AI_WEIGHTS, planAiTurn } from '../src/game/ai/simpleAi';
import { ballHolder } from '../src/game/engine/match';

// Tuning aid: `AIW_tpBonus=0.2 npm run sim -- 100 1 early` overrides AI_WEIGHTS.tpBonus for this run only.
for (const [k, v] of Object.entries(process.env)) {
  if (k.startsWith('AIW_') && v !== undefined) (AI_WEIGHTS as unknown as Record<string, number>)[k.slice(4)] = Number(v);
}

// `RULE_shot.falloffPerCell=0.09 npm run sim ...` overrides RULES.<group>.<key> for this run only (tuning aid).
for (const [k, v] of Object.entries(process.env)) {
  if (!k.startsWith('RULE_') || v === undefined) continue;
  const path = k.slice(5).split('.');
  const last = path.pop() as string;
  let node = RULES as unknown as Record<string, unknown>;
  for (const part of path) node = node[part] as Record<string, unknown>;
  node[last] = Number(v);
}

// `FORM_rows.FW=4 FORM_defendRows.DF=7 npm run sim ...` overrides FORMATION rows for this run only (tuning aid).
for (const [k, v] of Object.entries(process.env)) {
  if (!k.startsWith('FORM_') || v === undefined) continue;
  const [group, pos] = k.slice(5).split('.');
  if ((group === 'rows' || group === 'defendRows') && (pos === 'FW' || pos === 'MF' || pos === 'DF')) FORMATION[group][pos] = Number(v);
}

// `TYPE_playmaker.pass=75 npm run sim ...` overrides a type's base stat for this run only (tuning aid; roster players derive from it).
for (const [k, v] of Object.entries(process.env)) {
  if (!k.startsWith('TYPE_') || v === undefined) continue;
  const [type, stat] = k.slice(5).split('.');
  const def = CHARACTERS.find((c) => c.id === type);
  if (def && stat && stat in def.stats) (def.stats as unknown as Record<string, number>)[stat] = Number(v);
}

// `AIO_shootThreshold=0.15 npm run sim ...` passes AiOptions to both teams (tuning aid).
const AI_OPT: Record<string, number> = {};
for (const [k, v] of Object.entries(process.env)) if (k.startsWith('AIO_') && v !== undefined) AI_OPT[k.slice(4)] = Number(v);

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
  /** Per attacking team [blue, red]: shots, blocked, saved, goals, goals by header, passes tried, passes intercepted, turns holding the ball. */
  tm: Record<'shots' | 'blocked' | 'saved' | 'goals' | 'headers' | 'passes' | 'cut' | 'hold' | 'turns', [number, number]>;
  saves: number;
  shots: number;
  shotDist: number;
  shotsOnTarget: number;
  blueGoals: number;
  redGoals: number;
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

interface Variant { mode: ThroughPassMode; trap: boolean; halves: boolean; keeper: boolean }

function run(v: Variant, games: number, seed: number): Stats {
  const mode = v.mode;
  const rng = createRng(seed);
  const st: Stats = {
    games, goals: 0, offsides: 0, blueWins: 0, redWins: 0, draws: 0, spaceAttempts: 0, spaceComplete: 0,
    spaceOffside: 0, breakawayGoals: 0, crosses: 0, footPasses: 0, outcomes: {},
    tm: { shots: [0, 0], blocked: [0, 0], saved: [0, 0], goals: [0, 0], headers: [0, 0], passes: [0, 0], cut: [0, 0], hold: [0, 0], turns: [0, 0] }, saves: 0, shots: 0, shotDist: 0, shotsOnTarget: 0, blueGoals: 0, redGoals: 0, trapDecl: 0, trapDeclBlue: 0, trapDeclRed: 0, trapHits: 0, foot: [0, 0], footT: [0, 0], thr: [0, 0], thrT: [0, 0], trapBy: {}, goalsHalf: [0, 0],
  };
  for (let g = 0; g < games; g++) {
    const made = createMatch({ throughPass: mode, trap: v.trap, halves: v.halves, firstKickoff: g % 2 === 0 ? 'blue' : 'red', lineups: named('formation', 'lineup') === 'legacy' ? undefined : LINEUPS });
    let state = v.keeper ? made : (({ keepers: _k, ...rest }) => rest)(made);
    /** playerId -> turns at which they received a space pass (complete). */
    const received = new Map<string, number[]>();
    while (state.phase !== 'finished') {
      const holder = ballHolder(state);
      const plans = { blue: planAiTurn(state, 'blue', rng, AI_OPT), red: planAiTurn(state, 'red', rng, AI_OPT) };
      const r = resolveTurn(state, plans, rng);
      const events: TurnEvent[] = r.events;
      const action = holder ? plans[holder.team].ballAction : undefined;
      const cancelled = events.some((e) => e.type === 'actionCancelled');
      if (action && !cancelled) {
        if (action.kind === 'spacePass') st.spaceAttempts++;
        else if (action.kind === 'cross') st.crosses++;
        else if (action.kind === 'pass') st.footPasses++;
      }
      const ti = (id: string): 0 | 1 => (id.startsWith('blue') ? 0 : 1);
      if (holder) st.tm.hold[holder.team === 'blue' ? 0 : 1]++;
      for (const e of events) {
        if (e.type === 'shot') {
          const i = ti(e.shooterId);
          st.tm.shots[i]++;
          if (e.outcome === 'blocked') st.tm.blocked[i]++;
          if (e.outcome === 'saved') st.tm.saved[i]++;
          if (e.outcome === 'goal') {
            st.tm.goals[i]++;
            if (e.kind === 'header') st.tm.headers[i]++;
          }
        } else if (e.type === 'pass') {
          const i = ti(e.passerId);
          st.tm.passes[i]++;
          if (e.outcome === 'intercepted') st.tm.cut[i]++;
        }
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
        if (e.type === 'shot' && e.kind === 'shot') {
          st.shots++;
          st.shotDist += Math.hypot(e.from.x - e.target.x, e.from.y - e.target.y);
        }
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
        } else if (e.type === 'shot' && (e.outcome === 'saved' || e.outcome === 'goal')) {
          st.shotsOnTarget++;
          if (e.outcome === 'saved') st.saves++;
        } else if (e.type === 'goal') {
          st.goals++;
          if (e.team === 'blue') st.blueGoals++;
          else st.redGoals++;
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
const ids = (k: string): string[] | undefined => {
  const v = named(k, '');
  return v ? v.split(',') : undefined;
};
const LINEUPS: { blue: TeamLineup; red: TeamLineup } = {
  blue: { field: ids('blue') ?? STARTER_LINEUP.field, gk: named('bluegk', STARTER_LINEUP.gk) },
  red: { field: ids('red') ?? RIVAL_LINEUP.field, gk: named('redgk', RIVAL_LINEUP.gk) },
};
const modeArg = rest.find((a) => a === 'early' || a === 'legacy' || a === 'both') ?? 'early';
const modes: ThroughPassMode[] = modeArg === 'both' ? ['legacy', 'early'] : [modeArg];
const flag = (k: string, def: string): boolean[] => {
  const v = named(k, def);
  return v === 'both' ? [true, false] : [v !== 'off'];
};
const variants: Variant[] = [];
for (const mode of modes) for (const trap of flag('trap', 'both')) for (const halves of flag('halves', 'on')) for (const keeper of flag('keeper', 'on')) variants.push({ mode, trap, halves, keeper });
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
  ['シュート / 試合 (平均距離)', (s) => `${f(s.shots / s.games)} (${f(s.shotDist / Math.max(1, s.shots), 1)})`],
  ['セーブ / 試合', (s) => f(s.saves / s.games)],
  ['  セーブ率 (セーブ / 枠内)', (s) => pct(s.shotsOnTarget ? s.saves / s.shotsOnTarget : 0)],
  ['得点 青 / 赤', (s) => `${f(s.blueGoals / s.games)} / ${f(s.redGoals / s.games)}`],
  ['シュート 青 / 赤', (s) => `${f(s.tm.shots[0] / s.games)} / ${f(s.tm.shots[1] / s.games)}`],
  ['  ブロック 青の攻撃 / 赤の攻撃', (s) => `${f(s.tm.blocked[0] / s.games)} / ${f(s.tm.blocked[1] / s.games)}`],
  ['  セーブ 青の攻撃 / 赤の攻撃', (s) => `${f(s.tm.saved[0] / s.games)} / ${f(s.tm.saved[1] / s.games)}`],
  ['  ヘディング得点 青 / 赤', (s) => `${f(s.tm.headers[0] / s.games)} / ${f(s.tm.headers[1] / s.games)}`],
  ['パス試行 青 / 赤 (カットされた数)', (s) => `${f(s.tm.passes[0] / s.games)} (${f(s.tm.cut[0] / s.games)}) / ${f(s.tm.passes[1] / s.games)} (${f(s.tm.cut[1] / s.games)})`],
  ['ボール保持ターン 青 / 赤', (s) => `${f(s.tm.hold[0] / s.games)} / ${f(s.tm.hold[1] / s.games)}`],
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
const head = (v: Variant) => `${v.mode}${v.trap ? ' trap' : ' -'}${v.halves ? ' halves' : ' -'}${v.keeper ? ' gk' : ' nogk'}`;
console.log(`games=${games} seed=${seed}`);
console.log(`${pad('', 30)}${variants.map((v) => pad(head(v), 26)).join('')}`);
for (const [label, fn] of rows) console.log(`${pad(label, 30)}${results.map((r) => pad(fn(r), 26)).join('')}`);
if (process.env.SIM_BRIEF) {
  results.forEach((b, i) =>
    console.log(
      `BRIEF ${head(variants[i] as Variant)} goals=${f(b.goals / b.games)} off=${f(b.offsides / b.games)} decl=${f(b.trapDecl / b.games)} sv=${f(b.saves / b.games)}/${pct(b.shotsOnTarget ? b.saves / b.shotsOnTarget : 0)} GF/GA=${f(b.blueGoals / b.games)}/${f(b.redGoals / b.games)} hit=${pct(b.trapDecl ? b.trapHits / b.trapDecl : 0)} att=${f(b.spaceAttempts / b.games)} succ=${pct(b.spaceComplete / Math.max(1, b.spaceAttempts))} W/L/D=${b.blueWins}/${b.redWins}/${b.draws}`,
    ),
  );
}
