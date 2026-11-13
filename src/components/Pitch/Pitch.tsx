import { BOARD } from '../../game/rules/config';
import type { Vec } from '../../game/types';
import { CharaMedalG, Starburst } from '../Chara';
import { getProfile } from '../../game/data/roster';
import { BallIcon, DuelTag, PlayerToken, TokenMedal } from '../Player/PlayerToken';
import type {
  ArrowView,
  BallView,
  BurstView,
  PassTargetView,
  PlanView,
  RadialMenuView,
  SpaceCellView,
  TokenLayout,
  KeeperView,
  TokenView,
  TrajectoryView,
  TrapView,
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
  /** Label of the offside band (default オフサイドライン / 守備ライン). */
  offsideLineLabel?: string;
  /** v0.8 offside-trap button and participant marks (null = trap off / not available). */
  trap?: TrapView | null;
  /** Goalkeepers standing in the goal nets (v0.9). */
  keepers?: KeeperView[];
  onKeeperTap?: (team: 'blue' | 'red') => void;
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

type P2 = { x: number; y: number };
const f2 = (n: number): string => n.toFixed(3);

/** Fat arrow polygon from a to b (shaft width w, head length hl, head half-width hw), in svg units. */
function arrowPoints(a: P2, b: P2, w = 0.1, hl = 0.3, hw = 0.21): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return '';
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const hb = Math.max(0, len - hl);
  const pts: P2[] = [
    { x: a.x + nx * w, y: a.y + ny * w },
    { x: a.x + ux * hb + nx * w, y: a.y + uy * hb + ny * w },
    { x: a.x + ux * hb + nx * hw, y: a.y + uy * hb + ny * hw },
    { x: b.x, y: b.y },
    { x: a.x + ux * hb - nx * hw, y: a.y + uy * hb - ny * hw },
    { x: a.x + ux * hb - nx * w, y: a.y + uy * hb - ny * w },
    { x: a.x - nx * w, y: a.y - ny * w },
  ];
  return pts.map((q) => `${f2(q.x)},${f2(q.y)}`).join(' ');
}

/** Jagged % bubble (or a hazard plate for long warning texts) centred on 0,0. */
function Burst({ text, caption, warn, off }: { text: string; caption?: string; warn?: boolean; off?: boolean }) {
  if (text.length > 5) {
    const w = text.length * 0.16 + 0.34;
    return (
      <g className="burst-plate">
        <rect x={-w / 2} y={-0.19} width={w} height={0.38} rx={0.06} />
        <text>{text}</text>
      </g>
    );
  }
  return (
    <g className={`pct-burst${off ? ' pct-burst--off' : ''}`}>
      <svg x={-0.56} y={-0.5} width={1.12} height={1} overflow="visible">
        <Starburst fill={warn ? '#ffb547' : undefined} points={12} />
      </svg>
      {caption && <text className="pct-burst__cap" y={-0.2}>{caption}</text>}
      <text className="pct-burst__num" y={caption ? 0.06 : 0.02}>{text}</text>
    </g>
  );
}

