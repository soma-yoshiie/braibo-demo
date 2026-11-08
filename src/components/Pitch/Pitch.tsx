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
  TokenView,
  TrajectoryView,
} from '../viewTypes';
import { GOAL_DEPTH, GOAL_WIDTH, VIEW, VIEWBOX, cx, cy, goalLeft, radialLayout, shorten } from './pitchGeometry';
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
  plans: PlanView[];
  ballArrow: ArrowView | null;
  bursts: BurstView[];
  radial: RadialMenuView | null;
  interactive: boolean;
  onCellTap: (cell: Vec) => void;
  onPlayerTap: (id: string) => void;
  onGhostTap: (id: string) => void;
}

const COLS = Array.from({ length: BOARD.cols }, (_, i) => i);
const ROWS = Array.from({ length: BOARD.rows }, (_, i) => i);
const SPIKES = Array.from({ length: 8 }, (_, i) => i);

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
  plans,
  ballArrow,
  bursts,
  radial,
  interactive,
  onCellTap,
  onPlayerTap,
  onGhostTap,
}: Props) {
  const W = BOARD.cols;
  const H = BOARD.rows;
  const gl = goalLeft();
  const passById = new Map(passTargets.map((p) => [p.id, p]));
  const enemyCells = new Set(
    tokens.filter((t) => t.team === 'red').map((t) => `${Math.round(t.x)},${Math.round(t.y)}`),
  );
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
        const enemy = enemyCells.has(`${t.x},${t.y}`);
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
          const end = shorten({ x: cx(p.from.x), y: cy(p.from.y) }, { x: cx(p.to.x), y: cy(p.to.y) }, 0.42);
          return (
            <line
              key={`a-${p.id}`}
              className="plan-arrow"
              x1={cx(p.from.x)}
              y1={cy(p.from.y)}
              x2={end.x}
              y2={end.y}
              markerEnd="url(#arrow-blue)"
            />
          );
        })}
      </g>

      {/* legal move targets */}
      {targetLayer}

      {/* trajectory of a flying ball */}
      {trajectory && <Trajectory t={trajectory} />}

      {/* players */}
      <g className={picking ? 'tokens tokens--picking' : 'tokens'}>
        {tokens.map((t) => (
          <PlayerToken
            key={t.id}
            token={t}
            selected={t.id === selectedId}
            inspected={t.id === inspectId}
            passTarget={passById.get(t.id)?.enabled === true}
            interactive={interactive}
            onTap={onPlayerTap}
          />
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
                selected
                passTarget={false}
                interactive={false}
                onTap={onPlayerTap}
              />
            ))}
        </g>
      )}

      {/* above-token overlay: tackle rings, space-pass markers, ghosts, check badges */}
      <g className="overlay-top">
        <g pointerEvents="none">
          {moveTargets
            .filter((t) => enemyCells.has(`${t.x},${t.y}`))
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
            .map((t) => (
              <g key={`ck-${t.id}`} className="token__check" transform={`translate(${cx(t.x) + 0.31} ${cy(t.y) - 0.31})`}>
                <circle r={0.16} />
                <path d="M-0.08 0.0 L-0.02 0.07 L0.09 -0.07" />
              </g>
            ))}
        </g>
        <g>
          {movers.map((p) => (
            <g
              key={`g-${p.id}`}
              className="ghost"
              data-testid={`ghost-${p.id}`}
              transform={`translate(${cx(p.to.x)} ${cy(p.to.y)})`}
              onClick={
                interactive
                  ? (e) => {
                      e.stopPropagation();
                      onGhostTap(p.id);
                    }
                  : undefined
              }
            >
              <circle className="ghost__hit" r={0.5} />
              <circle className="ghost__body" r={0.38} />
              <text className="ghost__abbr">{p.abbr}</text>
            </g>
          ))}
        </g>
      </g>

      {/* duel WIN / LOSE tags (above every token) */}
      <g pointerEvents="none">
        {tokens.map((t) => (t.tag ? <DuelTag key={t.id} token={t} /> : null))}
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
        <g
          key={ball.kind === 'free' ? ball.flightKey ?? 0 : 0}
          className={ball.kind === 'free' && ball.arc && !ball.snap ? 'ball__lob' : undefined}
          style={{ ['--lob-h' as string]: ball.kind === 'free' && ball.arc ? `${-ball.arc}px` : undefined }}
        >
          <ellipse className="ball__shadow" cx={0.03} cy={0.12} rx={0.2} ry={0.09} />
          <BallIcon r={0.2} />
        </g>
      </g>

      {/* pass target labels */}
      <g pointerEvents="none">
        {passTargets.map((p) => {
          const t0 = tokenById.get(p.id);
          if (!t0) return null;
          const planned = movers.find((m) => m.id === p.id);
          const t = planned ? { x: planned.to.x, y: planned.to.y } : t0;
          return (
            <g
              key={`pl-${p.id}`}
              className={`pct${p.enabled ? '' : ' pct--off'}`}
              transform={`translate(${cx(t.x)} ${cy(t.y) - 0.78})`}
            >
              <rect x={-0.4} y={-0.17} width={0.8} height={0.34} rx={0.17} />
              <text>{p.label}</text>
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
  const end = shorten(a, b, arrow.style === 'shoot' ? 0.1 : 0.45);
  const mid = { x: (a.x + end.x) / 2, y: (a.y + end.y) / 2 };
  return (
    <g pointerEvents="none" data-testid="ball-arrow">
      <line
        className={`ball-arrow ball-arrow--${arrow.style}`}
        x1={a.x}
        y1={a.y}
        x2={end.x}
        y2={end.y}
        markerEnd="url(#arrow-accent)"
      />
      {arrow.label && (
        <g className="ball-arrow__label" transform={`translate(${mid.x} ${mid.y})`}>
          <rect x={-0.4} y={-0.17} width={0.8} height={0.34} rx={0.17} />
          <text>{arrow.label}</text>
        </g>
      )}
    </g>
  );
}
