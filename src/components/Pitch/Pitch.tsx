import { BOARD } from '../../game/rules/config';
import type { Vec } from '../../game/types';
import { PlayerToken } from '../Player/PlayerToken';
import type { ArrowView, BadgeView, BallView, PassTargetView, PlanView, TokenView } from '../viewTypes';
import { GOAL_DEPTH, GOAL_WIDTH, VIEWBOX, VIEW, cx, cy, goalLeft, shorten } from './pitchGeometry';
import './Pitch.css';

interface Props {
  tokens: TokenView[];
  ball: BallView;
  selectedId: string | null;
  inspectId?: string | null;
  moveTargets: Vec[];
  passTargets: PassTargetView[];
  plans: PlanView[];
  ballArrow: ArrowView | null;
  badges: BadgeView[];
  interactive: boolean;
  onCellTap: (cell: Vec) => void;
  onPlayerTap: (id: string) => void;
  onGhostTap: (id: string) => void;
}

const COLS = Array.from({ length: BOARD.cols }, (_, i) => i);
const ROWS = Array.from({ length: BOARD.rows }, (_, i) => i);

export function Pitch({
  tokens,
  ball,
  selectedId,
  inspectId,
  moveTargets,
  passTargets,
  plans,
  ballArrow,
  badges,
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
  const tokenById = new Map(tokens.map((t) => [t.id, t]));
  const movers = plans.filter((p) => !p.stay);
  const stayers = plans.filter((p) => p.stay);
  const penW = 3.6;
  const penD = 1.5;
  const penX = (W - penW) / 2;

  return (
    <svg
      className={`pitch${interactive ? '' : ' pitch--locked'}`}
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
          <path d="M0,1 L9,5 L0,9 z" fill="#f5c542" />
        </marker>
        <pattern id="net" width="0.25" height="0.25" patternUnits="userSpaceOnUse">
          <path d="M0 0 L0.25 0.25 M0.25 0 L0 0.25" stroke="rgba(255,255,255,0.35)" strokeWidth="0.02" />
        </pattern>
      </defs>

      <rect className="pitch__surround" x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} />
      <rect className="pitch__field" x={0} y={0} width={W} height={H} />
      {ROWS.map((r) =>
        r % 2 === 0 ? <rect key={r} className="pitch__stripe" x={0} y={r} width={W} height={1} /> : null,
      )}

      {/* goals (net beyond the end lines) */}
      <rect className="pitch__net" x={gl} y={-GOAL_DEPTH} width={GOAL_WIDTH} height={GOAL_DEPTH} />
      <rect className="pitch__net" x={gl} y={H} width={GOAL_WIDTH} height={GOAL_DEPTH} />

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
              data-testid={targetSet.has(`${c},${r}`) ? `target-${c}-${r}` : undefined}
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
      <g pointerEvents="none">
        {moveTargets.map((t) => (
          <g key={`t-${t.x},${t.y}`}>
            <rect
              className={`target${enemyCells.has(`${t.x},${t.y}`) ? ' target--enemy' : ''}`}
              x={t.x + 0.06}
              y={t.y + 0.06}
              width={0.88}
              height={0.88}
              rx={0.14}
            />
            <circle
              className={`target__ring${enemyCells.has(`${t.x},${t.y}`) ? ' target__ring--enemy' : ''}`}
              cx={cx(t.x)}
              cy={cy(t.y)}
              r={0.44}
            />
          </g>
        ))}
      </g>

      {/* ghosts at planned destinations */}
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
            <circle className="ghost__body" r={0.36} />
            <text className="ghost__abbr">{p.abbr}</text>
          </g>
        ))}
        {stayers.map((p) => (
          <g
            key={`s-${p.id}`}
            className="stay-badge"
            data-testid={`stay-${p.id}`}
            transform={`translate(${cx(p.from.x) + 0.34} ${cy(p.from.y) - 0.34})`}
            pointerEvents="none"
          >
            <circle r={0.17} />
            <path d="M-0.08 0.0 L-0.02 0.07 L0.09 -0.07" />
          </g>
        ))}
      </g>

      {/* players */}
      <g>
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

      {/* loose / flying ball */}
      <g
        className="ball"
        data-testid="ball"
        style={{
          transform: `translate(${cx(ball.kind === 'free' ? ball.x : -3)}px, ${cy(ball.kind === 'free' ? ball.y : -3)}px)`,
          opacity: ball.kind === 'free' ? 1 : 0,
          transition: ball.kind === 'free' && ball.snap ? 'none' : undefined,
        }}
        pointerEvents="none"
      >
        <circle className="ball__shadow" cx={0.03} cy={0.05} r={0.2} />
        <circle className="ball__body" r={0.2} />
        <circle className="ball__spot" r={0.08} />
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
              transform={`translate(${cx(t.x)} ${cy(t.y) - 0.74})`}
            >
              <rect x={-0.42} y={-0.17} width={0.84} height={0.34} rx={0.17} />
              <text>{p.label}</text>
            </g>
          );
        })}
      </g>

      {/* planned ball action arrow */}
      {ballArrow && <BallArrow arrow={ballArrow} />}

      {/* transient badges */}
      <g pointerEvents="none">
        {badges.map((b) => (
          <g key={b.id} transform={`translate(${cx(b.x)} ${cy(b.y) - 0.78})`}>
            <g className="badge">
              <rect x={-0.85} y={-0.2} width={1.7} height={0.4} rx={0.2} />
              <text>{b.text}</text>
            </g>
          </g>
        ))}
      </g>
    </svg>
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
