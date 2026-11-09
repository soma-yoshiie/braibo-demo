const L = require('./lib.cjs'); const { icon } = require('./icons.cjs');
const { NAVY, GOLD, cx, cy, X0, Y0, C, T } = L;
const fs = require('fs');
let b = L.pitch();

// ---------- move tiles ----------
const tiles = [[5, 3], [5, 2], [6, 3], [6, 4], [6, 5], [4, 4], [5, 5], [4, 3]];
const wg = [5, 4];
function tile(x, y) {
  const enemy = x === 4 && y === 3;
  const px = X0 + x * C + 2.5, py = Y0 + y * C + 2.5, w = C - 5;
  const ang = Math.atan2(y - wg[1], x - wg[0]) * 180 / Math.PI;
  const fill = enemy ? 'url(#tE)' : 'url(#tM)';
  let s = `<g><rect x="${px - 1}" y="${py - 1}" width="${w + 2}" height="${w + 2}" rx="8" fill="${enemy ? '#ff3a1a' : '#00e5ff'}" opacity=".55" filter="url(#glow4)"/>
   <rect x="${px}" y="${py}" width="${w}" height="${w}" rx="7" fill="${fill}" stroke="${NAVY}" stroke-width="4.5"/>
   <rect x="${px}" y="${py}" width="${w}" height="${w}" rx="7" fill="none" stroke="${enemy ? '#ffe25a' : '#fff'}" stroke-width="2.4"/>
   <path d="M${px + 5} ${py + 3} H${px + w - 5} Q${px + w - 3} ${py + 3} ${px + w - 3} ${py + 6} V${py + w * .42} Q${px + w / 2} ${py + w * .52} ${px + 3} ${py + w * .42} V${py + 6} Q${px + 3} ${py + 3} ${px + 5} ${py + 3}Z" fill="#fff" opacity=".42"/>`;
  if (!enemy && !(x === 5 && y === 3)) s += `<g transform="translate(${px + w / 2} ${py + w / 2 + 7}) rotate(${ang + 90}) scale(.82)"><path d="M0 -11 L9 -1 H4 V9 H-4 V-1 H-9Z" fill="#fff" stroke="${NAVY}" stroke-width="3.6" stroke-linejoin="round" paint-order="stroke"/><path d="M0 -11 L9 -1 H4 V9 H-4 V-1 H-9Z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M0 -6.5 L4.5 -1.5 H1.8 V5 H-1.8 V-1.5 H-4.5Z" fill="#1ab4ff"/></g>`;
  return s + '</g>';
}
b += `<defs><linearGradient id="tM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6f6ff"/><stop offset=".5" stop-color="#3fd6ff"/><stop offset="1" stop-color="#0f9be8"/></linearGradient>
 <linearGradient id="tE" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc08a"/><stop offset=".5" stop-color="#ff5a2a"/><stop offset="1" stop-color="#c8141e"/></linearGradient></defs>`;
b += tiles.map(([x, y]) => tile(x, y)).join('');

// ---------- offside line ----------
const oy = Y0 + 2 * C;
b += `<g><line x1="${X0}" y1="${oy}" x2="${X0 + 7 * C}" y2="${oy}" stroke="#ff3030" stroke-width="9" opacity=".55" filter="url(#glow4)"/>
 <rect x="${X0}" y="${oy - 4}" width="${7 * C}" height="8" fill="${NAVY}"/><rect x="${X0}" y="${oy - 2.6}" width="${7 * C}" height="5.2" fill="url(#haz)"/>
 <line x1="${X0 + 7}" y1="${oy - 26}" x2="${X0 + 7}" y2="${oy}" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/><line x1="${X0 + 7}" y1="${oy - 26}" x2="${X0 + 7}" y2="${oy}" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
 <path d="M${X0 + 7} ${oy - 26} H${X0 + 108} L${X0 + 100} ${oy - 17.5} L${X0 + 108} ${oy - 9} H${X0 + 7}Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="3.6" stroke-linejoin="round"/>
 <path d="M${X0 + 7} ${oy - 26} H${X0 + 108} L${X0 + 100} ${oy - 17.5} L${X0 + 108} ${oy - 9} H${X0 + 7}Z" fill="url(#gold)"/>
 <path d="M${X0 + 7} ${oy - 26} H${X0 + 108} L${X0 + 106} ${oy - 22} H${X0 + 7}Z" fill="#fff" opacity=".5"/>
 <text x="${X0 + 52}" y="${oy - 12.3}" text-anchor="middle" font-size="9.6" fill="${NAVY}" letter-spacing=".3">オフサイドライン</text></g>`;

