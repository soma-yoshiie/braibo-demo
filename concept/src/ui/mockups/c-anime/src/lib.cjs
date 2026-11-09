let _id = 0; const uid = (p = 'i') => p + (++_id);
const NAVY = '#151a2d', GOLD = '#ffd34d';
const X0 = 34, Y0 = 84, C = 46;
const cx = x => X0 + x * C + C / 2, cy = y => Y0 + y * C + C / 2;
const T = {
  blue: { hair: '#1c46c8', hairHi: '#8fe3ff', rim: '#9ceaff', b1: '#d6f8ff', b2: '#25a4ff', b3: '#0a45b8', jer: '#1e90ff', jerD: '#0a4fc2', main: '#1e90ff', light: '#00c2ff', glow: '#00c2ff' },
  red: { hair: '#a10f24', hairHi: '#ff7a4a', rim: '#ff9a6a', b1: '#fff0c4', b2: '#ff5a2a', b3: '#b3101e', jer: '#ff3b3b', jerD: '#b81224', main: '#ff3b3b', light: '#ff8a00', glow: '#ff6a2a' },
};
const HAIR = {
  ST: { rx: 16.5,
    back: ['M30 54 L21 41 L26 37 L14 24 L31 29 L28 10 L41 22 L49 0 L58 21 L70 8 L70 28 L87 21 L75 36 L80 42 L70 54 Z'],
    front: ['M30 49 L30 33 Q50 20 70 33 L70 49 L64 39 L57 48 L50 36 L43 48 L36 39 Z'] },
  WG: { rx: 16,
    back: ['M31 48 C20 34 26 14 47 13 C66 11 80 24 73 42 L70 52 Z', 'M30 40 C14 38 4 52 -6 70 C8 62 18 64 27 60 C21 54 30 54 34 52 Z'],
    front: ['M29 49 C26 30 44 18 63 23 C73 28 75 40 70 50 C65 39 52 34 40 41 C36 44 34 47 29 49 Z', 'M62 22 C78 22 88 32 82 48 C81 38 74 31 66 30 Z'] },
  LS: { rx: 16.5,
    back: ['M22 64 C14 30 32 12 50 12 C68 12 86 30 78 64 L68 66 L67 50 L33 50 L32 66 Z'],
    front: ['M28 47 C27 27 40 18 50 18 C62 18 73 27 72 47 L66 40 L60 46 L54 38 L48 46 L42 38 L36 46 Z'], glasses: true },
  IC: { rx: 16,
    back: ['M30 52 C23 30 36 17 52 17 C69 17 79 32 72 52 Z', 'M49 20 C42 6 52 -2 62 4 C54 6 55 14 57 21 Z'],
    front: ['M29 50 C27 31 44 21 65 24 C55 28 44 32 38 44 C36 48 34 50 29 50 Z', 'M64 24 C74 28 75 41 71 51 L66 40 Z'] },
  DF: { rx: 19.5,
    back: ['M26 46 L24 32 C24 20 38 15 50 15 C62 15 76 20 76 32 L74 46 Z'],
    front: ['M27 41 L26 30 C26 20 38 17 50 17 C62 17 74 20 74 30 L73 41 L69 34 Q50 27 31 34Z'],
    extra: (c) => `<path d="M73 38 L93 31 L88 41 L95 48 L73 46Z" fill="#fff" stroke="${NAVY}" stroke-width="2.2" stroke-linejoin="round"/><path d="M28 35 Q50 29 72 35 L72 44 Q50 38 28 44Z" fill="#fff" stroke="${NAVY}" stroke-width="2.2" stroke-linejoin="round"/><path d="M28 39.5 Q50 33.5 72 39.5" stroke="${c.main}" stroke-width="3" fill="none"/>` },
};