const CAPTION: Record<ArrowView['style'], string> = { pass: 'PASS', lofted: 'LOB', cross: 'CROSS', shoot: 'SHOT' };

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
  offsideLineLabel,
  trap = null,
  keepers = [],
  onKeeperTap,
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

  const selTok = selectedId ? tokenById.get(selectedId) : undefined;
  const targetLayer = (
    <g pointerEvents="none">
      {moveTargets.map((t) => {
        const enemy = tackleCells.has(`${t.x},${t.y}`);
        const dx = selTok ? t.x - Math.round(selTok.x) : 0;
        const dy = selTok ? t.y - Math.round(selTok.y) : 0;
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <g key={`t-${t.x},${t.y}`} className={`target${enemy ? ' target--enemy' : ''}`}>
            <rect className="target__shade" x={t.x + 0.06} y={t.y + 0.11} width={0.88} height={0.84} rx={0.16} />
            <rect className="target__tile" x={t.x + 0.06} y={t.y + 0.06} width={0.88} height={0.84} rx={0.16} />
            <rect className="target__gloss" x={t.x + 0.12} y={t.y + 0.1} width={0.76} height={0.22} rx={0.1} />
            {dx === 0 && dy === 0 ? (
              <circle className="target__stay" cx={cx(t.x)} cy={cy(t.y)} r={0.12} />
            ) : (
              <g transform={`translate(${cx(t.x)} ${cy(t.y)}) rotate(${f2(ang)})`}>
                <path className="target__arrow" d="M-0.2 -0.08 H0.02 V-0.2 L0.26 0 L0.02 0.2 V0.08 H-0.2 Z" />
              </g>
            )}
            {enemy && (
              <g className="target__warn" transform={`translate(${t.x + 0.8} ${t.y + 0.22})`}>
                <path d="M0 -0.17 L0.17 0.13 H-0.17 Z" />
                <text y={0.07}>!</text>
              </g>
            )}
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
            <g className="ghost__art">
              <TokenMedal charId={p.charId} team="blue" number={p.number} abbr={p.abbr} />
            </g>
            <circle className="ghost__body" r={0.47} />
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
        <pattern id="pt-check" width="2" height="2" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#4cbb62" />
          <rect width="1" height="1" fill="#3fa956" />
          <rect x="1" y="1" width="1" height="1" fill="#3fa956" />
        </pattern>
        <pattern id="pt-dots" width="0.16" height="0.16" patternUnits="userSpaceOnUse">
          <circle cx="0.08" cy="0.08" r="0.021" fill="#fff" fillOpacity="0.16" />
        </pattern>
        <pattern id="pt-hz-foe" width="0.36" height="0.36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="0.18" height="0.36" fill="#ffd34d" />
          <rect x="0.18" width="0.18" height="0.36" fill="#151a2d" />
        </pattern>
        <pattern id="pt-hz-own" width="0.36" height="0.36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="0.18" height="0.36" fill="#9ceaff" />
          <rect x="0.18" width="0.18" height="0.36" fill="#151a2d" />
        </pattern>
        <pattern id="net" width="0.2" height="0.2" patternUnits="userSpaceOnUse">
          <path d="M0 0 L0.2 0.2 M0.2 0 L0 0.2" stroke="rgba(255,255,255,0.55)" strokeWidth="0.025" />
        </pattern>
      </defs>

      {/* field: checker turf + halftone, ink frame, thick white lines */}
      <rect className="pitch__frame" x={-0.03} y={-0.03} width={W + 0.06} height={H + 0.06} rx={0.16} />
      <rect className="pitch__field" x={0} y={0} width={W} height={H} rx={0.12} />
      <rect className="pitch__dots" x={0} y={0} width={W} height={H} rx={0.12} />

      {/* goals (net beyond the end lines) */}
      {[-GOAL_DEPTH, H].map((y) => (
        <g key={y}>
          <rect className="pitch__net-fill" x={gl} y={y} width={GOAL_WIDTH} height={GOAL_DEPTH} />
          <rect className="pitch__net" x={gl} y={y} width={GOAL_WIDTH} height={GOAL_DEPTH} />
          <rect className="pitch__net-frame" x={gl} y={y} width={GOAL_WIDTH} height={GOAL_DEPTH} />
        </g>
      ))}

      {/* goalkeepers: medals at ~0.6x inside the net (depth 0.6 is unchanged); the tap area reaches past the net
          but sits below the cell / token layers, so it never steals a tap from the pitch */}
      <g className="keepers">
        {keepers.map((k) => {
          const x = gl + GOAL_WIDTH / 2;
          const y = k.team === 'blue' ? H + GOAL_DEPTH / 2 : -GOAL_DEPTH / 2;
          const p = getProfile(k.charId);
          return (
            <g
              key={`kp-${k.team}`}
              className="keeper"
              data-testid={`keeper-${k.team}`}
              transform={`translate(${x} ${y})`}
              onClick={
                interactive && onKeeperTap
                  ? (e) => {
                      e.stopPropagation();
                      onKeeperTap(k.team);
                    }
                  : undefined
              }
            >
              <rect className="keeper__hit" x={-1.0} y={k.team === 'blue' ? -0.5 : -0.7} width={2} height={1.2} />
              <g key={k.dive ?? 'idle'} className={k.dive ? `keeper__dive keeper__dive--${k.team}` : undefined}>
                <circle className={`keeper__base keeper__base--${k.team}`} r={0.3} />
                <g transform={`scale(0.0049) translate(-50 -50)`} pointerEvents="none">
                  <CharaMedalG look={p.look} team={k.team} number={k.number} abbr={k.abbr} rarity={p.rarity} keeper />
                </g>
              </g>
            </g>
          );
        })}
      </g>

      {/* field markings */}
      <g className="pitch__lines">
        <rect x={0} y={0} width={W} height={H} rx={0.12} />
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} />
        <circle cx={W / 2} cy={H / 2} r={1.1} />
        <circle className="pitch__dot" cx={W / 2} cy={H / 2} r={0.09} />
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

      {/* planned movement arrows: white fat arrows with an ink edge */}
      <g className="pitch__plans" pointerEvents="none">
        {movers.map((p) => {
          const fl = layouts.get(p.id);
          const tl = ghostLayout(p.to);
          const start = { x: cx(p.from.x) + (fl?.dx ?? 0), y: cy(p.from.y) + (fl?.dy ?? 0) };
          const end = shorten(
            start,
            { x: cx(p.to.x) + (tl?.dx ?? 0), y: cy(p.to.y) + (tl?.dy ?? 0) },
            tl ? 0.36 : 0.44,
          );
          const pts = arrowPoints(start, end, 0.075, 0.26, 0.18);
          return pts ? <polygon key={`a-${p.id}`} className="plan-arrow" points={pts} /> : null;
        })}
      </g>

      {/* legal move targets */}
      {targetLayer}

      {/* offside line (last defender row): hazard-striped band + flag label; while picking (legacy) or whenever planning (early) */}
      {offsideLine != null && (
        <g
          className={`offside-line${offsideLineOwn ? ' offside-line--own' : ''}`}
          data-testid="offside-line"
          pointerEvents="none"
          style={{ transform: `translateY(${offsideLine}px)` }}
        >
          <rect className="offside-line__band" x={0} y={-0.1} width={W} height={0.2} fill={`url(#${offsideLineOwn ? 'pt-hz-own' : 'pt-hz-foe'})`} />
          <rect className="offside-line__edge" x={0} y={-0.1} width={W} height={0.2} />
          {(() => {
            const below = offsideLine < 0.9;
            const ly = below ? 0.14 : -0.56;
            const label = offsideLineLabel ?? (offsideLineOwn ? '守備ライン' : 'オフサイドライン');
            const fw = label.length * 0.225 + 0.55;
            return (
              <g transform={`translate(0.08 ${ly})`}>
                <path className="offside-flag" d={`M0 0 H${fw} L${fw - 0.2} 0.21 L${fw} 0.42 H0 Z`} />
                <text className="offside-flag__text" x={0.14} y={0.22}>{label}</text>
              </g>
            );
          })()}
        </g>
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

      {/* v0.8 trap: participant marks (up arrow, UP tag, ghost one step ahead) and the declaration button */}
      {trap && (
        <g>
          {trap.marks.map((m) => {
            const stepped = m.toY < m.y;
            return (
              <g key={`tm-${m.id}`} data-testid={`trap-mark-${m.id}`} pointerEvents="none">
                {stepped && (
                  <g transform={`translate(${cx(m.x)} ${cy(m.toY)})`} className="ghost">
                    <g className="ghost__art">
                      <TokenMedal charId={m.charId} team="blue" number={m.number} abbr={m.abbr} />
                    </g>
                    <circle className="ghost__body" r={0.47} />
                  </g>
                )}
                <g transform={`translate(${cx(m.x) - 0.36} ${cy(m.y) - 0.3})`} className="trap-up">
                  <polygon className="trap-arrow" points="0,-0.46 0.2,-0.18 0.08,-0.18 0.08,-0.04 -0.08,-0.04 -0.08,-0.18 -0.2,-0.18" />
                  <rect x={-0.2} y={-0.01} width={0.4} height={0.24} rx={0.05} />
                  <text y={0.12}>UP</text>
                </g>
              </g>
            );
          })}
        </g>
      )}

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
                <rect x={-0.55} y={-0.17} width={1.1} height={0.34} rx={0.06} />
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
              <Burst text={p.label} off={!p.enabled} />
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
  const cls = `ball-arrow ball-arrow--${arrow.style}${arrow.warn ? ' ball-arrow--warn' : ''}`;
  const from = arcs ? c : a;
  // arrow head: a small triangle at `end`, pointing along the last segment
  const hx = end.x - from.x;
  const hy = end.y - from.y;
  const hl = Math.hypot(hx, hy) || 1;
  const ux = hx / hl;
  const uy = hy / hl;
  const tip = { x: end.x + ux * 0.12, y: end.y + uy * 0.12 };
  const base = { x: tip.x - ux * 0.34, y: tip.y - uy * 0.34 };
  const tri = `${f2(tip.x)},${f2(tip.y)} ${f2(base.x - uy * 0.2)},${f2(base.y + ux * 0.2)} ${f2(base.x + uy * 0.2)},${f2(base.y - ux * 0.2)}`;
  const d = arcs ? `M${a.x} ${a.y} Q${c.x} ${c.y} ${end.x} ${end.y}` : `M${a.x} ${a.y} L${end.x} ${end.y}`;
  return (
    <g pointerEvents="none" data-testid="ball-arrow" data-style={arrow.style}>
      {arrow.style === 'shoot' ? (
        <polygon className={cls} points={arrowPoints(a, tip, 0.1, 0.34, 0.24)} />
      ) : (
        <>
          <path className="ball-arrow__halo" d={d} />
          <path className={cls} d={d} />
          <polygon className="ball-arrow__head" points={tri} />
        </>
      )}
      {arrow.label && (
        <g className={`ball-arrow__label${arrow.warn ? ' ball-arrow__label--warn' : ''}`} transform={`translate(${mid.x} ${mid.y})`}>
          <Burst text={arrow.label} caption={arrow.warn ? undefined : CAPTION[arrow.style]} warn={arrow.warn} />
        </g>
      )}
    </g>
  );
}