// ---------- ST move arrow + ghost ----------
const A = [cx(3), cy(2)], B = [cx(4), cy(1)];
const dd = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / dd, uy = (B[1] - A[1]) / dd;

// ---------- tokens (y order) ----------
const toks = [
 ['ST', 'red', 9, 4, 7], ['WG', 'red', 7, 1, 6], ['LS', 'red', 10, 2, 3], ['IC', 'red', 6, 4, 3, { danger: 1 }], ['DF', 'red', 4, 3, 1],
 ['ST', 'blue', 9, 3, 2], ['LS', 'blue', 10, 2, 5], ['IC', 'blue', 6, 3, 6], ['DF', 'blue', 4, 3, 8],
];
b += toks.sort((a, c) => a[4] - c[4]).map(t => L.token(cx(t[3]), cy(t[4]), t[0], t[1], t[2], t[5] || {})).join('');
// ghost ST at (4,1)
b += L.token(B[0], B[1], 'ST', 'blue', 9, { ghost: 1, size: 42 });
b += L.arrow(A[0] + ux * 19, A[1] + uy * 19, B[0] - ux * 17, B[1] - uy * 17, '#00c2ff', 5, 13);
// WG selected, ball
const W = [cx(5), cy(4)];
// bounce shadow + token + pointer
b += L.token(W[0], W[1], 'WG', 'blue', 7, { ball: 1, selected: 1, size: 49 });

// ---------- enemy "!" marker ----------
const ex = X0 + 4 * C + 7, ey = Y0 + 3 * C + 7;
b += `<g transform="translate(${ex} ${ey})"><path d="M0 -11 L11 8 H-11Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="5" stroke-linejoin="round"/><path d="M0 -11 L11 8 H-11Z" fill="url(#gold)" stroke="#ff3a1a" stroke-width="1.6" stroke-linejoin="round"/>
 <path d="M-1.9 -4 H1.9 L1.2 3 H-1.2Z" fill="${NAVY}"/><circle cx="0" cy="5.3" r="1.5" fill="${NAVY}"/></g>`;