function ball(x, y, r) {
  const id = uid('bl');
  const pent = [0, 1, 2, 3, 4].map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return `${(x + Math.cos(a) * r * .36).toFixed(1)},${(y + Math.sin(a) * r * .36).toFixed(1)}`; }).join(' ');
  const spokes = [0, 1, 2, 3, 4].map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return `<path d="M${(x + Math.cos(a) * r * .36).toFixed(1)} ${(y + Math.sin(a) * r * .36).toFixed(1)} L${(x + Math.cos(a) * r * .78).toFixed(1)} ${(y + Math.sin(a) * r * .78).toFixed(1)}" stroke="${NAVY}" stroke-width="${(r * .09).toFixed(2)}"/><circle cx="${(x + Math.cos(a + .63) * r * .98).toFixed(1)}" cy="${(y + Math.sin(a + .63) * r * .98).toFixed(1)}" r="${(r * .24).toFixed(1)}" fill="${NAVY}"/>`; }).join('');
  return `<g><defs><radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#f1f4ff"/><stop offset="1" stop-color="#b5bfdc"/></radialGradient><clipPath id="${id}c"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath></defs>
  <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id})"/><g clip-path="url(#${id}c)">${spokes}<polygon points="${pent}" fill="${NAVY}"/></g>
  <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${NAVY}" stroke-width="${(r * .16).toFixed(2)}"/></g>`;
}


