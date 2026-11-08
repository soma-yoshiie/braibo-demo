import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { planAiTurn } from '../../game/ai/simpleAi';
import { getCharacter } from '../../game/data/characters';
import { ballHolder, createMatch } from '../../game/engine/match';
import { describeEvent } from '../../game/engine/log';
import { createRng, randomSeed } from '../../game/engine/rng';
import { resolveTurn } from '../../game/engine/resolve';
import { availableMoveTargets } from '../../game/rules/moves';
import { estimateCross, estimatePass, estimateShot, isCrossValid } from '../../game/rules/estimates';
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
import type { ActionsView, ChipView, InfoView } from '../../components/Controls/CommandPanel';
import type { BannerView } from '../../components/Overlays/EventBanner';
import type {
  ArrowView,
  BadgeView,
  BallView,
  LogLine,
  PassTargetView,
  PlanView,
  TokenView,
} from '../../components/viewTypes';

export type Phase = 'start' | 'planning' | 'resolving' | 'finished';
type PickMode = 'pass' | 'cross' | null;
type BallDisp = { kind: 'held'; id: PlayerId } | { kind: 'free'; pos: Vec; snap: boolean };

const USE_AI = true;
const MOVE_MS = 600;
const FLIGHT_MS = 500;
const BANNER_MS = 900;
const GOAL_MS = 1400;
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
  const [badges, setBadges] = useState<BadgeView[]>([]);
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

  const canPass = passCandidates.some((c) => c.enabled);
  const canCross = crossCandidates.length > 0;

  // action actually used (invalid targets fall back to keep)
  const effectiveAction: BallActionPlan = useMemo(() => {
    if (!blueHolder) return { kind: 'keep' };
    if (ballAction.kind === 'pass') {
      return passCandidates.some((c) => c.id === ballAction.targetId && c.enabled) ? ballAction : { kind: 'keep' };
    }
    if (ballAction.kind === 'cross') {
      return crossCandidates.some((c) => c.id === ballAction.targetId) ? ballAction : { kind: 'keep' };
    }
    return ballAction;
  }, [ballAction, blueHolder, passCandidates, crossCandidates]);

  const shootPct = useMemo(() => {
    if (!blueHolder || !holderPos) return 0;
    return estimateShot(state, blueHolder.id, holderPos).pGoal;
  }, [blueHolder, holderPos, state]);

  useEffect(() => {
    if (ballAction.kind !== 'keep' && effectiveAction.kind === 'keep' && ballAction.kind !== 'shoot') {
      setBallAction({ kind: 'keep' });
    }
  }, [ballAction, effectiveAction]);

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
    if (a.kind === 'cross') {
      const c = crossCandidates.find((x) => x.id === a.targetId);
      return { from: holderPos, to: posOf(a.targetId), style: 'cross', label: c?.label };
    }
    return null;
  }, [planning, blueHolder, holderPos, effectiveAction, shootPct, passCandidates, crossCandidates, posOf]);

  // ---------- actions ----------
  const resetPlanning = useCallback((s: MatchState) => {
    setPlans({});
    setBallAction({ kind: 'keep' });
    setPick(null);
    setInspectId(null);
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
    setPick(null);
  }, []);

  const onPlayerTap = useCallback(
    (id: PlayerId) => {
      if (!planning) return;
      if (pick) {
        const list = pick === 'pass' ? passCandidates : crossCandidates;
        if (list.some((c) => c.id === id && c.enabled)) {
          setBallAction({ kind: pick, targetId: id });
        }
        setPick(null);
        return;
      }
      const p = state.players.find((x) => x.id === id);
      if (!p) return;
      if (p.team === 'red') {
        if (moveTargets.some((t) => sameVec(t, p.pos))) setDest(selectedId, { ...p.pos });
        else setInspectId(id);
        return;
      }
      if (id === selectedId) {
        setDest(id, { ...p.pos });
        return;
      }
      if (moveTargets.some((t) => sameVec(t, p.pos))) {
        setDest(selectedId, { ...p.pos });
        return;
      }
      selectBlue(id);
    },
    [planning, pick, passCandidates, crossCandidates, state, moveTargets, selectedId, setDest, selectBlue],
  );

  const onGhostTap = useCallback(
    (id: PlayerId) => {
      if (!planning) return;
      if (pick) {
        onPlayerTap(id);
        return;
      }
      if (id === selectedId) {
        const to = plans[id];
        if (to) setDest(id, to);
      } else selectBlue(id);
    },
    [planning, pick, selectedId, plans, setDest, selectBlue, onPlayerTap],
  );

  const onCellTap = useCallback(
    (cell: Vec) => {
      if (!planning) return;
      if (pick) {
        setPick(null);
        return;
      }
      if (moveTargets.some((t) => sameVec(t, cell))) setDest(selectedId, cell);
    },
    [planning, pick, moveTargets, selectedId, setDest],
  );

  const onChip = useCallback((id: PlayerId) => planning && selectBlue(id), [planning, selectBlue]);

  const onKeep = useCallback(() => {
    setBallAction({ kind: 'keep' });
    setPick(null);
  }, []);
  const onShoot = useCallback(() => {
    setBallAction({ kind: 'shoot' });
    setPick(null);
  }, []);
  const onPass = useCallback(() => setPick((m) => (m === 'pass' ? null : 'pass')), []);
  const onCross = useCallback(() => setPick((m) => (m === 'cross' ? null : 'cross')), []);
  const onReset = useCallback(() => resetPlanning(state), [resetPlanning, state]);

  // ---------- turn execution ----------
  const execute = useCallback(async () => {
    const match = matchRef.current as Match;
    if (busyRef.current || phase !== 'planning') return;
    busyRef.current = true;
    const myRun = ++runRef.current;
    const alive = () => runRef.current === myRun;
    const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
    try {
      setPhase('resolving');
      setPick(null);
      setInspectId(null);
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

      // clear plan markers, then (a) movement
      setPlans({});
      setBallAction({ kind: 'keep' });
      const duelBadges = (kind: 'ground' | 'aerial'): BadgeView[] =>
        result.events
          .filter((e): e is Extract<TurnEvent, { type: 'duel' }> => e.type === 'duel' && e.kind === kind)
          .map((e) => ({
            id: `d-${kind}-${e.pos.x}-${e.pos.y}-${nextId()}`,
            x: e.pos.x,
            y: e.pos.y,
            text: kind === 'ground' ? '競り合い！' : '空中戦！',
          }));
      setDisp(mid);
      setBadges(duelBadges('ground'));
      await wait(MOVE_MS + 80);
      if (!alive()) return;
      setBadges([]);

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
      let scored = false;
      for (let i = 0; i < flights.length; i++) {
        const ev = flights[i];
        let dest: Vec;
        let text: string;
        let big = false;
        let sub: string | undefined;
        let winner: TeamId | undefined;
        const actor = teamOf(ev.type === 'shot' ? ev.shooterId : ev.passerId);
        if (ev.type === 'pass') {
          dest =
            ev.outcome === 'intercepted' && ev.interceptorId
              ? mid[ev.interceptorId] ?? ev.to
              : ev.outcome === 'failed'
                ? ev.loosePos ?? ev.to
                : ev.to;
          if (ev.outcome === 'intercepted' && ev.interceptorId) winner = teamOf(ev.interceptorId);
          text = ev.outcome === 'complete' ? 'パス成功' : ev.outcome === 'intercepted' ? 'インターセプト！' : 'パス失敗';
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
            scored = true;
            sub = `青 ${scoreAfter.blue} - ${scoreAfter.red} 赤`;
          } else text = ev.outcome === 'blocked' ? 'ブロック！' : 'シュート失敗';
        }
        // flight
        setBallDisp({ kind: 'free', pos: { ...ev.from }, snap: true });
        await wait(60);
        if (!alive()) return;
        setBallDisp({ kind: 'free', pos: dest, snap: false });
        await wait(FLIGHT_MS + 40);
        if (!alive()) return;
        if (ev.type === 'cross' && ev.outcome !== 'failed') {
          setBadges(duelBadges('aerial'));
        }
        setBanner({ id: nextId(), text, sub, big, team: winner ?? actor });
        await wait(big ? GOAL_MS : BANNER_MS);
        if (!alive()) return;
        setBanner(null);
        setBadges([]);
        if (i + 1 < flights.length) {
          // next flight starts from the receiver / header position
          setBallDisp({ kind: 'free', pos: dest, snap: true });
        }
      }
      void scored;

      // (c) commit
      const after = result.after;
      setLog((l) => [...l, ...lines]);
      matchRef.current = { ...match, state: after };
      setState(after);
      setBallDisp(ballDispOf(after));
      setDisp(posMap(after));
      const reset = result.afterAction !== after && result.events.some((e) => e.type === 'goal');
      if (reset) {
        await wait(MOVE_MS + 150);
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
    setBadges([]);
    setLogOpen(false);
    resetPlanning(m.state);
    setTimeLeft(TIMER_SECONDS);
    setPhase('start');
  }, [resetPlanning]);

  // ---------- view models ----------
  const tokens: TokenView[] = state.players.map((p) => {
    const d = disp[p.id] ?? p.pos;
    return {
      id: p.id,
      team: p.team,
      abbr: getCharacter(p.charId).abbr,
      x: d.x,
      y: d.y,
      hasBall: ballDisp.kind === 'held' && ballDisp.id === p.id,
    };
  });
  const ball: BallView =
    ballDisp.kind === 'held' ? { kind: 'held' } : { kind: 'free', x: ballDisp.pos.x, y: ballDisp.pos.y, snap: ballDisp.snap };

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

  const chips: ChipView[] = blues.map((p) => ({
    id: p.id,
    abbr: getCharacter(p.charId).abbr,
    planned: p.id in plans,
    selected: p.id === selectedId,
  }));

  const infoPlayer = state.players.find((p) => p.id === (inspectId ?? selectedId));
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

  const actions: ActionsView | null =
    !inspectId && blueHolder && blueHolder.id === selectedId
      ? { current: effectiveAction.kind, picking: pick, shootPct, canPass, canCross }
      : null;

  const possession: TeamId | 'loose' = holder ? holder.team : 'loose';

  return {
    phase,
    state,
    timerOn,
    setTimerOn,
    secondsLeft: timerOn && phase !== 'start' ? Math.max(0, timeLeft) : timerOn ? TIMER_SECONDS : null,
    log,
    logOpen,
    setLogOpen,
    banner,
    badges,
    tokens,
    ball,
    selectedId,
    inspectId,
    notice,
    moveTargets,
    passTargets,
    planViews,
    ballArrow,
    chips,
    info,
    actions,
    plannedCount: blues.filter((p) => p.id in plans).length,
    possession,
    interactive: planning,
    onCellTap,
    onPlayerTap,
    onGhostTap,
    onChip,
    onKeep,
    onPass,
    onCross,
    onShoot,
    onReset,
    execute: () => void execute(),
    start,
    restart,
    boardCols: BOARD.cols,
  };
}