// ---------- pass arc ----------
const P0 = [W[0], W[1]], P2 = [cx(4), cy(1)], Cc = [cx(6) + 30, cy(1) + 4];
const q = (t) => [(1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * Cc[0] + t * t * P2[0], (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * Cc[1] + t * t * P2[1]];
const sub = (t0, t1) => { const a = q(t0), c = q(t1), m = q((t0 + t1) / 2); const ctl = [2 * m[0] - (a[0] + c[0]) / 2, 2 * m[1] - (a[1] + c[1]) / 2]; return { a, c, ctl }; };
const s = sub(0.2, 0.84), tip = q(0.9), pre = q(0.8);
const dir = Math.atan2(tip[1] - pre[1], tip[0] - pre[0]);
const arcd = `M${s.a[0].toFixed(1)} ${s.a[1].toFixed(1)} Q${s.ctl[0].toFixed(1)} ${s.ctl[1].toFixed(1)} ${s.c[0].toFixed(1)} ${s.c[1].toFixed(1)}`;
const lab = q(0.5);
b += `<g><path d="${arcd}" fill="none" stroke="#fff200" stroke-width="12" stroke-linecap="round" opacity=".35" filter="url(#glow4)"/>
 <path d="${arcd}" fill="none" stroke="${NAVY}" stroke-width="10.5" stroke-linecap="round" stroke-dasharray="0.1 12.5"/>
 <path d="${arcd}" fill="none" stroke="#fff" stroke-width="6.4" stroke-linecap="round" stroke-dasharray="0.1 12.5"/>
 <g transform="translate(${tip[0].toFixed(1)} ${tip[1].toFixed(1)}) rotate(${(dir * 180 / Math.PI).toFixed(1)})"><path d="M0 0 L-19 -13 L-14 0 L-19 13Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="5" stroke-linejoin="round"/><path d="M0 0 L-19 -13 L-14 0 L-19 13Z" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></g></g>`;
const lx = 331, ly = 122;
b += `<g transform="translate(${lx} ${ly}) rotate(-8) scale(.85)">${L.starburst(0, 0, 29, 21, 12, 'url(#gold)', NAVY, 3.2)}<circle r="17.5" fill="${NAVY}" opacity=".0"/>
 <text y="-9" text-anchor="middle" font-size="7.6" fill="${NAVY}" letter-spacing=".6">PASS</text>
 <text x="-1" y="9" text-anchor="middle" class="bebas ol" font-size="24" fill="#fff" stroke-width="3.6" transform="skewX(-8)">72<tspan font-size="15">%</tspan></text></g>`;

// ---------- selection pointer (above WG) ----------
b += `<g transform="translate(${W[0]} ${W[1] - 46})"><ellipse cx="0" cy="26" rx="9" ry="2.5" fill="#000" opacity=".25"/>
 <path d="M-9 -13 H9 L0 2Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="6" stroke-linejoin="round"/><path d="M-9 -13 H9 L0 2Z" fill="url(#gold)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
 <path d="M-16 -9 l-4 -3 M16 -9 l4 -3 M-17 -3 h-5 M17 -3 h5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".9"/></g>`;

// ---------- HUD ----------
const hud = () => `<g>
 <rect x="0" y="0" width="390" height="72" fill="url(#hudbg)"/><rect x="0" y="70" width="390" height="2" fill="${NAVY}"/>
 <defs><linearGradient id="hudbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1230" stop-opacity=".92"/><stop offset="1" stop-color="#0a1230" stop-opacity=".0"/></linearGradient>
  <linearGradient id="pB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4dd6ff"/><stop offset=".5" stop-color="#1e90ff"/><stop offset="1" stop-color="#0a4fc2"/></linearGradient>
  <linearGradient id="pR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffa24d"/><stop offset=".5" stop-color="#ff3b3b"/><stop offset="1" stop-color="#b3101e"/></linearGradient>
  <linearGradient id="tg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2be06a"/><stop offset=".7" stop-color="#b6ee2a"/><stop offset="1" stop-color="#ffd34d"/></linearGradient></defs>
 <!-- menu -->
 <circle cx="27" cy="27" r="19" fill="${NAVY}"/><circle cx="27" cy="27" r="16.5" fill="url(#gold)"/><circle cx="27" cy="27" r="13.6" fill="#232b57"/><ellipse cx="27" cy="21" rx="11" ry="6" fill="#fff" opacity=".18"/>
 <g stroke="#fff" stroke-width="2.8" stroke-linecap="round"><line x1="20.5" y1="21.5" x2="33.5" y2="21.5"/><line x1="20.5" y1="27" x2="33.5" y2="27"/><line x1="20.5" y1="32.5" x2="33.5" y2="32.5"/></g>
 <!-- score plate -->
 <path d="M62 7 H201 L195 47 H56Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="6" stroke-linejoin="round"/><path d="M193 7 H328 L322 47 H187Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="6" stroke-linejoin="round"/>
 <path d="M62 7 H199 L193 47 H56Z" fill="url(#pB)"/><path d="M197 7 H328 L322 47 H191Z" fill="url(#pR)"/>
 <path d="M62 7 H199 L198 13 H61Z" fill="#fff" opacity=".4"/><path d="M197 7 H328 L327 13 H196Z" fill="#fff" opacity=".35"/>
 <path d="M62 7 H199 L193 47 H56Z" fill="url(#ht)" opacity=".13"/>
 <path d="M62 7 H328 L322 47 H56Z" fill="none" stroke="${GOLD}" stroke-width="2"/>
 <path d="M200.5 5 L206 5 L197 49 L191.5 49Z" fill="${NAVY}"/><path d="M200 7 L204 7 L196 47 L192 47Z" fill="url(#gold)"/>
 ${L.crest('blue', 82, 27, .95)}${L.crest('red', 304, 27, .95)}
 <text x="124" y="32" text-anchor="middle" class="dela ol" font-size="15" fill="#fff" stroke-width="3.6" letter-spacing="1">蒼嵐</text>
 <text x="263" y="32" text-anchor="middle" class="dela ol" font-size="15" fill="#fff" stroke-width="3.6" letter-spacing="1">紅蓮</text>
 <text x="171" y="39" text-anchor="middle" class="bebas ol" font-size="38" fill="#fff" stroke-width="5" transform="translate(0 0)" >1</text>
 <text x="224" y="39" text-anchor="middle" class="bebas ol" font-size="38" fill="#fff" stroke-width="5">0</text>
 <!-- turn -->
 <path d="M336 7 H382 L378 47 H332Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="6" stroke-linejoin="round"/><path d="M336 7 H382 L378 47 H332Z" fill="#232b57"/><path d="M336 7 H382 L381.5 12 H335.4Z" fill="url(#gold)"/>
 <text x="356" y="27" text-anchor="middle" font-size="7.8" fill="${GOLD}" letter-spacing="1" class="bebas" style="font-size:10px">TURN</text>
 <text x="356" y="43" text-anchor="middle" class="bebas" font-size="21" fill="#fff"><tspan>7</tspan><tspan fill="#8f9ed6" font-size="14">/20</tspan></text>
 <!-- timer -->
 <path d="M60 51 H322 L319 68 H57Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>
 <path d="M96 54.5 H318.5 L316.4 64.5 H94Z" fill="#0b1026"/>
 <path d="M96 54.5 H${96 + (318.5 - 96) * 42 / 60 - 1} L${94 + (316.4 - 94) * 42 / 60 - 1.4} 64.5 H94Z" fill="url(#tg)"/>
 <path d="M96 54.5 H${96 + (318.5 - 96) * 42 / 60 - 1} L${96 + (318.5 - 96) * 42 / 60 - 1.6} 58 H95.2Z" fill="#fff" opacity=".5"/>
 ${[1, 2, 3, 4, 5].map(i => `<line x1="${96 + 222.5 * i / 6 + 1}" y1="54.5" x2="${94 + 222.4 * i / 6}" y2="64.5" stroke="${NAVY}" stroke-width="1.6" opacity=".8"/>`).join('')}
 <path d="M58 49 H100 L96 70 H54Z" fill="${NAVY}"/><path d="M60 51 H97.5 L94.6 67.5 H57Z" fill="url(#gold)"/>
 <circle cx="68" cy="59.5" r="5.8" fill="none" stroke="${NAVY}" stroke-width="1.8"/><path d="M68 56 V59.5 L70.5 61" stroke="${NAVY}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
 <text x="88" y="66" text-anchor="middle" class="bebas" font-size="20" fill="${NAVY}" transform="skewX(-8)" style="transform-origin:88px 60px"> </text>
 <text x="84" y="65.6" text-anchor="middle" class="bebas" font-size="19" fill="${NAVY}">42</text>
</g>`;
b += hud();

// ---------- bottom panel ----------
const pillDefs = ['move', 'pass', 'cross', 'shoot', 'keep'];
const labels = { move: '移動', pass: 'パス', cross: 'クロス', shoot: 'シュート', keep: 'キープ' };
const pc = { move: ['#7fe2ff', '#1e90ff', '#0a4fc2'], pass: ['#8dfab0', '#1fc86a', '#0a8a45'], cross: ['#ffe27a', '#ffa31a', '#d9690a'], shoot: ['#ffa08a', '#ff4a3d', '#b81224'], keep: ['#c9b0ff', '#8a5cff', '#4f2ab8'] };
let bp = `<defs>
 <linearGradient id="pn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26306a"/><stop offset="1" stop-color="#0c1230"/></linearGradient>
 <linearGradient id="cardbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a3578"/><stop offset="1" stop-color="#141b44"/></linearGradient>
 <linearGradient id="btn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff39a"/><stop offset=".3" stop-color="#ffd34d"/><stop offset=".62" stop-color="#ff9a1a"/><stop offset="1" stop-color="#f26a0a"/></linearGradient>
 <radialGradient id="cb" cx=".5" cy=".55" r=".7"><stop offset="0" stop-color="#d6f8ff"/><stop offset=".4" stop-color="#25a4ff"/><stop offset="1" stop-color="#0a45b8"/></radialGradient>
 ${pillDefs.map(k => `<linearGradient id="pl${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pc[k][0]}"/><stop offset=".5" stop-color="${pc[k][1]}"/><stop offset="1" stop-color="${pc[k][2]}"/></linearGradient>`).join('')}
 <clipPath id="cardclip"><path d="M30 574 H390 L372 712 H12Z"/></clipPath>
 <clipPath id="bustclip"><path d="M-40 470 H210 V712 H12 L30 574 L-40 574Z"/></clipPath></defs>
 <rect x="0" y="556" width="390" height="288" fill="url(#pn)"/><rect x="0" y="556" width="390" height="288" fill="url(#ht)" opacity=".05"/>
 <rect x="0" y="553" width="390" height="5" fill="${NAVY}"/><rect x="0" y="555" width="390" height="3" fill="url(#gold)"/><rect x="0" y="558" width="390" height="2" fill="#fff" opacity=".18"/>`;
// card
bp += `<path d="M30 574 H390 L372 712 H12Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="9" stroke-linejoin="round"/>
 <g clip-path="url(#cardclip)"><rect x="0" y="560" width="390" height="160" fill="url(#cardbg)"/>
  <g transform="translate(90 650)">${Array.from({ length: 16 }, (_, i) => { const a1 = i * Math.PI / 8, a2 = a1 + Math.PI / 16; return `<polygon points="0,0 ${(300 * Math.cos(a1)).toFixed(0)},${(300 * Math.sin(a1)).toFixed(0)} ${(300 * Math.cos(a2)).toFixed(0)},${(300 * Math.sin(a2)).toFixed(0)}" fill="#fff" opacity=".07"/>`; }).join('')}</g>
  <path d="M0 560 H152 L126 720 H0Z" fill="url(#cb)"/>
  <g transform="translate(90 650)">${Array.from({ length: 14 }, (_, i) => { const a1 = i * 2 * Math.PI / 14, a2 = a1 + Math.PI / 14; return `<polygon points="0,0 ${(200 * Math.cos(a1)).toFixed(0)},${(200 * Math.sin(a1)).toFixed(0)} ${(200 * Math.cos(a2)).toFixed(0)},${(200 * Math.sin(a2)).toFixed(0)}" fill="#fff" opacity=".22"/>`; }).join('')}</g>
  <path d="M0 560 H152 L126 720 H0Z" fill="url(#ht)" opacity=".28"/>
  <path d="M152 560 L126 720" stroke="${NAVY}" stroke-width="6"/><path d="M155.5 560 L129.5 720" stroke="${GOLD}" stroke-width="2"/>
  <path d="M156 574 H390 L372 712 H129Z" fill="#0f1536" opacity=".55"/><path d="M156 574 H390 V578 H155.6Z" fill="#fff" opacity=".22"/>
 </g>
 <path d="M30 574 H390 L372 712 H12Z" fill="none" stroke="url(#gold)" stroke-width="3.6" stroke-linejoin="round"/>
 <g clip-path="url(#bustclip)"><g transform="translate(-12 520) scale(1.9)"><g>${L.bust('WG', 'blue')}</g></g></g>
 <path d="M12 712 H128" stroke="${GOLD}" stroke-width="0"/>`;
// rarity + title
bp += `${[0, 1, 2, 3].map(i => L.star(322 + i * 13, 586, 6.6)).join('')}
 <path d="M172 580 l4 -0 l-1.5 3 z" fill="${GOLD}"/>
 <text x="174" y="590.5" font-size="10.6" fill="${GOLD}" letter-spacing=".3">疾風のサイドアタッカー</text>
 <text x="172" y="621" class="dela ol" font-size="25" fill="#fff" stroke-width="5" letter-spacing="1">ウイング</text>
 <g transform="translate(294 620) skewX(-10)"><text class="bebas ol" x="0" y="0" font-size="36" fill="${GOLD}" stroke-width="5">7</text></g>
 <g transform="translate(332 620)"><path d="M0 -17 H31 L28 -3 H-3Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/><path d="M0 -17 H31 L28 -3 H-3Z" fill="url(#plmove)"/><text x="14.5" y="-6.5" text-anchor="middle" class="dela" font-size="10" fill="#fff">WG</text></g>`;
// skill button
bp += `<g><path d="M175 629 H356 L353 651 H172Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/><path d="M175 629 H356 L353 651 H172Z" fill="url(#btn)"/>
 <path d="M175 629 H356 L355 636 H174Z" fill="#fff" opacity=".5"/>
 <g transform="translate(190 640)">${L.starburst(0, 0, 11, 7, 8, '#fff', NAVY, 2)}<path d="M-4 0 L-1 3 L5 -3" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>
 <text x="207" y="644.6" font-size="12.5" fill="${NAVY}" letter-spacing=".5">パスマスター</text>
 <path d="M302 631 H353 L351.4 649 H300.6Z" fill="${NAVY}"/><text x="327" y="643.5" text-anchor="middle" class="bebas" font-size="12" fill="${GOLD}" letter-spacing="1.4">SKILL</text></g>`;
// stats
const stats = [['パス', 75], ['クロス', 85], ['フィジカル', 40], ['シュート', 55]];
stats.forEach(([n, v], i) => {
  const x = 172 + (i % 2) * 94, y = 660 + Math.floor(i / 2) * 25;
  const hi = v >= 70;
  bp += `<g><text x="${x}" y="${y + 8.5}" font-size="9.4" fill="#dfe6ff" letter-spacing=".2">${n}</text>
   <text x="${x + 80}" y="${y + 10}" text-anchor="end" class="bebas" font-size="17" fill="${hi ? GOLD : '#fff'}">${v}</text>
   <path d="M${x + 1.5} ${y + 12.5} H${x + 84} L${x + 82.4} ${y + 21} H${x} Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="2.6" stroke-linejoin="round"/>
   <path d="M${x + 1.5} ${y + 12.5} H${x + 1.5 + 82.5 * v / 100} L${x + 1.5 + 82.5 * v / 100 - 1.6} ${y + 21} H${x} Z" fill="${hi ? 'url(#gold)' : 'url(#plmove)'}"/>
   <path d="M${x + 1.5} ${y + 12.5} H${x + 1.5 + 82.5 * v / 100} L${x + 1.5 + 82.5 * v / 100 - .6} ${y + 15.6} H${x + .5}Z" fill="#fff" opacity=".5"/></g>`;
});
// action pills
pillDefs.forEach((k, i) => {
  const w = 67, g = 5.5, x = 14 + i * (w + g), y = 722, h = 42, act = k === 'move';
  bp += `<g transform="translate(${x} ${y})">
   ${act ? `<path d="M5 -3 H${w + 7} L${w - 1} ${h + 3} H-3Z" fill="${GOLD}" opacity=".8" filter="url(#glow4)"/>` : ''}
   <path d="M6 0 H${w + 6} L${w} ${h} H0Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="${act ? 8 : 5}" stroke-linejoin="round"/>
   ${act ? `<path d="M6 0 H${w + 6} L${w} ${h} H0Z" fill="none" stroke="${GOLD}" stroke-width="4.4" stroke-linejoin="round"/><path d="M6 0 H${w + 6} L${w} ${h} H0Z" fill="none" stroke="${NAVY}" stroke-width="1" stroke-linejoin="round"/>` : ''}
   <path d="M6 0 H${w + 6} L${w} ${h} H0Z" fill="url(#pl${k})" ${act ? '' : 'opacity=".92"'}/>
   <path d="M6 0 H${w + 6} L${w + 4.9} ${h * .42} H.9 Z" fill="#fff" opacity=".4"/>
   <path d="M6 0 H${w + 6} L${w + 5.6} 3 H5.6Z" fill="#fff" opacity=".5"/>
   <g transform="translate(${w / 2 + 3} 15.5)">${icon(k, 0, 0, 22)}</g>
   <text x="${w / 2 + 2.5}" y="${h - 6.5}" text-anchor="middle" class="ol" font-size="${k === 'shoot' ? 10.4 : 11}" fill="#fff" stroke-width="3.2" letter-spacing=".2">${labels[k]}</text>
   ${k === 'pass' ? `<g transform="translate(${w - 1} 3)"><circle r="8" fill="${NAVY}"/><circle r="6.2" fill="url(#gold)"/><path d="M-3 0 L-0.8 2.4 L3.2 -2.2" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>` : ''}
  </g>`;
});
// primary button
bp += `<g transform="translate(0 774)">
 <path d="M16 3 H380 L370 50 H6Z" fill="#ff7a00" opacity=".7" filter="url(#glow4)"/>
 <path d="M18 0 H384 L373 52 H7Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="8" stroke-linejoin="round"/>
 <path d="M18 0 H384 L373 52 H7Z" fill="url(#btn)"/>
 <path d="M18 0 H384 L382.4 8 H16.3Z" fill="#fff" opacity=".0"/>
 <path d="M20 2 H382 L379.2 22 Q200 30 12 22Z" fill="#fff" opacity=".42"/>
 <path d="M18 0 H384 L373 52 H7Z" fill="url(#ht)" opacity=".12"/>
 <path d="M18 0 H384 L373 52 H7Z" fill="none" stroke="#fff" stroke-width="2" opacity=".85" stroke-linejoin="round" transform="translate(0 0)"/>
 <g transform="translate(58 26)" fill="${NAVY}" stroke="#fff" stroke-width="2"><path d="M-14 -13 L0 0 L-14 13 L-14 6 L-6 0 L-14 -6Z" transform="translate(0 0)"/><path d="M0 -13 L14 0 L0 13 L0 6 L8 0 L0 -6Z"/></g>
 <text x="196" y="40" text-anchor="middle" class="dela ol" font-size="36" fill="#fff" stroke-width="9" letter-spacing="4" style="stroke:#a83a00">実行!</text>
 <text x="196" y="40" text-anchor="middle" class="dela ol" font-size="36" fill="#fff" stroke-width="5" letter-spacing="4">実行!</text>
 <path d="M281 8 H358 L352 46 H275Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>
 <path d="M281 8 H358 L357.4 12 H280.4Z" fill="url(#gold)"/>
 <text x="289" y="22.5" font-size="8.4" fill="${GOLD}" letter-spacing=".4">指示済み</text>
 <text x="343" y="42" text-anchor="end" class="bebas" font-size="25" fill="#fff"><tspan fill="${GOLD}">3</tspan><tspan font-size="17" fill="#9db0ee">/5</tspan></text>
 ${[0, 1, 2, 3, 4].map(i => `<circle cx="${296 + i * 9.4 - (i) * 0}" cy="${19}" r="0"/>`).join('')}
</g>`;
b += bp;
fs.writeFileSync('/home/user/braibo/concept/src/ui/mockups/c-anime/screen1.html', L.page('BRAIBO 作戦フェーズ', b));