function eyes(c, role, id, small) {
  const stern = role === 'DF' || role === 'IC';
  const by = stern ? [41.5, 45.8] : [43.2, 44.6]; // outer, inner brow y
  const bw = small ? 3.2 : 2.9;
  const brows = `<path d="M30.5 ${by[0]} L46 ${by[1]}" stroke="${NAVY}" stroke-width="${bw}" stroke-linecap="round"/><path d="M69.5 ${by[0]} L54 ${by[1]}" stroke="${NAVY}" stroke-width="${bw}" stroke-linecap="round"/>`;
  if (small) return `<path d="M34 ${stern ? 50.5 : 50} L46 ${stern ? 51.5 : 51.4}" stroke="${NAVY}" stroke-width="3.6" stroke-linecap="round"/><path d="M66 ${stern ? 50.5 : 50} L54 ${stern ? 51.5 : 51.4}" stroke="${NAVY}" stroke-width="3.6" stroke-linecap="round"/>` + brows;
  const eye = (m) => { const X = x => m ? 100 - x : x; const iris = c.main;
    return `<g><path d="M${X(32)} 50 L${X(38)} 46 L${X(47)} 47.8 L${X(46)} 52.8 L${X(38)} 53.8Z" fill="#fff" stroke="${NAVY}" stroke-width="1.3" stroke-linejoin="round"/>
    <clipPath id="${id}e${m}"><path d="M${X(32)} 50 L${X(38)} 46 L${X(47)} 47.8 L${X(46)} 52.8 L${X(38)} 53.8Z"/></clipPath>
    <g clip-path="url(#${id}e${m})"><ellipse cx="${X(41.5)}" cy="50.2" rx="3.9" ry="4.6" fill="${iris}"/><ellipse cx="${X(41.5)}" cy="50.8" rx="2.2" ry="3" fill="${NAVY}"/><rect x="0" y="44" width="100" height="3" fill="#000" opacity=".18"/></g>
    <circle cx="${X(42.8)}" cy="48.8" r="1.2" fill="#fff"/><path d="M${X(31.5)} 50 L${X(38)} 45.6 L${X(47.5)} 47.4" fill="none" stroke="${NAVY}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></g>`; };
  return eye(0) + eye(1) + brows;
}
function bust(role, team, o = {}) {
  const c = T[team], id = uid('bu'), H = HAIR[role], rx = H.rx, sw = o.sw || 2.4;
  const skin = '#ffd9bb', skinSh = '#e9a888';
  const paths = a => a.map(d => `<path d="${d}"/>`).join('');
  const hairDraw = a => a.map(d => `<path d="${d}" fill="${c.hair}" stroke="${NAVY}" stroke-width="${sw}" stroke-linejoin="round"/>`).join('');
  const shade = (clip) => `<g clip-path="url(#${id}${clip})"><polygon points="0,0 40,0 30,100 0,100" fill="#000" opacity=".28"/><polygon points="68,0 100,0 100,100 76,100" fill="${c.rim}" opacity=".6"/><path d="M33 33 Q50 22 68 31" stroke="${c.hairHi}" stroke-width="4.5" stroke-linecap="round" fill="none" opacity=".85"/></g>`;
  const gl = H.glasses ? `<g><rect x="32" y="44" width="15" height="11" rx="3" fill="#1d2140" fill-opacity=".75" stroke="${NAVY}" stroke-width="2"/><rect x="53" y="44" width="15" height="11" rx="3" fill="#1d2140" fill-opacity=".75" stroke="${NAVY}" stroke-width="2"/><path d="M47 48 H53" stroke="${NAVY}" stroke-width="2"/><path d="M35 46 L40 46 M56 46 L61 46" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></g>` : eyes(c, role, id, o.small);
  return `<defs>
   <linearGradient id="${id}j" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.jer}"/><stop offset="1" stop-color="${c.jerD}"/></linearGradient>
   <clipPath id="${id}cb">${paths(H.back)}</clipPath><clipPath id="${id}cf">${paths(H.front)}</clipPath>
   <clipPath id="${id}h"><ellipse cx="50" cy="47" rx="${rx}" ry="19"/></clipPath>
   <clipPath id="${id}jc"><path d="M2 100 C4 84 22 77 38 72 L62 72 C78 77 96 84 98 100 Z"/></clipPath></defs>
  ${o.ext ? `<path d="M2 99 H98 V190 H2Z" fill="${c.jerD}"/><path d="M2 99 H98 V190 H2Z" fill="${c.jer}" opacity=".6"/><path d="M2 99 V190 M98 99 V190" stroke="${NAVY}" stroke-width="${sw}"/><path d="M50 90 V190" stroke="${NAVY}" stroke-width="0"/>` : ''}
  <path d="M2 100 C4 84 22 77 38 72 L62 72 C78 77 96 84 98 100 Z" fill="url(#${id}j)"/>
  <g clip-path="url(#${id}jc)"><polygon points="0,60 34,60 24,100 0,100" fill="#000" opacity=".26"/><polygon points="78,60 100,60 100,100 84,100" fill="${c.rim}" opacity=".55"/>
   <path d="M8 98 C11 88 20 82 30 78" stroke="#fff" stroke-width="3.2" fill="none"/><path d="M92 98 C89 88 80 82 70 78" stroke="#fff" stroke-width="3.2" fill="none"/></g>
  <path d="M2 100 C4 84 22 77 38 72 L62 72 C78 77 96 84 98 100" fill="none" stroke="${NAVY}" stroke-width="2.6" stroke-linejoin="round"/>
  <rect x="43" y="58" width="14" height="18" fill="${skin}" stroke="${NAVY}" stroke-width="2"/><rect x="43" y="60" width="14" height="6" fill="${skinSh}"/>
  <path d="M37 72 L50 90 L63 72 L57 70 L50 79 L43 70Z" fill="#fff" stroke="${NAVY}" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M43 70 L50 79 L57 70 Z" fill="${skin}"/>
  ${hairDraw(H.back)}${shade('cb')}
  <ellipse cx="${50 - rx}" cy="50" rx="3.4" ry="4.6" fill="${skin}" stroke="${NAVY}" stroke-width="2"/><ellipse cx="${50 + rx}" cy="50" rx="3.4" ry="4.6" fill="${skin}" stroke="${NAVY}" stroke-width="2"/>
  <ellipse cx="50" cy="47" rx="${rx}" ry="19" fill="${skin}" stroke="${NAVY}" stroke-width="${sw}"/>
  <g clip-path="url(#${id}h)"><polygon points="0,0 ${50 - rx + 6},0 ${50 - rx + 2},100 0,100" fill="${skinSh}" opacity=".85"/><rect x="0" y="62" width="100" height="10" fill="${skinSh}" opacity=".5"/></g>
  ${gl}
  <path d="M51 56 l-2.4 3.2 h2.4" stroke="${skinSh}" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="${role === 'DF' || role === 'IC' ? 'M45 62.5 H55' : 'M45.5 62 Q50 64.6 55 61.5'}" stroke="#b4574c" stroke-width="1.7" fill="none" stroke-linecap="round"/>
  ${hairDraw(H.front)}${H.front.length ? shade('cf') : ''}${H.extra ? H.extra(c) : ''}`;
}

