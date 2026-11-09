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
import { BOARD, MATCH, RULES, goalTarget } from '../../game/rules/config';
import type {
  BallActionPlan,
  MatchState,
  PassStyle,
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
  /** Single slim line (text only). */
  slim?: boolean;
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
  const [passStyle, setPassStyleState] = useState<PassStyle>('ground');
  const [timerOn, setTimerOn] = useState(MATCH.planningSeconds > 0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [log, setLog] = useState<LogLine[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [banner, setBanner] = useState<BannerView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAt, setMenuAt] = useState<'token' | 'ghost'>('token');
  const [hudMenuOpen, setHudMenuOpen] = useState(false);
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

  const passBy: Record<PassStyle, PassTargetView[]> = useMemo(() => {
    const build = (style: PassStyle): PassTargetView[] => {
      if (!blueHolder || !holderPos) return [];
      return blues
        .filter((p) => p.id !== blueHolder.id)
        .map((p) => {
          const e = estimatePass(state, blueHolder.id, p.id, holderPos, posOf(p.id), undefined, style);
          return { id: p.id, label: pct(e.pComplete), enabled: e.inRange, offside: e.offside };
        });
    };
    return { ground: build('ground'), lofted: build('lofted') };
  }, [blueHolder, holderPos, blues, state, posOf]);
  const passCandidates = passBy[passStyle];

  const crossCandidates: PassTargetView[] = useMemo(() => {
    if (!blueHolder || !holderPos) return [];
    return blues
      .filter((p) => p.id !== blueHolder.id && isCrossValid('blue', holderPos, posOf(p.id)))
      .map((p) => {
        const e = estimateCross(state, blueHolder.id, p.id, holderPos, posOf(p.id));
        return { id: p.id, label: pct(e.pGoal), enabled: true, offside: e.offside };
      });
  }, [blueHolder, holderPos, blues, state, posOf]);

  // space-pass candidates: every in-range cell except the carrier's own planned cell. Cells where a teammate
  // will be (planned or standing) are included: tapping them converts to a normal pass to that teammate.
  const spaceBy: Record<PassStyle, SpaceCellView[]> = useMemo(() => {
    const build = (style: PassStyle): SpaceCellView[] => {
      if (!blueHolder || !holderPos) return [];
      const range = passMaxDistance(getCharacter(blueHolder.charId).skills, style);
      const redCells = new Set(state.players.filter((p) => p.team === 'red').map((p) => `${p.pos.x},${p.pos.y}`));
      const out: SpaceCellView[] = [];
      for (let y = 0; y < BOARD.rows; y++) {
        for (let x = 0; x < BOARD.cols; x++) {
          const c = { x, y };
          if (sameVec(c, holderPos)) continue;
          if (dist(holderPos, c) > range) continue;
          out.push({ x, y, enemy: redCells.has(`${x},${y}`) });
        }
      }
      return out;
    };
    return { ground: build('ground'), lofted: build('lofted') };
  }, [blueHolder, holderPos, state]);
  const spaceAll = spaceBy[passStyle];

  /** Teammate (not the carrier) who will stand on `c` after planning. */
  const mateAt = useCallback(
    (c: Vec) => blues.find((p) => p.id !== blueHolder?.id && sameVec(posOf(p.id), c)),
    [blues, blueHolder, posOf],
  );

  const canPass =
    passBy.ground.some((c) => c.enabled) ||
    passBy.lofted.some((c) => c.enabled) ||
    spaceBy.ground.length > 0 ||
    spaceBy.lofted.length > 0;
  const canCross = crossCandidates.length > 0;

  // action actually used (invalid targets fall back to keep)
  const effectiveAction: BallActionPlan = useMemo(() => {
    if (!blueHolder) return { kind: 'keep' };
    if (ballAction.kind === 'pass') {
      const list = passBy[ballAction.style ?? 'ground'];
      return list.some((c) => c.id === ballAction.targetId && c.enabled) ? ballAction : { kind: 'keep' };
    }
    if (ballAction.kind === 'spacePass') {
      const t = ballAction.target;
      return spaceBy[ballAction.style ?? 'ground'].some((c) => c.x === t.x && c.y === t.y)
        ? ballAction
        : { kind: 'keep' };
    }
    if (ballAction.kind === 'cross') {
      return crossCandidates.some((c) => c.id === ballAction.targetId) ? ballAction : { kind: 'keep' };
    }
    return ballAction;
  }, [ballAction, blueHolder, passBy, crossCandidates, spaceBy]);

  const shootPct = useMemo(() => {
    if (!blueHolder || !holderPos) return 0;
    return estimateShot(state, blueHolder.id, holderPos).pGoal;
  }, [blueHolder, holderPos, state]);

  useEffect(() => {
    if (ballAction.kind !== 'keep' && effectiveAction.kind === 'keep' && ballAction.kind !== 'shoot') {
      setBallAction({ kind: 'keep' });
    }
  }, [ballAction, effectiveAction]);

  const spaceEst = useMemo(() => {
    if (!blueHolder || !holderPos || effectiveAction.kind !== 'spacePass') return undefined;
    return estimateSpacePass(
      state,
      blueHolder.id,
      effectiveAction.target,
      holderPos,
      undefined,
      effectiveAction.style ?? 'ground',
      Object.fromEntries(blues.map((p) => [p.id, posOf(p.id)])),
    );
  }, [blueHolder, holderPos, effectiveAction, state, blues, posOf]);

  const ballArrow: ArrowView | null = useMemo(() => {
    if (!planning || !blueHolder || !holderPos) return null;
    const a = effectiveAction;
    if (a.kind === 'shoot') {
      return { from: holderPos, to: goalTarget('blue'), style: 'shoot', label: pct(shootPct) };
    }
    if (a.kind === 'pass') {
      const lofted = a.style === 'lofted';
      const c = passBy[a.style ?? 'ground'].find((x) => x.id === a.targetId);
      return {
        from: holderPos,
        to: posOf(a.targetId),
        style: lofted ? 'lofted' : 'pass',
        label: c?.offside ? 'OFFSIDE?' : c?.label,
        glyph: lofted ? '⌒' : '→',
        warn: c?.offside,
      };
    }
    if (a.kind === 'spacePass') {
      const lofted = a.style === 'lofted';
      return {
        from: holderPos,
        to: a.target,
        style: lofted ? 'lofted' : 'pass',
        label: spaceEst?.offside ? 'OFFSIDE?' : spaceEst ? pct(spaceEst.pComplete) : undefined,
        glyph: lofted ? '⌒' : '→',
        warn: spaceEst?.offside,
      };
    }
    if (a.kind === 'cross') {
      const c = crossCandidates.find((x) => x.id === a.targetId);
      return {
        from: holderPos,
        to: posOf(a.targetId),
        style: 'cross',
        label: c?.offside ? 'OFFSIDE?' : c?.label,
        warn: c?.offside,
      };
    }
    return null;
  }, [planning, blueHolder, holderPos, effectiveAction, shootPct, passBy, crossCandidates, posOf, spaceEst]);

  /** Row edge (svg y) of the defending team's last defender, only when it lies in the attacking half. */
  const offsideLine: number | null = useMemo(() => {
    if (!planning || !pick) return null;
    const reds = state.players.filter((p) => p.team === 'red');
    if (reds.length === 0) return null;
    const k = RULES.offside.lastDefenders;
    if (!RULES.offside.enabled || k < 1 || reds.length < k) return null;
    const row = reds.map((p) => p.pos.y).sort((x, y) => x - y)[k - 1] as number;
    // defenders still in the attackers' own half: offside only applies past the halfway line
    return Math.min(row, BOARD.rows / 2);
  }, [planning, pick, state]);

  // ---------- actions ----------
  const resetPlanning = useCallback((s: MatchState) => {
    setPlans({});
    setBallAction({ kind: 'keep' });
    setPick(null);
    setInspectId(null);
    setInfoId(null);
    setMenuOpen(false);
    setMenuAt('token');
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

  const selectBlue = useCallback((id: PlayerId, at: 'token' | 'ghost' = 'token') => {
    setSelectedId(id);
    setInspectId(null);
    setInfoId(null);
    setPick(null);
    setMenuAt(at);
    setMenuOpen(true);
  }, []);

  const toggleMenu = useCallback(
    (at: 'token' | 'ghost') => {
      setInfoId(null);
      if (menuOpen && menuAt === at) setMenuOpen(false);
      else {
        setMenuAt(at);
        setMenuOpen(true);
      }
    },
    [menuOpen, menuAt],
  );

  /** The toggle sets the style for new picks; a stored action follows only if still in range for the new style. */
  const setPassStyle = useCallback(
    (st: PassStyle) => {
      setPassStyleState(st);
      const a = ballAction;
      if (a.kind !== 'pass' && a.kind !== 'spacePass') return;
      const ok =
        a.kind === 'pass'
          ? passBy[st].some((c) => c.id === a.targetId && c.enabled)
          : spaceBy[st].some((c) => c.x === a.target.x && c.y === a.target.y);
      if (ok) setBallAction({ ...a, style: st });
      else showNotice(st === 'ground' ? 'ゴロでは届かない距離です' : '浮き玉の射程外です');
    },
    [ballAction, passBy, spaceBy, showNotice],
  );

  const spaceHas = useCallback((c: Vec) => spaceAll.some((s2) => sameVec(s2, c)), [spaceAll]);

  /** Pass-pick tap on a cell: a teammate's (planned) cell becomes a normal pass, anything else a space pass. */
  const pickCell = useCallback(
    (cell: Vec) => {
      if (!spaceHas(cell)) return;
      const mate = mateAt(cell);
      if (mate) {
        if (passCandidates.some((c) => c.id === mate.id && c.enabled)) setBallAction({ kind: 'pass', targetId: mate.id, style: passStyle });
      } else setBallAction({ kind: 'spacePass', target: { ...cell }, style: passStyle });
    },
    [spaceHas, mateAt, passCandidates, passStyle],
  );

  const pickMate = useCallback(
    (id: PlayerId) => {
      const list = pick === 'pass' ? passCandidates : crossCandidates;
      if (pick && list.some((c) => c.id === id && c.enabled)) {
        setBallAction(pick === 'pass' ? { kind: 'pass', targetId: id, style: passStyle } : { kind: 'cross', targetId: id });
      }
    },
    [pick, passCandidates, crossCandidates, passStyle],
  );

  const onPlayerTap = useCallback(
    (id: PlayerId) => {
      if (!planning) return;
      const p = state.players.find((x) => x.id === id);
      if (!p) return;
      if (pick) {
        const vacated = p.team === 'blue' && id in plans && !sameVec(plans[id], p.pos);
        if (p.team === 'blue' && !vacated) pickMate(id);
        else if (pick === 'pass') pickCell(p.pos); // enemy token or a teammate's vacated cell = space pass
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
        toggleMenu('token');
        return;
      }
      if (moveTargets.some((t) => sameVec(t, p.pos))) {
        setDest(selectedId, { ...p.pos });
        return;
      }
      selectBlue(id);
    },
    [planning, pick, plans, state, moveTargets, selectedId, setDest, selectBlue, toggleMenu, pickMate, pickCell],
  );

  const onGhostTap = useCallback(
    (id: PlayerId) => {
      if (!planning) return;
      if (pick) {
        pickMate(id);
        setPick(null);
        return;
      }
      if (id === selectedId) toggleMenu('ghost');
      else selectBlue(id, 'ghost');
    },
    [planning, pick, selectedId, selectBlue, toggleMenu, pickMate],
  );

  const onCellTap = useCallback(
    (cell: Vec) => {
      if (!planning) return;
      if (pick) {
        if (pick === 'pass') pickCell(cell);
        setPick(null);
        return;
      }
      if (moveTargets.some((t) => sameVec(t, cell))) setDest(selectedId, cell);
      else setMenuOpen(false);
    },
    [planning, pick, moveTargets, selectedId, setDest, pickCell],
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
      const before = posMap(cur);
      const clash: Record<PlayerId, Vec> = { ...mid };
      const overridden = new Set<PlayerId>();
      for (const ev of result.events) {
        if (ev.type === 'bounce' && ev.reason === 'duel') {
          clash[ev.playerId] = { ...ev.from };
          overridden.add(ev.playerId);
        } else if (ev.type === 'displace') {
          clash[ev.playerId] = { ...ev.from };
          overridden.add(ev.playerId);
        }
      }
      type DuelEv = Extract<TurnEvent, { type: 'duel' }>;
      const duelsOf = (kind: 'ground' | 'aerial') =>
        result.events.filter((e): e is DuelEv => e.type === 'duel' && e.kind === kind);
      const groundDuels = duelsOf('ground');
      const loserOf = (d: DuelEv) => (d.winnerId === d.aId ? d.bId : d.aId);

      // swap (players passing through each other): meet half-way, each nudged 0.3 toward its own origin
      for (const d of groundDuels) {
        const { aId, bId } = d;
        if (overridden.has(aId) || overridden.has(bId)) continue;
        if (!(sameVec(before[aId], mid[bId]) && sameVec(before[bId], mid[aId]))) continue;
        if (sameVec(before[aId], before[bId])) continue;
        const m = { x: (before[aId].x + before[bId].x) / 2, y: (before[aId].y + before[bId].y) / 2 };
        for (const id of [aId, bId]) {
          const o = before[id];
          const dx = o.x - m.x;
          const dy = o.y - m.y;
          const l = Math.hypot(dx, dy) || 1;
          clash[id] = { x: m.x + (dx / l) * 0.3, y: m.y + (dy / l) * 0.3 };
        }
      }

      // chained duels: split into waves with no repeated player, animated one after another
      const waves: DuelEv[][] = [];
      const lastWave: Record<PlayerId, number> = {};
      for (const d of groundDuels) {
        const w = Math.max(lastWave[d.aId] ?? -1, lastWave[d.bId] ?? -1) + 1;
        (waves[w] ??= []).push(d);
        lastWave[d.aId] = w;
        lastWave[d.bId] = w;
      }

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
      const tagResult = (
        duels: DuelEv[],
        aerial: boolean,
        knock: (id: PlayerId) => boolean,
      ): Record<PlayerId, TokenFx> => {
        const f: Record<PlayerId, TokenFx> = {};
        for (const d of duels) {
          f[d.winnerId] = { tag: { kind: 'win', label: aerial ? '空中戦 WIN' : 'WIN' } };
          const l = loserOf(d);
          f[l] = {
            tag: { kind: 'lose', label: aerial ? '空中戦 LOSE' : 'LOSE' },
            ...(knock(l) ? { moveMs: T(KNOCKBACK_MS), ease: 'back' as const } : {}),
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

      // (a2) ground duels, wave by wave: impact -> WIN / LOSE tags -> settle to the final cell
      for (let w = 0; w < waves.length; w++) {
        const duels = waves[w];
        await showClash(duels);
        if (!alive()) return;
        setFx(tagResult(duels, false, (id) => lastWave[id] === w));
        const settle: Record<PlayerId, Vec> = {};
        for (const d of duels) for (const id of [d.aId, d.bId]) if (lastWave[id] === w) settle[id] = mid[id];
        setDisp((cur2) => ({ ...cur2, ...settle }));
        const ballDuel = duels.find((d) => d.forBall);
        if (ballDuel) setBallDisp({ kind: 'held', id: ballDuel.winnerId });
        await wait(T(DUEL_RESULT_MS));
        if (!alive()) return;
        setFx({});
        setBursts([]);
      }
      if (groundDuels.length > 0) setDisp(mid);

      // (b) ball events
      const flights = result.events.filter(
        (e): e is Extract<TurnEvent, { type: 'pass' | 'cross' | 'shot' | 'offside' }> =>
          e.type === 'pass' || e.type === 'cross' || e.type === 'shot' || e.type === 'offside',
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
        let flag = false;
        const actor = teamOf(ev.type === 'shot' ? ev.shooterId : ev.passerId);
        if (ev.type === 'offside') {
          dest = ev.to;
          winner = teamOf(ev.toPlayerId);
          text = 'オフサイド！';
          flag = true;
        } else if (ev.type === 'pass') {
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
                    ? 'スルーパス（ルーズ）'
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
        const lofted = (ev.type === 'pass' || ev.type === 'offside') && ev.style === 'lofted';
        const flightMs = T(FLIGHT_MS);
        setBallDisp({ kind: 'free', pos: { ...ev.from }, snap: true });
        await wait(60);
        if (!alive()) return;
        if (isCross || lofted) {
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
          setFx(tagResult(aerialDuels, true, () => false));
          const ballAerial = aerialDuels.find((d) => d.forBall) ?? aerialDuels[0];
          if (ballAerial) setBallDisp({ kind: 'held', id: ballAerial.winnerId });
          aerialShown = true;
        }
        setBanner({ id: nextId(), text, sub, big, team: winner ?? actor, flag });
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
        if (ev.type === 'offside') setBallDisp({ kind: 'held', id: ev.toPlayerId });
        if (aerialShown) {
          setFx({});
          setBursts([]);
        }
        if (i + 1 < flights.length && ev.type !== 'offside') {
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
  const paused = logOpen || infoId !== null || hudMenuOpen;
  useEffect(() => {
    if (phase !== 'planning' || !timerOn || paused) return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase, timerOn, paused]);
  useEffect(() => {
    if (phase === 'planning' && timerOn && !paused && timeLeft <= 0) void executeRef.current();
  }, [phase, timerOn, timeLeft, paused]);

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
  // markers are hidden under teammates' planned cells (their % badge sits at the ghost instead)
  const spaceCells: SpaceCellView[] =
    planning && pick === 'pass' ? spaceAll.filter((c) => !mateAt(c)) : [];

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
          setPassStyleState(
            effectiveAction.kind === 'pass' || effectiveAction.kind === 'spacePass'
              ? (effectiveAction.style ?? 'ground')
              : 'ground',
          );
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
    const ghostTo = plans[selectedId];
    const at = menuAt === 'ghost' && ghostTo && !sameVec(ghostTo, selectedPlayer.pos) ? ghostTo : selectedPlayer.pos;
    return { x: at.x, y: at.y, items };
  })();

  const hint: HintView | null = notice
    ? { text: notice, warn: true }
    : planning && pick === 'pass'
      ? { slim: true, text: 'パス先（味方 or スペース）をタップ' }
      : planning && pick === 'cross'
        ? { slim: true, text: 'クロス先をタップ（％=得点率）' }
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
    hudMenuOpen,
    setHudMenuOpen,
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
    offsideLine,
    passStyleBar: planning && pick === 'pass' ? passStyle : null,
    passStyle,
    setPassStyle,
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
