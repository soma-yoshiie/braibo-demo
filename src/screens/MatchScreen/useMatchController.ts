import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { planAiTurn } from '../../game/ai/simpleAi';
import { getCharacter } from '../../game/data/characters';
import { ballHolder, createMatch } from '../../game/engine/match';
import { describeEvent } from '../../game/engine/log';
import { createRng, randomSeed } from '../../game/engine/rng';
import { resolveTurn } from '../../game/engine/resolve';
import { availableMoveTargets } from '../../game/rules/moves';
import {
  estimateCross,
  estimatePass,
  estimateShot,
  estimateSpacePass,
  isCrossValid,
} from '../../game/rules/estimates';
import { dist } from '../../game/rules/geometry';
import { passMaxDistance } from '../../game/rules/probability';
import { BOARD, MATCH, goalTarget } from '../../game/rules/config';
import type {
  BallActionPlan,
  MatchState,
  PlayerId,
  Rng,
  TeamId,
  TeamPlan,
  TurnEvent,
  Vec,
} from '../../game/types';
import type { InfoView } from '../../components/Controls/InfoSheet';
import type { BannerView } from '../../components/Overlays/EventBanner';
import type {
  ArrowView,
  BallView,
  BurstView,
  LogLine,
  PassTargetView,
  PlanView,
  RadialMenuView,
  SpaceCellView,
  TokenView,
  TrajectoryView,
} from '../../components/viewTypes';

export type Phase = 'start' | 'planning' | 'resolving' | 'finished';
type PickMode = 'pass' | 'cross' | null;
export interface HintView {
  text?: string;
  sub?: string;
  warn?: boolean;
}
type BallDisp = { kind: 'held'; id: PlayerId } | { kind: 'free'; pos: Vec; snap: boolean };

const USE_AI = true;
const MOVE_MS = 600;
const FLIGHT_MS = 500;
const BANNER_MS = 900;
const GOAL_MS = 1400;
const CLASH_MS = 380;
const DUEL_RESULT_MS = 900;
const KNOCKBACK_MS = 450;

const prefersReducedMotion = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

interface TokenFx {
  clash?: boolean;
  tag?: { kind: 'win' | 'lose'; label: string };
  moveMs?: number;
  ease?: 'back';
}
export const TIMER_SECONDS = MATCH.planningSeconds > 0 ? MATCH.planningSeconds : 60;

const posMap = (s: MatchState): Record<PlayerId, Vec> =>
  Object.fromEntries(s.players.map((p) => [p.id, { ...p.pos }]));
const ballDispOf = (s: MatchState): BallDisp =>
  s.ball.kind === 'held' ? { kind: 'held', id: s.ball.playerId } : { kind: 'free', pos: { ...s.ball.pos }, snap: true };
const sameVec = (a: Vec, b: Vec) => a.x === b.x && a.y === b.y;
const teamOf = (id: PlayerId): TeamId => (id.startsWith('blue') ? 'blue' : 'red');
const pct = (v: number) => `${Math.round(v * 100)}%`;
const defaultSelection = (s: MatchState): PlayerId => {
  const h = ballHolder(s);
  return h && h.team === 'blue' ? h.id : 'blue-0';
};

interface Match {
  state: MatchState;
  rng: Rng;
}
function newMatch(): Match {
  return { state: createMatch(), rng: createRng(randomSeed()) };
}