// medallion in 0..100 space (ring r=47 at 50,50)
function medal(role, team, o = {}) {
  const c = T[team], id = uid('md');
  const rays = Array.from({ length: 14 }, (_, i) => { const a1 = i * 2 * Math.PI / 14, a2 = a1 + Math.PI / 14; return `<polygon points="50,52 ${(50 + 80 * Math.cos(a1)).toFixed(1)},${(52 + 80 * Math.sin(a1)).toFixed(1)} ${(50 + 80 * Math.cos(a2)).toFixed(1)},${(52 + 80 * Math.sin(a2)).toFixed(1)}" fill="#fff" opacity=".2"/>`; }).join('');
  let s = `<defs>
   <radialGradient id="${id}bg" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="${c.b1}"/><stop offset=".45" stop-color="${c.b2}"/><stop offset="1" stop-color="${c.b3}"/></radialGradient>
   <linearGradient id="${id}rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c0"/><stop offset=".35" stop-color="${GOLD}"/><stop offset="1" stop-color="#e09a12"/></linearGradient>
   <linearGradient id="${id}gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
   <linearGradient id="${id}rb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.light}"/><stop offset="1" stop-color="${c.jerD}"/></linearGradient>
   <clipPath id="${id}c"><circle cx="50" cy="50" r="41.5"/></clipPath></defs>`;
  if (o.ball) s += `<circle cx="50" cy="50" r="66" fill="url(#aura)"/><g opacity=".9">${Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5; return `<polygon points="50,50 ${(50 + 70 * Math.cos(a - .09)).toFixed(1)},${(50 + 70 * Math.sin(a - .09)).toFixed(1)} ${(50 + 70 * Math.cos(a + .09)).toFixed(1)},${(50 + 70 * Math.sin(a + .09)).toFixed(1)}" fill="#fff6b0" opacity=".28"/>`; }).join('')}</g>`;
  if (o.selected) s += `<circle cx="50" cy="50" r="58" fill="none" stroke="${NAVY}" stroke-width="9"/><circle cx="50" cy="50" r="58" fill="none" stroke="#fff" stroke-width="4.5"/><circle cx="50" cy="50" r="58" fill="none" stroke="${GOLD}" stroke-width="4.5" stroke-dasharray="26 12"/>`;
  s += `<ellipse cx="50" cy="104" rx="34" ry="5.5" fill="#000" opacity=".4" filter="url(#bl2)"/>
   <circle cx="50" cy="50" r="49" fill="${NAVY}"/><circle cx="50" cy="50" r="46.5" fill="url(#${id}rg)"/><circle cx="50" cy="50" r="43" fill="${NAVY}"/>
   <g clip-path="url(#${id}c)"><circle cx="50" cy="50" r="42" fill="url(#${id}bg)"/>${rays}<circle cx="50" cy="50" r="42" fill="url(#ht)" opacity=".35"/>
    <g transform="translate(1.5 9) scale(.97)">${bust(role, team, { small: true })}</g>
    <ellipse cx="38" cy="22" rx="30" ry="16" fill="url(#${id}gl)" transform="rotate(-24 38 22)" opacity=".55"/></g>
   <circle cx="50" cy="50" r="41.6" fill="none" stroke="#fff" stroke-width="1.3" opacity=".5" stroke-dasharray="70 400" stroke-dashoffset="-190"/>
   <circle cx="50" cy="50" r="46.5" fill="none" stroke="#fff" stroke-width="1.4" opacity=".6" stroke-dasharray="55 400" stroke-dashoffset="-200"/>`;
  s += `<g><circle cx="84" cy="17" r="15.5" fill="${NAVY}"/><circle cx="84" cy="17" r="12.6" fill="url(#${id}rg)"/><circle cx="84" cy="17" r="10.2" fill="${NAVY}"/><text x="84" y="23.4" text-anchor="middle" class="bebas" font-size="18" fill="#fff" transform="skewX(-8)" style="transform-box:fill-box"> </text>
    <text x="${84 - 1.8}" y="23.6" text-anchor="middle" class="bebas" font-size="18" fill="#fff">${o.num}</text></g>`;
  s += `<path d="M31 84 H74 L70 102 H27 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/><path d="M31 85.5 H72.4 L69 100.5 H28.6 Z" fill="url(#${id}rb)"/><path d="M31 85.5 H72.4 L71.6 89 H30.2Z" fill="#fff" opacity=".4"/><text x="50" y="98" text-anchor="middle" class="dela" font-size="12.5" fill="#fff" letter-spacing=".5">${role}</text>`;
  if (o.ball) s += `<g transform="translate(-1 0)">${ball(15, 78, 13)}</g>`;
  return s;
}
// place a medal centered at (x,y); s=scale (units->px). 96 units diameter
function token(x, y, role, team, num, o = {}) {
  const s = (o.size || 44.5) / 96;
  const op = o.ghost ? ' opacity=".6"' : '';
  let pre = '', post = '';
  if (o.ghost) pre = `<circle cx="${x}" cy="${y}" r="24.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="5 4"/>`;
  if (o.danger) pre = `<circle cx="${x}" cy="${y}" r="27" fill="none" stroke="#ff2a2a" stroke-width="3.5" opacity=".9" filter="url(#glow4)"/>`;
  return pre + `<g transform="translate(${x} ${y}) scale(${s}) translate(-50 -50)"${op}>${medal(role, team, { ...o, num })}</g>` + post;
}

