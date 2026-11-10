import { BOARD } from '../../game/rules/config';
import type { Vec } from '../../game/types';
import { BallIcon, DuelTag, PlayerToken } from '../Player/PlayerToken';
import type {
  ArrowView,
  BallView,
  BurstView,
  PassTargetView,
  PlanView,
  RadialMenuView,
  SpaceCellView,
  TokenLayout,
  TokenView,
  TrajectoryView,
} from '../viewTypes';
import { restSlot, GOAL_DEPTH, GOAL_WIDTH, VIEW, VIEWBOX, cx, cy, goalLeft, radialLayout, shorten } from './pitchGeometry';
import { RadialMenu } from './RadialMenu';
import './Pitch.css';

interface Props {
  tokens: TokenView[];
  ball: BallView;
  trajectory?: TrajectoryView | null;
  selectedId: string | null;
  inspectId?: string | null;
  moveTargets: Vec[];
  passTargets: PassTargetView[];
  spaceCells: SpaceCellView[];
  /** Picking a pass / cross target: enemy tokens stop eating taps so space cells under them work. */
  picking: boolean;
  /** svg y of the defending team's last-defender line (null = hidden). */
  offsideLine?: number | null;
  /** The line is the blue team's own last line (red has the ball): drawn in a cooler colour. */
  offsideLineOwn?: boolean;
  /** v0.5: blue players currently in an offside position (small OFF mark while picking a pass target). */
  offPosIds?: string[];
  /** v0.5 early through pass: a space pass is kicked before movement, so % badges sit on the current token. */
  throughEarly?: boolean;
  plans: PlanView[];
  ballArrow: ArrowView | null;
  bursts: BurstView[];
  radial: RadialMenuView | null;
  interactive: boolean;
  onCellTap: (cell: Vec) => void;
  onPlayerTap: (id: string) => void;
  onGhostTap: (id: string) => void;
  /** False while pieces are still walking in / clashing: shared cells are not yet laid out side by side. */
  spread?: boolean;
}

const COLS = Array.from({ length: BOARD.cols }, (_, i) => i);
const ROWS = Array.from({ length: BOARD.rows }, (_, i) => i);
const SPIKES = Array.from({ length: 8 }, (_, i) => i);

/** While the duel clash plays the two sit closer together. */
const CLASH: Record<'blue' | 'red', TokenLayout> = {
  blue: { dx: -0.1, dy: 0.07, s: 0.9 },
  red: { dx: 0.1, dy: -0.07, s: 0.9 },
};
const cellKey = (t: { x: number; y: number }): string | null =>
  Number.isInteger(t.x) && Number.isInteger(t.y) ? `${t.x},${t.y}` : null;

