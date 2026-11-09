import type { RadialMenuItem, RadialMenuView } from '../viewTypes';
import { BOARD } from '../../game/rules/config';
import { cx, cy } from './pitchGeometry';

const R = 0.36;

/** Icons drawn in a 24x24 box centred on 0,0 (scaled to the item). */
const ICONS: Record<RadialMenuItem['key'], JSX.Element> = {
  shoot: (
    <g>
      <circle r="5" fill="none" />
      <path d="M-8 6 L4 -6 M-1 -7 L5 -7 L5 -1" fill="none" />
    </g>
  ),
  pass: (
    <g>
      <path d="M-8 4 L7 -4 M2 -8 L8 -4 L3 1" fill="none" />
      <circle cx="-8" cy="4" r="2" fill="currentColor" stroke="none" />
    </g>
  ),
  cross: (
    <g>
      <path d="M-8 5 Q-1 -11 8 3 M3 -1 L8 3 L2 5" fill="none" />
    </g>
  ),
  keep: (
    <g>
      <path d="M0 -8 L7 -5 L7 1 Q7 6 0 9 Q-7 6 -7 1 L-7 -5 Z" fill="none" />
    </g>
  ),
  stay: (
    <g>
      <path d="M-4 -6 L-4 6 M4 -6 L4 6" fill="none" />
    </g>
  ),
  info: (
    <g>
      <path d="M0 -1 L0 7" fill="none" />
      <circle cy="-6" r="1.4" fill="currentColor" stroke="none" />
    </g>
  ),
};

const TINT: Record<RadialMenuItem['key'], string> = {
  shoot: 'gold',
  pass: 'blue',
  cross: 'blue',
  keep: 'navy',
  stay: 'navy',
  info: 'navy',
};

export function RadialMenu({ menu, positions }: { menu: RadialMenuView; positions: { x: number; y: number }[] }) {
  return (
    <g className="radial" data-testid="radial-menu">
      {menu.items.map((it, i) => {
        const q = positions[i] ?? { x: menu.x, y: menu.y + 1.6 };
        const p = { x: cx(q.x), y: cy(q.y) };
        // label sits outside the ring (away from the anchor token) so neighbours never collide
        const ox = p.x - cx(menu.x);
        const oy = p.y - cy(menu.y);
        const ol = Math.hypot(ox, oy) || 1;
        const ux = ox / ol;
        const uy = oy / ol;
        const w = (it.label.length * 0.23) + 0.1;
        const fits = (sd: 'start' | 'end') =>
          sd === 'end' ? p.x - (R + 0.08) - w >= 0.05 : p.x + (R + 0.08) + w <= BOARD.cols - 0.05;
        const pref: 'start' | 'end' = ux > 0.55 ? 'start' : ux < -0.55 ? 'end' : p.x < BOARD.cols / 2 ? 'start' : 'end';
        const other = pref === 'start' ? 'end' : 'start';
        const side: 'start' | 'end' | 'middle' = fits(pref) ? pref : fits(other) ? other : 'middle';
        const tw = Math.max(it.label.length * 0.225, (it.sub?.length ?? 0) * 0.17);
        const sx = side === 'start' ? 1 : -1;
        const lx = side === 'middle' ? ux * 0.2 : sx * (R + 0.08);
        const ly =
          side === 'middle'
            ? (Math.abs(uy) < 0.3 ? (uy >= 0 ? 1 : -1) : Math.sign(uy)) * (R + 0.12 + (it.sub ? 0.1 : 0))
            : 0;
        return (
          <g key={it.key} transform={`translate(${p.x} ${p.y})`}>
            <g
              className={`radial__item radial__item--${TINT[it.key]}${it.enabled ? '' : ' is-off'}${it.active ? ' is-active' : ''}`}
              style={{ animationDelay: `${i * 40}ms` }}
              data-testid={`radial-${it.key}`}
              role="button"
              aria-label={it.label}
              aria-disabled={!it.enabled}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (it.enabled) it.onTap();
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (it.enabled) it.onTap();
              }}
            >
              <circle className="radial__hit" r={R + 0.08} />
              <circle className="radial__shadow" cy={0.05} r={R} />
              <circle className="radial__body" r={R} />
              <ellipse className="radial__gloss" cx={-0.07} cy={-0.17} rx={0.2} ry={0.1} />
              <g className="radial__icon" transform="scale(0.0225)">
                {ICONS[it.key]}
              </g>
            </g>
            <g
              className="radial__label"
              style={{ animationDelay: `${i * 40 + 80}ms` }}
              transform={`translate(${lx} ${ly})`}
              pointerEvents="none"
            >
              <rect
                className="radial__pill"
                x={side === 'start' ? -0.07 : side === 'end' ? -tw + 0.07 : -tw / 2 - 0.07}
                y={it.sub ? -0.27 : -0.15}
                width={tw + 0.14}
                height={it.sub ? 0.54 : 0.3}
                rx={0.15}
              />
              <text textAnchor={side} y={it.sub ? -0.12 : 0}>
                {it.label}
              </text>
              {it.sub && (
                <text className="radial__sub" textAnchor={side} y={0.13}>
                  {it.sub}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}