function arrow(x1, y1, x2, y2, col, w = 7, head = 17) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const bx = x2 - ux * head, by = y2 - uy * head, hw = w * 1.1 + 4.5;
  const hp = `${x2},${y2} ${bx + nx * hw},${by + ny * hw} ${bx - nx * hw},${by - ny * hw}`;
  const sx = x2 - ux * (head - 3), sy = y2 - uy * (head - 3);
  return `<g><line x1="${x1}" y1="${y1}" x2="${sx}" y2="${sy}" stroke="${col}" stroke-width="${w + 12}" stroke-linecap="round" opacity=".6" filter="url(#glow4)"/>
   <line x1="${x1}" y1="${y1}" x2="${sx}" y2="${sy}" stroke="${NAVY}" stroke-width="${w + 5}" stroke-linecap="round"/><polygon points="${hp}" fill="${NAVY}" stroke="${NAVY}" stroke-width="5" stroke-linejoin="round"/>
   <line x1="${x1}" y1="${y1}" x2="${sx}" y2="${sy}" stroke="#fff" stroke-width="${w}" stroke-linecap="round"/><polygon points="${hp}" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></g>`;
}
function starburst(x, y, r1, r2, n, fill, stroke, sw = 3, rot = 0) {
  let p = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1; p.push(`${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`); }
  return `<polygon points="${p.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}
function star(x, y, r, fill = GOLD, sw = 1.4) {
  let p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; p.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`); }
  return `<polygon points="${p.join(' ')}" fill="${fill}" stroke="${NAVY}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}
function crest(team, x, y, s = 1) {
  const c = T[team], id = uid('cr');
  const emb = team === 'blue'
    ? `<path d="M6 -9 L-4 1 L1 1 L-5 11 L7 -1 L1 -1 Z" fill="#fff" stroke="${NAVY}" stroke-width="1.4" stroke-linejoin="round"/>`
    : `<path d="M0 -11 C4 -5 8 -2 7 4 C6 9 2 11 0 11 C-6 11 -8 5 -5 0 C-4 3 -2 3 -2 0 C-2 -4 0 -7 0 -11Z" fill="#ffe27a" stroke="${NAVY}" stroke-width="1.4" stroke-linejoin="round"/><path d="M0 2 C3 4 3 8 0 9 C-3 8 -3 5 0 2Z" fill="#ff7a1a"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.light}"/><stop offset="1" stop-color="${c.jerD}"/></linearGradient></defs>
  <path d="M-13 -14 H13 V3 C13 11 6 16 0 18 C-6 16 -13 11 -13 3Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M-11 -12 H11 V3 C11 9.5 5 14 0 15.8 C-5 14 -11 9.5 -11 3Z" fill="url(#${id})" stroke="${GOLD}" stroke-width="1.8"/>${emb}
  <path d="M-11 -12 H11 V-5 C4 -3 -4 -3 -11 -5Z" fill="#fff" opacity=".35"/></g>`;
}

const defs = () => `<defs>
 <filter id="bl2" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>
 <filter id="glow4" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>
 <filter id="blur6"><feGaussianBlur stdDeviation="6"/></filter>
 <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 -.2"/></filter>
 <pattern id="ht" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="2.5" cy="2.5" r="1.1" fill="#fff"/></pattern>
 <pattern id="htD" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="3" cy="3" r="1.4" fill="#0a0f24"/></pattern>
 <pattern id="haz" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="14" height="14" fill="#ffd34d"/><rect width="7" height="14" fill="${NAVY}"/></pattern>
 <radialGradient id="aura"><stop offset="0" stop-color="#fff7b8" stop-opacity=".95"/><stop offset=".45" stop-color="#ffd34d" stop-opacity=".55"/><stop offset="1" stop-color="#ffb000" stop-opacity="0"/></radialGradient>
 <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".4" stop-color="#ffd34d"/><stop offset="1" stop-color="#e8960c"/></linearGradient>
