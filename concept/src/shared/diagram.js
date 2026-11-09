/* Pitch diagram helper for concept documents. Blue attacks upward (goal at y = -0.5).
   D(id, { y0, y1, cell, line, oldLine, tokens:[{t,x,y,n,ball,ghost,ring,lock}],
           arrows:[{f:[x,y], to:[x,y], k:'move'|'rmove'|'pass'|'fly', curve, s, e}],
           marks:[{k:'x'|'ok'|'off'|'on'|'tgt'|'txt'|'ball', x, y, text}] }) */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;
  function el(n, a, p, txt) {
    const e = document.createElementNS(NS, n);
    for (const k in a) e.setAttribute(k, a[k]);
    if (txt != null) e.textContent = txt;
    if (p) p.appendChild(e);
    return e;
  }
  const COL = { move: '#cfe0ff', rmove: '#ffc9cb', pass: '#ffe14d', fly: '#ffffff' };
  window.D = function (id, o) {
    const host = document.getElementById(id);
    if (!host) return;
    const cols = 7, y0 = o.y0, y1 = o.y1, c = o.cell || 26, pad = 5, top = y0 === 0 ? 13 : pad;
    const rows = y1 - y0 + 1, W = cols * c + pad * 2, H = rows * c + top + pad, u = 'd' + (uid++);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
    const X = (x) => pad + (x + 0.5) * c, Y = (y) => top + (y - y0 + 0.5) * c;
    const defs = el('defs', {}, svg);
    for (const k in COL) {
      const m = el('marker', { id: `${u}-${k}`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5.2, markerHeight: 5.2, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0.8 L10,5 L0,9.2 z', fill: COL[k] }, m);
    }
    el('rect', { x: 0, y: 0, width: W, height: H, rx: 6, fill: '#123f25' }, svg);
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++)
      el('rect', { x: pad + q * c, y: top + r * c, width: c, height: c, fill: (r + q + y0) % 2 ? '#1f7a3f' : '#23864a', stroke: 'rgba(255,255,255,.14)', 'stroke-width': 0.6 }, svg);
    if (y0 === 0) el('rect', { x: pad + 2 * c, y: top - 8, width: 3 * c, height: 8, fill: 'rgba(255,255,255,.12)', stroke: '#fff', 'stroke-width': 1.5, rx: 1.5 }, svg);
    if (y0 <= 4 && y1 >= 5) el('line', { x1: pad, x2: W - pad, y1: top + (5 - y0) * c, y2: top + (5 - y0) * c, stroke: 'rgba(255,255,255,.75)', 'stroke-width': 1.3 }, svg);
    const lineAt = (row, old) => {
      const ly = top + (row - y0) * c;
      if (!old) el('rect', { x: pad, y: top, width: cols * c, height: ly - top, fill: 'rgba(245,165,36,.34)' }, svg);
      el('line', { x1: pad - 3, x2: W - pad + 3, y1: ly, y2: ly, stroke: old ? 'rgba(255,255,255,.55)' : '#f5a524', 'stroke-width': old ? 1.2 : 2.2, 'stroke-dasharray': old ? '2 3' : '6 3' }, svg);
    };
    if (o.oldLine != null) lineAt(o.oldLine, true);
    if (o.line != null) lineAt(o.line, false);
    (o.marks || []).filter((m) => m.k === 'tgt').forEach((m) =>
      el('rect', { x: X(m.x) - c * 0.42, y: Y(m.y) - c * 0.42, width: c * 0.84, height: c * 0.84, rx: 4, fill: 'rgba(255,225,77,.22)', stroke: '#ffe14d', 'stroke-width': 1.5, 'stroke-dasharray': '3 2' }, svg));
    const R = c * 0.36;
    const arrow = (a) => {
      const x1 = X(a.f[0]), yA = Y(a.f[1]), x2 = X(a.to[0]), yB = Y(a.to[1]);
      const dx = x2 - x1, dy = yB - yA, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const s = (a.s != null ? a.s : 0.42) * c, e = (a.e != null ? a.e : 0.3) * c;
      const sx = x1 + ux * s, sy = yA + uy * s, ex = x2 - ux * e, ey = yB - uy * e;
      const cv = (a.curve || 0) * c, mx = (sx + ex) / 2 - uy * cv, my = (sy + ey) / 2 + ux * cv;
      const st = { d: `M${sx},${sy} Q${mx},${my} ${ex},${ey}`, fill: 'none', stroke: COL[a.k], 'stroke-linecap': 'round', 'marker-end': `url(#${u}-${a.k})` };
      st['stroke-width'] = a.k === 'pass' ? 2.2 : a.k === 'fly' ? 1.6 : 2;
      if (a.k === 'pass') st['stroke-dasharray'] = '5 3.4';
      if (a.k === 'fly') st['stroke-dasharray'] = '1.5 3.2';
      el('path', Object.assign({}, st, { stroke: 'rgba(0,0,0,.35)', 'stroke-width': st['stroke-width'] + 1.6, 'marker-end': '' }), svg);
      el('path', st, svg);
    };
    (o.arrows || []).forEach(arrow);
    const ball = (bx, by) => { el('circle', { cx: bx, cy: by, r: c * 0.15, fill: '#fff', stroke: '#0f1b2d', 'stroke-width': 1.3 }, svg); el('circle', { cx: bx, cy: by, r: c * 0.05, fill: '#0f1b2d' }, svg); };
    (o.tokens || []).forEach((t) => {
      const g = el('g', t.ghost ? { opacity: 0.42 } : {}, svg), cx = X(t.x), cy = Y(t.y), fill = t.t === 'b' ? '#2f6bff' : '#e5484d';
      if (t.ring) el('circle', { cx, cy, r: R + 3.4, fill: 'none', stroke: t.ring === 'ok' ? '#5dffa9' : '#ffb020', 'stroke-width': 2 }, g);
      el('circle', { cx, cy: cy + 1.2, r: R, fill: 'rgba(0,0,0,.35)' }, g);
      el('circle', Object.assign({ cx, cy, r: R, fill, stroke: '#fff', 'stroke-width': 1.5 }, t.ghost ? { 'stroke-dasharray': '2.5 2' } : {}), g);
      el('text', { x: cx, y: cy + c * 0.15, 'text-anchor': 'middle', 'font-family': "'Barlow Condensed', sans-serif", 'font-weight': 700, 'font-size': c * 0.44, fill: '#fff' }, g, t.n);
      if (t.lock) { el('rect', { x: cx + R * 0.35, y: cy - R * 1.25, width: c * 0.3, height: c * 0.26, rx: 1.5, fill: '#0f1b2d', stroke: '#fff', 'stroke-width': 0.8 }, g); el('path', { d: `M${cx + R * 0.35 + c * 0.07},${cy - R * 1.25} v-${c * 0.07} a${c * 0.08},${c * 0.08} 0 0 1 ${c * 0.16},0 v${c * 0.07}`, fill: 'none', stroke: '#fff', 'stroke-width': 1 }, g); }
      if (t.ball) ball(cx + R * 0.82, cy + R * 0.82);
    });
    const pill = (m, bg, fg, label) => {
      const fs = c * 0.34, w = label.length * fs * (/[^\x00-\x7f]/.test(label) ? 1.02 : 0.56) + 8, h = fs + 5;
      let px = Math.max(pad + 1, Math.min(W - pad - w - 1, X(m.x) - w / 2));
      el('rect', { x: px, y: Y(m.y) - h / 2, width: w, height: h, rx: h / 2, fill: bg, stroke: 'rgba(0,0,0,.25)', 'stroke-width': 0.6 }, svg);
      el('text', { x: px + w / 2, y: Y(m.y) + fs * 0.36, 'text-anchor': 'middle', 'font-family': "'Barlow Condensed','Noto Sans JP',sans-serif", 'font-weight': 700, 'font-size': fs, 'letter-spacing': '.04em', fill: fg }, svg, label);
    };
    (o.marks || []).forEach((m) => {
      const cx = X(m.x), cy = Y(m.y), r = c * 0.2;
      if (m.k === 'x') { el('circle', { cx, cy, r, fill: '#e5484d', stroke: '#fff', 'stroke-width': 1.3 }, svg); el('path', { d: `M${cx - r * 0.45},${cy - r * 0.45} l${r * 0.9},${r * 0.9} M${cx + r * 0.45},${cy - r * 0.45} l${-r * 0.9},${r * 0.9}`, stroke: '#fff', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, svg); }
      if (m.k === 'ok') { el('circle', { cx, cy, r, fill: '#12915a', stroke: '#fff', 'stroke-width': 1.3 }, svg); el('path', { d: `M${cx - r * 0.5},${cy} l${r * 0.36},${r * 0.4} l${r * 0.62},${-r * 0.78}`, fill: 'none', stroke: '#fff', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg); }
      if (m.k === 'off') pill(m, '#f5a524', '#3a2500', m.text || 'OFFSIDE');
      if (m.k === 'on') pill(m, '#12915a', '#fff', m.text || 'ONSIDE');
      if (m.k === 'txt') pill(m, 'rgba(11,21,38,.88)', '#fff', m.text);
      if (m.k === 'ball') ball(cx, cy);
    });
    host.appendChild(svg);
  };
})();