/** Per-token layout for cells holding one blue and one red token, plus the draw order (ball holder on top). */
function layoutTokens(tokens: TokenView[], spread: boolean, ghostCells: Set<string>): { layouts: Map<string, TokenLayout>; ordered: TokenView[] } {
  const groups = new Map<string, TokenView[]>();
  for (const t of tokens) {
    const k = cellKey(t);
    if (k) groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const layouts = new Map<string, TokenLayout>();
  const ordered = [...tokens];
  for (const [key, g] of groups) {
    const blue = g.find((t) => t.team === 'blue');
    const red = g.find((t) => t.team === 'red');
    if (red && !blue && spread && ghostCells.has(key)) {
      // a planned blue ghost lands here: make room so both stay readable
      layouts.set(red.id, restSlot('red', red));
      continue;
    }
    if (!blue || !red) continue;
    const table = spread
      ? { blue: restSlot('blue', blue), red: restSlot('red', red) }
      : g.some((t) => t.clash)
        ? CLASH
        : null;
    if (!table) continue;
    layouts.set(blue.id, table.blue);
    layouts.set(red.id, table.red);
    // ball holder on top (also while its ball is in flight); with no holder the user's own (blue) token is on top
    const top = red.hasBall || (red.top && !blue.hasBall) ? red : blue;
    const other = top === blue ? red : blue;
    const i = ordered.indexOf(top);
    const j = ordered.indexOf(other);
    if (i < j) [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return { layouts, ordered };
}

export function Pitch({
  tokens,
  ball,
  trajectory,
  selectedId,
  inspectId,
  moveTargets,
  passTargets,
  spaceCells,
  picking,
  offsideLine,
  offsideLineOwn = false,
  offPosIds = [],
  throughEarly = false,
  plans,
  ballArrow,
  bursts,
  radial,
  interactive,
  onCellTap,
  onPlayerTap,
  onGhostTap,
  spread = true,
}: Props) {
  const W = BOARD.cols;
  const H = BOARD.rows;
  const gl = goalLeft();
  const passById = new Map(passTargets.map((p) => [p.id, p]));
  // only the enemy ball holder's cell is a tackle (duel) target; other enemy cells are plain move targets
  const tackleCells = new Set(
    tokens.filter((t) => t.team === 'red' && t.hasBall).map((t) => `${Math.round(t.x)},${Math.round(t.y)}`),
  );
  const ghostCells = new Set(plans.filter((p) => !p.stay).map((p) => `${p.to.x},${p.to.y}`));
  const { layouts, ordered } = layoutTokens(tokens, spread, ghostCells);
  const redCellSet = new Set(
    tokens.filter((t) => t.team === 'red').map((t) => cellKey(t)).filter((k): k is string => k !== null),
  );
  /** A ghost on an enemy-occupied cell is drawn at the blue slot so it does not hide the enemy. */
  const ghostLayout = (to: Vec): TokenLayout | undefined => (spread && redCellSet.has(`${to.x},${to.y}`) ? restSlot('blue', to) : undefined);
  const targetSet = new Set(moveTargets.map((t) => `${t.x},${t.y}`));
  const spaceSet = new Set(spaceCells.map((t) => `${t.x},${t.y}`));
  const tokenById = new Map(tokens.map((t) => [t.id, t]));
  const movers = plans.filter((p) => !p.stay);
  const penW = 3.6;
  const penD = 1.5;
  const penX = (W - penW) / 2;

  const testIdFor = (c: number, r: number): string | undefined => {
    const k = `${c},${r}`;
    if (targetSet.has(k)) return `target-${c}-${r}`;
    if (spaceSet.has(k)) return `space-${c}-${r}`;
    return undefined;
  };

  const targetLayer = (
    <g pointerEvents="none">
      {moveTargets.map((t) => {
        const enemy = tackleCells.has(`${t.x},${t.y}`);
        return (
          <g key={`t-${t.x},${t.y}`}>
            <rect
              className={`target${enemy ? ' target--enemy' : ''}`}
              x={t.x + 0.07}
              y={t.y + 0.07}
              width={0.86}
              height={0.86}
              rx={0.16}
            />
            <circle className={`target__ring${enemy ? ' target__ring--enemy' : ''}`} cx={cx(t.x)} cy={cy(t.y)} r={0.42} />
          </g>
        );
      })}
    </g>
  );
  const ghostLayer = (
    <g>
      {movers.map((p) => {
        const gl2 = ghostLayout(p.to);
        return (
        <g
          key={`g-${p.id}`}
          className="ghost"
          data-testid={`ghost-${p.id}`}
          transform={`translate(${cx(p.to.x) + (gl2?.dx ?? 0)} ${cy(p.to.y) + (gl2?.dy ?? 0)})${gl2 ? ` scale(${gl2.s})` : ''}`}
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  onGhostTap(p.id);
                }
              : undefined
          }
        >
          <circle className="ghost__hit" r={gl2 ? 0.42 : 0.5} />
          <circle className="ghost__body" r={0.38} />
          <text className="ghost__abbr">{p.abbr}</text>
        </g>
        );
      })}
    </g>
  );
  const radialPos = radial
    ? radialLayout(radial, radial.items.length, {
        targets: moveTargets,
        tokens: [...tokens.map((t) => ({ x: t.x, y: t.y })), ...movers.map((m) => ({ x: m.to.x, y: m.to.y }))],
      })
    : [];

  return (
    <svg
      className={`pitch${interactive ? '' : ' pitch--locked'}${picking ? ' pitch--picking' : ''}`}
      viewBox={VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="ピッチ"
      data-testid="pitch"
    >
      <defs>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,1 L9,5 L0,9 z" fill="#9cc2ff" />
        </marker>
        <marker id="arrow-accent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,1 L9,5 L0,9 z" fill="#f6dc93" />
        </marker>
        <marker id="arrow-sky" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,1 L9,5 L0,9 z" fill="#8fe0ff" />
        </marker>
        <pattern id="net" width="0.2" height="0.2" patternUnits="userSpaceOnUse">
          <path d="M0 0 L0.2 0.2 M0.2 0 L0 0.2" stroke="rgba(255,255,255,0.45)" strokeWidth="0.02" />
        </pattern>
        <radialGradient id="tok-blue" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#7db4ff" />
          <stop offset="0.55" stopColor="#3d8bff" />
          <stop offset="1" stopColor="#1b4fb8" />
        </radialGradient>
        <radialGradient id="tok-red" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ff8e96" />
          <stop offset="0.55" stopColor="#ff4d5a" />
          <stop offset="1" stopColor="#b3202d" />
        </radialGradient>
        <radialGradient id="ball-grad" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9d0df" />
        </radialGradient>
      </defs>

      {/* field */}
      <rect className="pitch__field" x={0} y={0} width={W} height={H} />
      {ROWS.map((r) =>
        r % 2 === 1 ? <rect key={r} className="pitch__stripe" x={0} y={r} width={W} height={1} /> : null,
      )}

      {/* goals (net beyond the end lines) */}
      {[-GOAL_DEPTH, H].map((y) => (
        <g key={y}>
          <rect className="pitch__net-shadow" x={gl + 0.05} y={y + (y < 0 ? 0 : 0.04)} width={GOAL_WIDTH} height={GOAL_DEPTH} />
          <rect className="pitch__net" x={gl} y={y} width={GOAL_WIDTH} height={GOAL_DEPTH} />
          <rect className="pitch__net-fill" x={gl} y={y} width={GOAL_WIDTH} height={GOAL_DEPTH} />
        </g>
      ))}

      {/* faint grid */}
      <g className="pitch__grid">
        {COLS.slice(1).map((c) => (
          <line key={`v${c}`} x1={c} y1={0} x2={c} y2={H} />
        ))}
        {ROWS.slice(1).map((r) => (
          <line key={`h${r}`} x1={0} y1={r} x2={W} y2={r} />
        ))}
      </g>

      {/* field markings */}
      <g className="pitch__lines">
        <rect x={0} y={0} width={W} height={H} />
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} />
        <circle cx={W / 2} cy={H / 2} r={1.1} />
        <circle className="pitch__dot" cx={W / 2} cy={H / 2} r={0.07} />
        <rect x={penX} y={0} width={penW} height={penD} />
        <rect x={penX} y={H - penD} width={penW} height={penD} />
      </g>

      {/* tap targets for every cell */}
      <g>
        {ROWS.map((r) =>
          COLS.map((c) => (
            <rect
              key={`${c},${r}`}
              className="pitch__cell"
              data-cell={`${c},${r}`}
              data-testid={testIdFor(c, r)}
              x={c}
              y={r}
              width={1}
              height={1}
              onClick={interactive ? () => onCellTap({ x: c, y: r }) : undefined}
            />
          )),
        )}
      </g>

      {/* planned movement arrows */}
      <g className="pitch__plans" pointerEvents="none">
        {movers.map((p) => {
          const fl = layouts.get(p.id);
          const tl = ghostLayout(p.to);
          const start = { x: cx(p.from.x) + (fl?.dx ?? 0), y: cy(p.from.y) + (fl?.dy ?? 0) };
          const end = shorten(
            start,
            { x: cx(p.to.x) + (tl?.dx ?? 0), y: cy(p.to.y) + (tl?.dy ?? 0) },
            tl ? 0.34 : 0.42,
          );
          return (
            <line
              key={`a-${p.id}`}
              className="plan-arrow"
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              markerEnd="url(#arrow-blue)"
            />
          );
        })}
      </g>

      {/* legal move targets */}
      {targetLayer}

      {/* offside line (last defender row): while picking (legacy) or whenever planning (early) */}
      {offsideLine != null && (
        <line
          className={`offside-line${offsideLineOwn ? ' offside-line--own' : ''}`}
          data-testid="offside-line"
          pointerEvents="none"
          x1={0}
          x2={W}
          y1={offsideLine}
          y2={offsideLine}
        />
      )}

      {/* trajectory of a flying ball */}
      {trajectory && <Trajectory t={trajectory} />}

      {/* players */}
      <g className={picking ? 'tokens tokens--picking' : 'tokens'}>
        {ordered.map((t) => (
          <PlayerToken
            key={t.id}
            token={t}
            layout={layouts.get(t.id)}
            selected={t.id === selectedId}
            inspected={t.id === inspectId}
            passTarget={passById.get(t.id)?.enabled === true}
            interactive={interactive}
            onTap={onPlayerTap}
          />
        ))}
      </g>

      {/* above-token overlay: tackle rings, space-pass markers, ghosts, check badges */}
      <g className="overlay-top">
        <g pointerEvents="none">
          {moveTargets
            .filter((t) => tackleCells.has(`${t.x},${t.y}`))
            .map((t) => (
              <circle key={`tk-${t.x},${t.y}`} className="tackle-ring" cx={cx(t.x)} cy={cy(t.y)} r={0.5} />
            ))}
        </g>
        <g pointerEvents="none" className="space-layer">
          {spaceCells.map((s2) => (
            <g
              key={`sp-${s2.x},${s2.y}`}
              className={`space${s2.enemy ? ' space--enemy' : ''}`}
              transform={`translate(${cx(s2.x)} ${cy(s2.y)})`}
            >
              <rect className="space__mark" x={-0.2} y={-0.2} width={0.4} height={0.4} rx={0.05} transform="rotate(45)" />
              {s2.enemy && <circle className="space__ring" r={0.48} />}
            </g>
          ))}
        </g>
        <g pointerEvents="none">
          {tokens
            .filter((t) => t.planned)
            .map((t) => {
              const l = layouts.get(t.id);
              // shared cell: badge goes to the outer-left so it never sits on the opponent
              const bx = l ? l.dx - 0.25 : 0.31;
              const by = l ? l.dy - 0.25 : -0.31;
              return (
                <g
                  key={`ck-${t.id}`}
                  className="token__check"
                  transform={`translate(${cx(t.x) + bx} ${cy(t.y) + by})${l ? ' scale(0.85)' : ''}`}
                >
                  <circle r={0.16} />
                  <path d="M-0.08 0.0 L-0.02 0.07 L0.09 -0.07" />
                </g>
              );
            })}
        </g>
        {!radial && ghostLayer}
      </g>

      {/* duel WIN / LOSE tags (above every token) */}
      <g pointerEvents="none">
        {tokens.map((t) => (t.tag ? <DuelTag key={t.id} token={t} layout={layouts.get(t.id)} /> : null))}
      </g>

      {/* loose / flying ball */}
      <g
        className="ball"
        data-testid="ball"
        style={{
          transform: `translate(${cx(ball.kind === 'free' ? ball.x : -3)}px, ${cy(ball.kind === 'free' ? ball.y : -3)}px)`,
          opacity: ball.kind === 'free' ? 1 : 0,
          transition: ball.kind === 'free' && ball.snap ? 'none' : undefined,
          ['--ball-ms' as string]: ball.kind === 'free' && ball.ms ? `${ball.ms}ms` : undefined,
          ['--ball-ease' as string]: ball.kind === 'free' && ball.arc ? 'linear' : undefined,
        }}
        pointerEvents="none"
      >
        <ellipse className="ball__shadow" cx={0.03} cy={0.12} rx={0.2} ry={0.09} />
        <g
          key={ball.kind === 'free' ? ball.flightKey ?? 0 : 0}
          className={ball.kind === 'free' && ball.arc && !ball.snap ? 'ball__lob' : undefined}
          style={{ ['--lob-h' as string]: ball.kind === 'free' && ball.arc ? `${-ball.arc}px` : undefined }}
        >
          <BallIcon r={0.2} />
        </g>
      </g>

      {/* pass target labels */}
      <g pointerEvents="none">
        {passTargets.map((p) => {
          const t0 = tokenById.get(p.id);
          if (!t0) return null;
          const planned = throughEarly ? undefined : movers.find((m) => m.id === p.id);
          const t = planned ? { x: planned.to.x, y: planned.to.y } : t0;
          const sl = planned ? ghostLayout(planned.to) : layouts.get(p.id);
          const lx = cx(t.x) + (sl?.dx ?? 0);
          // top-row receivers: put the label below the token so the hint strip never covers it
          const dy = t.y < 1 ? 0.78 : -0.78;
          if (p.offside) {
            return (
              <g
                key={`pl-${p.id}`}
                className="offside-badge"
                data-testid={`offside-${p.id}`}
                transform={`translate(${lx} ${cy(t.y) + dy})`}
              >
                <rect x={-0.55} y={-0.17} width={1.1} height={0.34} rx={0.07} />
                <text>OFFSIDE</text>
              </g>
            );
          }
          return (
            <g
              key={`pl-${p.id}`}
              className={`pct${p.enabled ? '' : ' pct--off'}`}
              transform={`translate(${lx} ${cy(t.y) + dy})`}
            >
              <rect x={-0.4} y={-0.17} width={0.8} height={0.34} rx={0.17} />
              <text>{p.label}</text>
            </g>
          );
        })}
      </g>

      {/* v0.5: players standing offside right now */}
      <g pointerEvents="none">
        {offPosIds.map((id) => {
          const t = tokenById.get(id);
          if (!t) return null;
          const l = layouts.get(id);
          // the pass badge sits above the token (below on the top row): put OFF on the opposite side, clear of the check mark
          const offDy = t.y < 1 ? -0.46 : 0.46;
          return (
            <g
              key={`off-${id}`}
              className="offpos"
              data-testid={`offpos-${id}`}
              transform={`translate(${cx(t.x) + (l?.dx ?? 0)} ${cy(t.y) + (l?.dy ?? 0) + offDy})`}
            >
              <rect x={-0.26} y={-0.11} width={0.52} height={0.22} rx={0.05} />
              <text>OFF</text>
            </g>
          );
        })}
      </g>

      {/* planned ball action arrow */}
      {ballArrow && <BallArrow arrow={ballArrow} />}

      {/* impact bursts */}
      <g pointerEvents="none">
        {bursts.map((b) => (
          <g key={b.id} className={`burst burst--${b.team}`} transform={`translate(${cx(b.x)} ${cy(b.y)})`}>
            <circle className="burst__ring" r={0.5} />
            <circle className="burst__ring burst__ring--2" r={0.5} />
            <g className="burst__spikes">
              {SPIKES.map((i) => (
                <line key={i} className="burst__spike" x1={0.42} y1={0} x2={0.8} y2={0} transform={`rotate(${i * 45})`} />
              ))}
            </g>
          </g>
        ))}
      </g>

      {/* radial scrim: dims everything above; selected token, targets, ghosts and the menu are redrawn on top */}
      {radial && (
        <g pointerEvents="none" data-testid="radial-scrim">
          <rect className="scrim" x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} />
          {targetLayer}
          {tokens
            .filter((t) => t.id === selectedId)
            .map((t) => (
              <PlayerToken
                key={`clone-${t.id}`}
                clone
                token={t}
                layout={layouts.get(t.id)}
                selected
                passTarget={false}
                interactive={false}
                onTap={onPlayerTap}
              />
            ))}
        </g>
      )}
      {radial && ghostLayer}

      {/* radial action menu */}
      {radial && <RadialMenu menu={radial} positions={radialPos} />}
    </svg>
  );
}