</defs>`;

const css = `html,body{margin:0;width:390px;height:844px;overflow:hidden;background:#0c1330}
svg{display:block;position:absolute;left:0;top:0}
text{font-family:'M PLUS Rounded 1c',sans-serif;font-weight:800}
.dela{font-family:'Dela Gothic One','M PLUS Rounded 1c',sans-serif!important;font-weight:400!important}
.bebas{font-family:'Bebas Neue',sans-serif!important;font-weight:400!important}
.ol{paint-order:stroke;stroke:${NAVY};stroke-linejoin:round}`;
const page = (title, body) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=390"><title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Dela+Gothic+One&family=M+PLUS+Rounded+1c:wght@700;800&display=swap" rel="stylesheet">
<style>${css}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">${defs()}${body}</svg></body></html>`;

// ---- pitch (background stadium + grid) ----
function pitch() {
  const px = X0, py = Y0, pw = 7 * C, ph = 10 * C;
  let s = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b3a9c"/><stop offset=".25" stop-color="#162766"/><stop offset="1" stop-color="#0b1130"/></linearGradient>
  <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2bd66b"/><stop offset="1" stop-color="#0f9a4a"/></linearGradient>
  <radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#03301a" stop-opacity=".45"/></radialGradient>
  <clipPath id="pc"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="6"/></clipPath>
  <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  <rect width="390" height="844" fill="url(#sky)"/>
  <ellipse cx="40" cy="0" rx="150" ry="90" fill="#7fd0ff" opacity=".45" filter="url(#blur6)"/><ellipse cx="350" cy="0" rx="150" ry="90" fill="#ffb27a" opacity=".38" filter="url(#blur6)"/>
  <polygon points="10,0 70,0 150,330 -40,330" fill="url(#beam)" opacity=".34"/><polygon points="320,0 380,0 450,330 270,330" fill="url(#beam)" opacity=".3"/>
  <rect x="0" y="62" width="390" height="500" fill="url(#ht)" opacity=".1"/>
  <g><circle cx="30" cy="6" r="26" fill="#fff" opacity=".5" filter="url(#blur6)"/><circle cx="360" cy="6" r="26" fill="#fff" opacity=".45" filter="url(#blur6)"/>
  <path d="M30 -14 V26 M10 6 H50" stroke="#fff" stroke-width="2" opacity=".6"/><path d="M360 -14 V26 M340 6 H380" stroke="#fff" stroke-width="2" opacity=".55"/></g>
  <g opacity=".95"><rect x="0" y="70" width="${px}" height="490" fill="#0f1738"/><rect x="${px + pw}" y="70" width="${390 - px - pw}" height="490" fill="#0f1738"/>
   <rect x="0" y="70" width="${px}" height="490" fill="url(#ht)" opacity=".22"/><rect x="${px + pw}" y="70" width="${390 - px - pw}" height="490" fill="url(#ht)" opacity=".22"/></g>
  ${Array.from({ length: 17 }, (_, i) => { const y = 78 + i * 29; const col = ['#ff5a5a', '#4cc3ff', '#ffd34d', '#fff'][i % 4]; return `<rect x="${px - 11}" y="${y}" width="5" height="16" rx="2" fill="${col}" opacity=".9" stroke="${NAVY}" stroke-width="1"/><rect x="${px + pw + 6}" y="${y}" width="5" height="16" rx="2" fill="${col}" opacity=".9" stroke="${NAVY}" stroke-width="1"/>`; }).join('')}
  <rect x="${px - 3}" y="${py - 3}" width="${pw + 6}" height="${ph + 6}" rx="9" fill="${NAVY}"/>
  <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="6" fill="url(#grass)"/>
  <g clip-path="url(#pc)">
   ${Array.from({ length: 10 }, (_, i) => `<rect x="${px}" y="${py + i * C}" width="${pw}" height="${C}" fill="${i % 2 ? '#000' : '#fff'}" opacity="${i % 2 ? .07 : .09}"/>`).join('')}
   <rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="#000" filter="url(#grain)" opacity=".5"/>
   ${Array.from({ length: 6 }, (_, i) => `<line x1="${px + (i + 1) * C}" y1="${py}" x2="${px + (i + 1) * C}" y2="${py + ph}" stroke="#fff" stroke-opacity=".16" stroke-width="1"/>`).join('')}
   ${Array.from({ length: 9 }, (_, i) => `<line x1="${px}" y1="${py + (i + 1) * C}" x2="${px + pw}" y2="${py + (i + 1) * C}" stroke="#fff" stroke-opacity=".16" stroke-width="1"/>`).join('')}
   <g fill="none" stroke="#fff" stroke-width="2.6" stroke-opacity=".95" stroke-linejoin="round">
    <line x1="${px}" y1="${py + 5 * C}" x2="${px + pw}" y2="${py + 5 * C}"/><circle cx="${px + pw / 2}" cy="${py + 5 * C}" r="${C * 1.05}"/>
    <rect x="${px + C}" y="${py - 3}" width="${5 * C}" height="${1.5 * C + 3}"/><rect x="${px + 2 * C}" y="${py - 3}" width="${3 * C}" height="${.6 * C + 3}"/>
    <rect x="${px + C}" y="${py + ph - 1.5 * C}" width="${5 * C}" height="${1.5 * C + 3}"/><rect x="${px + 2 * C}" y="${py + ph - .6 * C}" width="${3 * C}" height="${.6 * C + 3}"/>
    <path d="M${px + 2.55 * C} ${py + 1.5 * C} A${C * .95} ${C * .95} 0 0 0 ${px + 4.45 * C} ${py + 1.5 * C}"/><path d="M${px + 2.55 * C} ${py + ph - 1.5 * C} A${C * .95} ${C * .95} 0 0 1 ${px + 4.45 * C} ${py + ph - 1.5 * C}"/>
   </g>
   <circle cx="${px + pw / 2}" cy="${py + 5 * C}" r="3.2" fill="#fff"/><circle cx="${px + pw / 2}" cy="${py + 1 * C}" r="2.6" fill="#fff"/><circle cx="${px + pw / 2}" cy="${py + ph - 1 * C}" r="2.6" fill="#fff"/>
   <rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="url(#vig)"/>
   <rect x="${px}" y="${py}" width="${pw}" height="${C * 3}" fill="#fff" opacity=".07"/>
  </g>
  <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="6" fill="none" stroke="#fff" stroke-width="2.6"/>`;
  const goal = (y, up) => `<g><rect x="${px + 2 * C - 2}" y="${up ? y - 12 : y}" width="${3 * C + 4}" height="12" rx="3" fill="#0b1230" stroke="${NAVY}" stroke-width="3"/>
    <rect x="${px + 2 * C}" y="${up ? y - 10 : y + 2}" width="${3 * C}" height="11" fill="url(#htD)" opacity=".0"/>
    ${Array.from({ length: 13 }, (_, i) => `<line x1="${px + 2 * C + 4 + i * (3 * C - 8) / 12}" y1="${up ? y - 10 : y + 2}" x2="${px + 2 * C + 4 + i * (3 * C - 8) / 12}" y2="${up ? y - 2 : y + 10}" stroke="#cfe2ff" stroke-opacity=".55" stroke-width=".8"/>`).join('')}
    <rect x="${px + 2 * C - 2}" y="${up ? y - 12 : y}" width="${3 * C + 4}" height="12" rx="3" fill="none" stroke="#fff" stroke-width="2.4"/></g>`;
  return s + goal(py, true) + goal(py + ph, false);
}
module.exports = { NAVY, GOLD, X0, Y0, C, cx, cy, T, bust, medal, token, ball, arrow, starburst, star, crest, defs, page, pitch, uid };