export function useMatchController() {
  const matchRef = useRef<Match | null>(null);
  if (matchRef.current === null) matchRef.current = newMatch();

  const [state, setState] = useState<MatchState>(() => (matchRef.current as Match).state);
  const [phase, setPhase] = useState<Phase>('start');
  const [disp, setDisp] = useState<Record<PlayerId, Vec>>(() => posMap(state));
  const [ballDisp, setBallDisp] = useState<BallDisp>(() => ballDispOf(state));
  const [plans, setPlans] = useState<Record<PlayerId, Vec>>({});
  const [ballAction, setBallAction] = useState<BallActionPlan>({ kind: 'keep' });
  const [selectedId, setSelectedId] = useState<PlayerId>(() => defaultSelection(state));
  const [inspectId, setInspectId] = useState<PlayerId | null>(null);
  const [pick, setPick] = useState<PickMode>(null);
  const [timerOn, setTimerOn] = useState(MATCH.planningSeconds > 0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [log, setLog] = useState<LogLine[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [banner, setBanner] = useState<BannerView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoId, setInfoId] = useState<PlayerId | null>(null);
  const [fx, setFx] = useState<Record<PlayerId, TokenFx>>({});
  const [bursts, setBursts] = useState<BurstView[]>([]);
  const [trajectory, setTrajectory] = useState<TrajectoryView | null>(null);
  const [goalFx, setGoalFx] = useState<number | null>(null);
  const [shownScore, setShownScore] = useState<Record<TeamId, number> | null>(null);
  const [ballExtra, setBallExtra] = useState<{ arc: number; flightKey: number; ms: number }>({
    arc: 0,
    flightKey: 0,
    ms: 0,
  });
  const [bump, setBump] = useState<{ team: TeamId; key: number } | null>(null);
  const [fatal, setFatal] = useState<Error | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);

  const runRef = useRef(0);
  const idRef = useRef(0);
  const nextId = () => ++idRef.current;

  useEffect(() => {
    return () => {
      runRef.current++;
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  if (fatal) throw fatal;

  const blues = useMemo(() => state.players.filter((p) => p.team === 'blue'), [state]);
  const posOf = useCallback(
    (id: PlayerId): Vec => plans[id] ?? (state.players.find((p) => p.id === id)?.pos as Vec),
    [plans, state],
  );
  const holder = ballHolder(state);
  const blueHolder = holder && holder.team === 'blue' ? holder : undefined;
  const planning = phase === 'planning';

  // ---------- derived planning data ----------
  const moveTargets: Vec[] = useMemo(() => {
    if ((!planning && phase !== 'start') || pick) return [];
    const { [selectedId]: _self, ...others } = plans;
    void _self;
    return availableMoveTargets(state, { team: 'blue', moves: others }, selectedId);
  }, [planning, phase, pick, state, plans, selectedId]);

  const holderPos = blueHolder ? posOf(blueHolder.id) : undefined;

  const passCandidates: PassTargetView[] = useMemo(() => {
    if (!blueHolder || !holderPos) return [];
    return blues
      .filter((p) => p.id !== blueHolder.id)
      .map((p) => {
        const e = estimatePass(state, blueHolder.id, p.id, holderPos, posOf(p.id));
        return { id: p.id, label: pct(e.pComplete), enabled: e.inRange };
      });
  }, [blueHolder, holderPos, blues, state, posOf]);

  const crossCandidates: PassTargetView[] = useMemo(() => {
    if (!blueHolder || !holderPos) return [];
    return blues
      .filter((p) => p.id !== blueHolder.id && isCrossValid('blue', holderPos, posOf(p.id)))
      .map((p) => {
        const e = estimateCross(state, blueHolder.id, p.id, holderPos, posOf(p.id));
        return { id: p.id, label: pct(e.pGoal), enabled: true };
      });
  }, [blueHolder, holderPos, blues, state, posOf]);

  const spaceAll: SpaceCellView[] = useMemo(() => {
    if (!blueHolder || !holderPos) return [];
    const range = passMaxDistance(getCharacter(blueHolder.charId).skills);
    const blueCells = new Set(blues.map((p) => `${posOf(p.id).x},${posOf(p.id).y}`));
    const redCells = new Set(state.players.filter((p) => p.team === 'red').map((p) => `${p.pos.x},${p.pos.y}`));
    const out: SpaceCellView[] = [];
    for (let y = 0; y < BOARD.rows; y++) {
      for (let x = 0; x < BOARD.cols; x++) {
        const c = { x, y };
        if (sameVec(c, holderPos) || blueCells.has(`${x},${y}`)) continue;
        if (dist(holderPos, c) > range) continue;
        out.push({ x, y, enemy: redCells.has(`${x},${y}`) });
      }
    }
    return out;
  }, [blueHolder, holderPos, blues, state, posOf]);

  const canPass = passCandidates.some((c) => c.enabled) || spaceAll.length > 0;
  const canCross = crossCandidates.length > 0;

  // action actually used (invalid targets fall back to keep)
  const effectiveAction: BallActionPlan = useMemo(() => {
    if (!blueHolder) return { kind: 'keep' };
    if (ballAction.kind === 'pass') {
      return passCandidates.some((c) => c.id === ballAction.targetId && c.enabled) ? ballAction : { kind: 'keep' };
    }
    if (ballAction.kind === 'spacePass') {
      const t = ballAction.target;
      return spaceAll.some((c) => c.x === t.x && c.y === t.y) ? ballAction : { kind: 'keep' };
    }
    if (ballAction.kind === 'cross') {
      return crossCandidates.some((c) => c.id === ballAction.targetId) ? ballAction : { kind: 'keep' };
    }
    return ballAction;
  }, [ballAction, blueHolder, passCandidates, crossCandidates, spaceAll]);

  const shootPct = useMemo(() => {
    if (!blueHolder || !holderPos) return 0;
    return estimateShot(state, blueHolder.id, holderPos).pGoal;
  }, [blueHolder, holderPos, state]);

  useEffect(() => {
    if (ballAction.kind !== 'keep' && effectiveAction.kind === 'keep' && ballAction.kind !== 'shoot') {
      setBallAction({ kind: 'keep' });
    }
  }, [ballAction, effectiveAction]);

  const spaceLabel = useMemo(() => {
    if (!blueHolder || !holderPos || effectiveAction.kind !== 'spacePass') return undefined;
    return pct(estimateSpacePass(state, blueHolder.id, effectiveAction.target, holderPos).pComplete);
  }, [blueHolder, holderPos, effectiveAction, state]);

  const ballArrow: ArrowView | null = useMemo(() => {
    if (!planning || !blueHolder || !holderPos) return null;
    const a = effectiveAction;
    if (a.kind === 'shoot') {
      return { from: holderPos, to: goalTarget('blue'), style: 'shoot', label: pct(shootPct) };
    }
    if (a.kind === 'pass') {
      const c = passCandidates.find((x) => x.id === a.targetId);
      return { from: holderPos, to: posOf(a.targetId), style: 'pass', label: c?.label };
    }
    if (a.kind === 'spacePass') {
      return { from: holderPos, to: a.target, style: 'pass', label: spaceLabel };
    }
    if (a.kind === 'cross') {
      const c = crossCandidates.find((x) => x.id === a.targetId);
      return { from: holderPos, to: posOf(a.targetId), style: 'cross', label: c?.label };
    }
    return null;
  }, [planning, blueHolder, holderPos, effectiveAction, shootPct, passCandidates, crossCandidates, posOf, spaceLabel]);

  // ---------- actions ----------
  const resetPlanning = useCallback((s: MatchState) => {
    setPlans({});
    setBallAction({ kind: 'keep' });
    setPick(null);
    setInspectId(null);
    setInfoId(null);
    setMenuOpen(false);
    setSelectedId(defaultSelection(s));
  }, []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 1500);
  }, []);

  const setDest = useCallback(
    (id: PlayerId, to: Vec) => {
      const { [id]: _own, ...others } = plans;
      void _own;
      const self = state.players.find((p) => p.id === id);
      if (!self) return;
      const allowed = availableMoveTargets(state, { team: 'blue', moves: others }, id).some((t) => sameVec(t, to));
      const stayOk =
        sameVec(to, self.pos) && !Object.values(others).some((d) => sameVec(d, self.pos));
      if (!allowed && !stayOk) {
        if (sameVec(to, self.pos)) showNotice('そのマスは味方が予約済みです');
        return;
      }
      const next = { ...plans, [id]: to };
      setPlans(next);
      setInspectId(null);
      setInfoId(null);
      setMenuOpen(false);
      const order = blues.map((p) => p.id);
      const start = order.indexOf(id);
      for (let i = 1; i < order.length; i++) {
        const cand = order[(start + i) % order.length];
        if (!(cand in next)) {
          setSelectedId(cand);
          return;
        }
      }
    },
    [plans, blues, state, showNotice],
  );

  const selectBlue = useCallback((id: PlayerId) => {
    setSelectedId(id);
    setInspectId(null);
    setInfoId(null);
    setPick(null);
    setMenuOpen(true);
  }, []);

  const spaceHas = useCallback((c: Vec) => spaceAll.some((s2) => sameVec(s2, c)), [spaceAll]);

  const onPlayerTap = useCallback(
    (id: PlayerId) => {
      if (!planning) return;
      const p = state.players.find((x) => x.id === id);
      if (!p) return;
      if (pick) {
        if (p.team === 'blue') {
          const list = pick === 'pass' ? passCandidates : crossCandidates;
          if (list.some((c) => c.id === id && c.enabled)) setBallAction({ kind: pick, targetId: id });
        } else if (pick === 'pass' && spaceHas(p.pos)) {
          setBallAction({ kind: 'spacePass', target: { ...p.pos } });
        }
        setPick(null);
        return;
      }
      if (p.team === 'red') {
        setMenuOpen(false);
        if (moveTargets.some((t) => sameVec(t, p.pos))) setDest(selectedId, { ...p.pos });
        else {
          setInspectId(id);
          setInfoId(id);
        }
        return;
      }
      if (id === selectedId) {
        setInfoId(null);
        setMenuOpen((m) => !m);
        return;
      }
      if (moveTargets.some((t) => sameVec(t, p.pos))) {
        setDest(selectedId, { ...p.pos });
        return;
      }
      selectBlue(id);
    },
    [planning, pick, passCandidates, crossCandidates, state, moveTargets, selectedId, setDest, selectBlue, spaceHas],
  );

  const onGhostTap = useCallback(
    (id: PlayerId) => {
      if (!planning) return;
      if (pick) {
        onPlayerTap(id);
        return;
      }
      if (id === selectedId) {
        setInfoId(null);
        setMenuOpen((m) => !m);
      } else selectBlue(id);
    },
    [planning, pick, selectedId, selectBlue, onPlayerTap],
  );

  const onCellTap = useCallback(
    (cell: Vec) => {
      if (!planning) return;
      if (pick) {
        if (pick === 'pass' && spaceHas(cell)) setBallAction({ kind: 'spacePass', target: { ...cell } });
        setPick(null);
        return;
      }
      if (moveTargets.some((t) => sameVec(t, cell))) setDest(selectedId, cell);
      else setMenuOpen(false);
    },
    [planning, pick, moveTargets, selectedId, setDest, spaceHas],
  );

  const closeInfo = useCallback(() => {
    setInfoId(null);
    setInspectId(null);
  }, []);
  const onReset = useCallback(() => resetPlanning(state), [resetPlanning, state]);

  // ---------- turn execution ----------
  const execute = useCallback(async () => {
    const match = matchRef.current as Match;
    if (busyRef.current || phase !== 'planning') return;
    busyRef.current = true;
    const myRun = ++runRef.current;
    const alive = () => runRef.current === myRun;
    const reduced = prefersReducedMotion();
    const T = (ms: number) => (reduced ? Math.round(ms / 2) : ms);
    const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
    try {
      setPhase('resolving');
      setPick(null);
      setInspectId(null);
      setInfoId(null);
      setMenuOpen(false);
      setLogOpen(false);

      const cur = match.state;
      const moves: TeamPlan['moves'] = {};
      for (const p of cur.players) {
        if (p.team !== 'blue') continue;
        const to = plans[p.id];
        if (to && !sameVec(to, p.pos)) moves[p.id] = to;
      }
      const bluePlan: TeamPlan = { team: 'blue', moves, ballAction: blueHolder ? effectiveAction : undefined };
      const redPlan: TeamPlan = USE_AI
        ? planAiTurn(cur, 'red', match.rng)
        : { team: 'red', moves: {}, ballAction: { kind: 'keep' } };
      const result = resolveTurn(cur, { blue: bluePlan, red: redPlan }, match.rng);
      const mid = posMap(result.afterAction);

      // log
      const lines: LogLine[] = [];
      for (const ev of result.events) {
        if (ev.type === 'move') continue;
        const text = describeEvent(ev, result.before);
        if (text) lines.push({ id: nextId(), turn: cur.turn, text });
      }
      if (lines.length === 0) lines.push({ id: nextId(), turn: cur.turn, text: '大きな動きなし' });

      // clash positions: where players meet before the loser is knocked back
      const clash: Record<PlayerId, Vec> = { ...mid };
      for (const ev of result.events) {
        if (ev.type === 'bounce' && ev.reason === 'duel') clash[ev.playerId] = { ...ev.from };
        else if (ev.type === 'displace') clash[ev.playerId] = { ...ev.from };
      }
      type DuelEv = Extract<TurnEvent, { type: 'duel' }>;
      const duelsOf = (kind: 'ground' | 'aerial') =>
        result.events.filter((e): e is DuelEv => e.type === 'duel' && e.kind === kind);
      const groundDuels = duelsOf('ground');
      const loserOf = (d: DuelEv) => (d.winnerId === d.aId ? d.bId : d.aId);

      /** Show impact + clash scale for the given duels; returns after the burst. */
      const showClash = async (duels: DuelEv[]) => {
        setBursts(
          duels.map((d) => ({ id: `b-${nextId()}`, x: d.pos.x, y: d.pos.y, team: teamOf(d.winnerId) })),
        );
        const f: Record<PlayerId, TokenFx> = {};
        for (const d of duels) {
          f[d.aId] = { clash: true };
          f[d.bId] = { clash: true };
        }
        setFx(f);
        await wait(T(CLASH_MS));
      };
      const tagResult = (duels: DuelEv[], aerial: boolean, knock: boolean): Record<PlayerId, TokenFx> => {
        const f: Record<PlayerId, TokenFx> = {};
        for (const d of duels) {
          f[d.winnerId] = { tag: { kind: 'win', label: aerial ? '空中戦 WIN' : 'WIN' } };
          f[loserOf(d)] = {
            tag: { kind: 'lose', label: aerial ? '空中戦 LOSE' : 'LOSE' },
            ...(knock ? { moveMs: T(KNOCKBACK_MS), ease: 'back' as const } : {}),
          };
        }
        return f;
      };

      // clear plan markers, then (a) movement to the clash positions
      setPlans({});
      setBallAction({ kind: 'keep' });
      setDisp(groundDuels.length > 0 ? clash : mid);
      await wait(T(MOVE_MS) + 80);
      if (!alive()) return;

      // (a2) ground duels: impact -> WIN / LOSE tags -> loser knocked back
      if (groundDuels.length > 0) {
        await showClash(groundDuels);
        if (!alive()) return;
        setFx(tagResult(groundDuels, false, true));
        setDisp(mid);
        const ballDuel = groundDuels.find((d) => d.forBall);
        if (ballDuel) setBallDisp({ kind: 'held', id: ballDuel.winnerId });
        await wait(T(DUEL_RESULT_MS));
        if (!alive()) return;
        setFx({});
        setBursts([]);
      }

      // (b) ball events
      const flights = result.events.filter(
        (e): e is Extract<TurnEvent, { type: 'pass' | 'cross' | 'shot' }> =>
          e.type === 'pass' || e.type === 'cross' || e.type === 'shot',
      );
      const firstFlight = flights[0];
      if (firstFlight) {
        const owner = firstFlight.type === 'shot' ? firstFlight.shooterId : firstFlight.passerId;
        setBallDisp({ kind: 'held', id: owner });
      } else {
        setBallDisp(ballDispOf(result.afterAction));
      }
      const scoreAfter = result.afterAction.score;
      const aerialDuels = duelsOf('aerial');
      for (let i = 0; i < flights.length; i++) {
        const ev = flights[i];
        let dest: Vec;
        let text: string;
        let big = false;
        let sub: string | undefined;
        let winner: TeamId | undefined;
        let goal = false;
        const actor = teamOf(ev.type === 'shot' ? ev.shooterId : ev.passerId);
        if (ev.type === 'pass') {
          dest =
            ev.outcome === 'intercepted' && ev.interceptorId
              ? mid[ev.interceptorId] ?? ev.to
              : ev.outcome === 'failed' || ev.outcome === 'loose'
                ? ev.loosePos ?? ev.to
                : ev.to;
          if (ev.outcome === 'intercepted' && ev.interceptorId) winner = teamOf(ev.interceptorId);
          if (ev.outcome === 'toEnemy') winner = ev.receiverId ? teamOf(ev.receiverId) : actor === 'blue' ? 'red' : 'blue';
          text =
            ev.outcome === 'complete'
              ? 'パス成功'
              : ev.outcome === 'intercepted'
                ? 'インターセプト！'
                : ev.outcome === 'toEnemy'
                  ? '相手ボール'
                  : ev.outcome === 'loose'
                    ? 'スルーパス'
                    : 'パス失敗';
        } else if (ev.type === 'cross') {
          dest = ev.outcome === 'failed' ? ev.loosePos ?? ev.to : ev.to;
          if (ev.outcome === 'lost' && ev.defenderId) winner = teamOf(ev.defenderId);
          const nextIsShot = flights[i + 1]?.type === 'shot';
          text =
            ev.outcome === 'failed'
              ? 'クロス失敗'
              : ev.outcome === 'lost'
                ? '空中戦敗北'
                : nextIsShot
                  ? 'クロス→ヘディング！'
                  : ev.outcome === 'won'
                    ? '空中戦勝利'
                    : 'クロス成功';
        } else {
          const tgt = ev.target;
          dest =
            ev.outcome === 'blocked' && ev.blockerId
              ? mid[ev.blockerId] ?? tgt
              : ev.outcome === 'missed'
                ? { x: tgt.x + 0.9, y: tgt.y + (tgt.y < 0 ? -0.5 : 0.5) }
                : tgt;
          if (ev.outcome === 'blocked' && ev.blockerId) winner = teamOf(ev.blockerId);
          if (ev.outcome === 'goal') {
            text = 'GOAL!!';
            big = true;
            goal = true;
            sub = `青 ${scoreAfter.blue} - ${scoreAfter.red} 赤`;
          } else text = ev.outcome === 'blocked' ? 'ブロック！' : 'シュート失敗';
        }
        // flight
        const isCross = ev.type === 'cross';
        const flightMs = T(FLIGHT_MS);
        setBallDisp({ kind: 'free', pos: { ...ev.from }, snap: true });
        await wait(60);
        if (!alive()) return;
        if (isCross) {
          const d = dist(ev.from, dest);
          const arc = Math.max(0.8, Math.min(2.2, d * 0.35));
          setTrajectory({ from: { ...ev.from }, to: dest, arc });
          setBallDisp({ kind: 'free', pos: dest, snap: false });
          setBallExtra({ arc, flightKey: nextId(), ms: flightMs });
        } else {
          setBallExtra({ arc: 0, flightKey: nextId(), ms: flightMs });
          setBallDisp({ kind: 'free', pos: dest, snap: false });
        }
        await wait(flightMs + 40);
        if (!alive()) return;
        // aerial duel on a delivered cross
        let aerialShown = false;
        if (isCross && ev.outcome !== 'failed' && aerialDuels.length > 0) {
          await showClash(aerialDuels);
          if (!alive()) return;
          setFx(tagResult(aerialDuels, true, false));
          aerialShown = true;
        }
        setBanner({ id: nextId(), text, sub, big, team: winner ?? actor });
        if (goal) {
          setGoalFx(nextId());
          setShownScore({ ...scoreAfter });
          setBump({ team: actor, key: nextId() });
        }
        await wait(T(big ? GOAL_MS : BANNER_MS));
        if (!alive()) return;
        setBanner(null);
        setGoalFx(null);
        setTrajectory(null);
        if (aerialShown) {
          setFx({});
          setBursts([]);
        }
        if (i + 1 < flights.length) {
          // next flight starts from the receiver / header position
          setBallExtra({ arc: 0, flightKey: 0, ms: 0 });
          setBallDisp({ kind: 'free', pos: dest, snap: true });
        }
      }

      // (c) commit
      const after = result.after;
      setLog((l) => [...l, ...lines]);
      matchRef.current = { ...match, state: after };
      setState(after);
      setShownScore(null);
      setBallExtra({ arc: 0, flightKey: 0, ms: 0 });
      setBallDisp(ballDispOf(after));
      setDisp(posMap(after));
      const reset = result.afterAction !== after && result.events.some((e) => e.type === 'goal');
      if (reset) {
        await wait(T(MOVE_MS) + 150);
        if (!alive()) return;
      }
      busyRef.current = false;
      if (after.phase === 'finished') {
        setPhase('finished');
      } else {
        resetPlanning(after);
        setTimeLeft(TIMER_SECONDS);
        setPhase('planning');
      }
    } catch (e) {
      busyRef.current = false;
      if (alive()) setFatal(e instanceof Error ? e : new Error(String(e)));
    }
  }, [phase, plans, blueHolder, effectiveAction, resetPlanning]);

  const executeRef = useRef(execute);
  executeRef.current = execute;

  // ---------- timer ----------
  useEffect(() => {
    if (phase !== 'planning' || !timerOn) return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase, timerOn]);
  useEffect(() => {
    if (phase === 'planning' && timerOn && timeLeft <= 0) void executeRef.current();
  }, [phase, timerOn, timeLeft]);

  // ---------- lifecycle ----------
  const start = useCallback(() => {
    setTimeLeft(TIMER_SECONDS);
    setPhase('planning');
  }, []);

  const restart = useCallback(() => {
    if (busyRef.current) return;
    runRef.current++;
    const m = newMatch();
    matchRef.current = m;
    setState(m.state);
    setDisp(posMap(m.state));
    setBallDisp(ballDispOf(m.state));
    setLog([]);
    setBanner(null);
    setFx({});
    setBursts([]);
    setTrajectory(null);
    setGoalFx(null);
    setShownScore(null);
    setBallExtra({ arc: 0, flightKey: 0, ms: 0 });
    setLogOpen(false);
    resetPlanning(m.state);
    setTimeLeft(TIMER_SECONDS);
    setPhase('start');
  }, [resetPlanning]);

  // ---------- view models ----------
  const reducedNow = prefersReducedMotion();
  const tokens: TokenView[] = state.players.map((p) => {
    const d = disp[p.id] ?? p.pos;
    const f = fx[p.id];
    return {
      id: p.id,
      team: p.team,
      abbr: getCharacter(p.charId).abbr,
      x: d.x,
      y: d.y,
      hasBall: ballDisp.kind === 'held' && ballDisp.id === p.id,
      planned: planning && p.team === 'blue' && p.id in plans,
      clash: f?.clash,
      tag: f?.tag,
      moveMs: f?.moveMs ?? (reducedNow ? MOVE_MS / 2 : undefined),
      ease: f?.ease,
    };
  });
  const ball: BallView =
    ballDisp.kind === 'held'
      ? { kind: 'held' }
      : {
          kind: 'free',
          x: ballDisp.pos.x,
          y: ballDisp.pos.y,
          snap: ballDisp.snap,
          arc: ballExtra.arc,
          flightKey: ballExtra.flightKey,
          ms: ballExtra.ms || undefined,
        };

  const planViews: PlanView[] = planning
    ? blues
        .filter((p) => p.id in plans)
        .map((p) => ({
          id: p.id,
          abbr: getCharacter(p.charId).abbr,
          from: p.pos,
          to: plans[p.id],
          stay: sameVec(plans[p.id], p.pos),
        }))
    : [];

  const passTargets: PassTargetView[] = planning && pick ? (pick === 'pass' ? passCandidates : crossCandidates) : [];
  const spaceCells: SpaceCellView[] = planning && pick === 'pass' ? spaceAll : [];

  const infoPlayer = infoId ? state.players.find((p) => p.id === infoId) : undefined;
  const info: InfoView | null = infoPlayer
    ? (() => {
        const c = getCharacter(infoPlayer.charId);
        return {
          team: infoPlayer.team,
          name: c.name,
          abbr: c.abbr,
          description: c.description,
          stats: c.stats,
          role: c.role,
        };
      })()
    : null;

  // radial menu (planning only, closed while picking a target)
  const selectedPlayer = state.players.find((p) => p.id === selectedId);
  const radial: RadialMenuView | null = (() => {
    if (!planning || !menuOpen || pick || !selectedPlayer || selectedPlayer.team !== 'blue') return null;
    const isHolder = !!blueHolder && blueHolder.id === selectedId;
    const act = effectiveAction.kind;
    const items: RadialMenuView['items'] = [];
    const close = () => setMenuOpen(false);
    if (isHolder) {
      items.push({
        key: 'shoot',
        label: 'シュート',
        sub: pct(shootPct),
        enabled: true,
        active: act === 'shoot',
        onTap: () => {
          setBallAction({ kind: 'shoot' });
          setPick(null);
          close();
        },
      });
      items.push({
        key: 'pass',
        label: 'パス',
        enabled: canPass,
        active: act === 'pass' || act === 'spacePass',
        onTap: () => {
          setPick('pass');
          close();
        },
      });
      items.push({
        key: 'cross',
        label: 'クロス',
        sub: canCross ? undefined : '条件外',
        enabled: canCross,
        active: act === 'cross',
        onTap: () => {
          setPick('cross');
          close();
        },
      });
      items.push({
        key: 'keep',
        label: 'キープ',
        enabled: true,
        active: act === 'keep',
        onTap: () => {
          setBallAction({ kind: 'keep' });
          setPick(null);
          close();
        },
      });
    }
    items.push({
      key: 'stay',
      label: '待機',
      enabled: true,
      onTap: () => {
        close();
        setDest(selectedId, { ...selectedPlayer.pos });
      },
    });
    items.push({
      key: 'info',
      label: '情報',
      enabled: true,
      onTap: () => {
        close();
        setInfoId(selectedId);
      },
    });
    return { x: selectedPlayer.pos.x, y: selectedPlayer.pos.y, items };
  })();

  const hint: HintView | null = notice
    ? { text: notice, warn: true }
    : planning && pick === 'pass'
      ? { text: 'パス先（味方 or スペース）をタップ', sub: '※相手の現在位置での推定値' }
      : planning && pick === 'cross'
        ? { text: 'クロス先をタップ（％=得点率）', sub: '※相手の現在位置での推定値' }
        : planning && blueHolder && effectiveAction.kind === 'shoot'
          ? { sub: '※相手の現在位置での推定値' }
          : null;

  const possession: TeamId | 'loose' = holder ? holder.team : 'loose';

  return {
    phase,
    state,
    score: shownScore ?? state.score,
    bump,
    timerOn,
    setTimerOn,
    secondsLeft: timerOn && phase !== 'start' ? Math.max(0, timeLeft) : timerOn ? TIMER_SECONDS : null,
    log,
    logOpen,
    setLogOpen,
    banner,
    goalFx,
    tokens,
    ball,
    trajectory,
    selectedId,
    inspectId,
    hint,
    moveTargets,
    passTargets,
    spaceCells,
    picking: planning && pick !== null,
    planViews,
    ballArrow,
    bursts,
    radial,
    info,
    closeInfo,
    plannedCount: blues.filter((p) => p.id in plans).length,
    totalPlayers: blues.length,
    possession,
    interactive: planning,
    onCellTap,
    onPlayerTap,
    onGhostTap,
    onReset,
    execute: () => void execute(),
    start,
    restart,
    boardCols: BOARD.cols,
  };
}