function Trajectory({ t }: { t: TrajectoryView }) {
  const a = { x: cx(t.from.x), y: cy(t.from.y) };
  const b = { x: cx(t.to.x), y: cy(t.to.y) };
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - t.arc * 2 };
  return (
    <path
      className="trajectory"
      pointerEvents="none"
      d={`M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}`}
      data-testid="trajectory"
    />
  );
}

function BallArrow({ arrow }: { arrow: ArrowView }) {
  const a = { x: cx(arrow.from.x), y: cy(arrow.from.y) };
  const b = { x: cx(arrow.to.x), y: cy(arrow.to.y) };
  const arcs = arrow.style === 'cross' || arrow.style === 'lofted';
  const end = shorten(a, b, arrow.style === 'shoot' ? 0.1 : 0.45);
  const len = Math.hypot(end.x - a.x, end.y - a.y);
  const lift = arcs ? Math.max(0.8, Math.min(2.2, len * 0.35)) : 0;
  // quadratic control point lifted perpendicular-ish (screen up) like the flight trajectory
  const c = { x: (a.x + end.x) / 2, y: (a.y + end.y) / 2 - lift };
  // straight arrows: keep the label about one cell clear of the kicker (and its ghost), but not past 3/4 of the way
  const tl = arcs || len === 0 ? 0.5 : Math.min(0.75, Math.max(0.5, 1.05 / len));
  const mid = arcs
    ? { x: (a.x + 2 * c.x + end.x) / 4, y: (a.y + 2 * c.y + end.y) / 4 }
    : { x: a.x + (end.x - a.x) * tl, y: a.y + (end.y - a.y) * tl };
  const text = arrow.label ? `${arrow.glyph ? `${arrow.glyph} ` : ''}${arrow.label}` : '';
  const w = Math.max(0.8, text.length * 0.2 + 0.3);
  const cls = `ball-arrow ball-arrow--${arrow.style}${arrow.warn ? ' ball-arrow--warn' : ''}`;
  return (
    <g pointerEvents="none" data-testid="ball-arrow" data-style={arrow.style}>
      {arcs ? (
        <path
          className={cls}
          fill="none"
          d={`M${a.x} ${a.y} Q${c.x} ${c.y} ${end.x} ${end.y}`}
          markerEnd={arrow.style === 'lofted' ? 'url(#arrow-sky)' : 'url(#arrow-accent)'}
        />
      ) : (
        <line className={cls} x1={a.x} y1={a.y} x2={end.x} y2={end.y} markerEnd="url(#arrow-accent)" />
      )}
      {arrow.label && (
        <g
          className={`ball-arrow__label${arrow.warn ? ' ball-arrow__label--warn' : ''}${arrow.style === 'lofted' ? ' ball-arrow__label--lofted' : ''}`}
          transform={`translate(${mid.x} ${mid.y})`}
        >
          <rect x={-w / 2} y={-0.17} width={w} height={0.34} rx={0.17} />
          <text>{text}</text>
        </g>
      )}
    </g>
  );
}
