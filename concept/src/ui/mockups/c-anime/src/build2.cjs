const L = require('./lib.cjs'); const { icon } = require('./icons.cjs');
const { NAVY, GOLD, T } = L; const fs = require('fs');
const CX = 195, CY = 412;
const slope = (x) => 478 - x * (126 / 390);
const blueP = `M0 0 H390 V${slope(390) - 13} L0 ${slope(0) - 13} Z`;
const redP = `M0 ${slope(0) + 14} L390 ${slope(390) + 14} V844 H0 Z`;
let b = `<defs><filter id="blur3" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="3"/></filter>
 <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a2f9c"/><stop offset=".5" stop-color="#1e90ff"/><stop offset="1" stop-color="#5de0ff"/></linearGradient>
 <linearGradient id="bg2" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7a0a1e"/><stop offset=".5" stop-color="#e02a2a"/><stop offset="1" stop-color="#ff8a00"/></linearGradient>
 <linearGradient id="tx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff6b0"/><stop offset="1" stop-color="#ffc83a"/></linearGradient>
 <clipPath id="bc"><path d="${blueP}"/></clipPath><clipPath id="rc"><path d="${redP}"/></clipPath>
 <linearGradient id="pB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4dd6ff"/><stop offset=".5" stop-color="#1e90ff"/><stop offset="1" stop-color="#0a4fc2"/></linearGradient>
 <linearGradient id="pR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffa24d"/><stop offset=".5" stop-color="#ff3b3b"/><stop offset="1" stop-color="#b3101e"/></linearGradient>
 <linearGradient id="btn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff39a"/><stop offset=".3" stop-color="#ffd34d"/><stop offset=".62" stop-color="#ff9a1a"/><stop offset="1" stop-color="#f26a0a"/></linearGradient></defs>`;
b += `<g filter="url(#blur3)">${L.pitch()}</g><rect width="390" height="844" fill="#050a1e" opacity=".62"/>`;
const rays = (n, r, col, op, off = 0) => Array.from({ length: n }, (_, i) => { const a1 = off + i * 2 * Math.PI / n, a2 = a1 + Math.PI / n * (.35 + .5 * ((i * 7) % 5) / 5); return `<polygon points="${CX},${CY} ${(CX + r * Math.cos(a1)).toFixed(0)},${(CY + r * Math.sin(a1)).toFixed(0)} ${(CX + r * Math.cos(a2)).toFixed(0)},${(CY + r * Math.sin(a2)).toFixed(0)}" fill="${col}" opacity="${op}"/>`; }).join('');
// panels
b += `<g clip-path="url(#bc)"><path d="${blueP}" fill="url(#bg1)" opacity=".92"/><path d="${blueP}" fill="url(#ht)" opacity=".16"/>${rays(46, 900, '#fff', .2, .1)}
  <ellipse cx="130" cy="230" rx="170" ry="190" fill="#bff3ff" opacity=".35" filter="url(#blur6)"/>
  ${Array.from({ length: 14 }, (_, i) => `<line x1="${-40 + i * 30}" y1="${20 + (i * 53) % 280}" x2="${60 + i * 30 + 70}" y2="${20 + (i * 53) % 280 - 38}" stroke="#fff" stroke-width="${1.5 + (i % 3)}" opacity=".5" stroke-linecap="round"/>`).join('')}</g>
 <g clip-path="url(#rc)"><path d="${redP}" fill="url(#bg2)" opacity=".92"/><path d="${redP}" fill="url(#ht)" opacity=".16"/>${rays(46, 900, '#ffe0a0', .2, .6)}
  <ellipse cx="268" cy="540" rx="150" ry="150" fill="#ffe6b0" opacity=".7" filter="url(#blur6)"/>
  ${Array.from({ length: 14 }, (_, i) => `<line x1="${430 - i * 30}" y1="${440 + (i * 61) % 380}" x2="${330 - i * 30 - 70}" y2="${440 + (i * 61) % 380 + 38}" stroke="#fff" stroke-width="${1.5 + (i % 3)}" opacity=".42" stroke-linecap="round"/>`).join('')}</g>
 <path d="M0 ${slope(0) - 13} L390 ${slope(390) - 13} V${slope(390) + 14} L0 ${slope(0) + 14}Z" fill="#070c24" opacity="0"/><path d="M0 ${slope(0) - 13} L390 ${slope(390) - 13}" stroke="${NAVY}" stroke-width="6"/><path d="M0 ${slope(0) - 13} L390 ${slope(390) - 13}" stroke="#fff" stroke-width="2.6"/>
 <path d="M0 ${slope(0) + 14} L390 ${slope(390) + 14}" stroke="${NAVY}" stroke-width="6"/><path d="M0 ${slope(0) + 14} L390 ${slope(390) + 14}" stroke="#fff" stroke-width="2.6"/>`;
// busts
b += `<g clip-path="url(#bc)"><g transform="translate(125 215) rotate(-6) scale(3.4) translate(-50 -47)">${L.bust('ST', 'blue', { sw: 1.7, ext: 1 })}</g></g>`;
// speed lines over everything in the middle
b += `<g opacity=".9">${Array.from({ length: 22 }, (_, i) => { const a = i * 2 * Math.PI / 22 + .05, r1 = 150 + (i % 3) * 18, r2 = 290 + (i * 37 % 90); return `<line x1="${(CX + r1 * Math.cos(a)).toFixed(0)}" y1="${(CY + r1 * Math.sin(a)).toFixed(0)}" x2="${(CX + r2 * Math.cos(a)).toFixed(0)}" y2="${(CY + r2 * Math.sin(a)).toFixed(0)}" stroke="#fff" stroke-width="${1.4 + (i % 2)}" opacity=".7" stroke-linecap="round"/>`; }).join('')}</g>`;
// impact burst
const spikes = (r1, r2, n) => { let p = []; for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - .2, r = i % 2 ? r2 : r1 + ((i * 13) % 5) * 7; p.push(`${(CX + r * Math.cos(a)).toFixed(1)},${(CY + r * Math.sin(a) * .8).toFixed(1)}`); } return p.join(' '); };
b += `<polygon points="${spikes(150, 92, 16)}" fill="#ff7a00" opacity=".55" filter="url(#glow4)"/>
 <polygon points="${spikes(140, 88, 16)}" fill="${NAVY}" stroke="${NAVY}" stroke-width="12" stroke-linejoin="round"/>
 <polygon points="${spikes(140, 88, 16)}" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
 <polygon points="${spikes(118, 80, 16)}" fill="#ffe14d" transform="rotate(5 ${CX} ${CY})"/>
 <polygon points="${spikes(98, 70, 16)}" fill="#ff9a1a" transform="rotate(-4 ${CX} ${CY})" opacity=".9"/>
 <ellipse cx="${CX}" cy="${CY}" rx="120" ry="80" fill="url(#ht)" opacity=".18"/>`;
b += `<g clip-path="url(#rc)"><g transform="translate(272 516) rotate(5) scale(3.6) translate(-50 -47)">${L.bust('DF', 'red', { sw: 1.7, ext: 1 })}</g></g>`;
// ball (striker)
b += `<g transform="rotate(-10 62 352)">${L.ball(62, 352, 29)}</g>`;
// heading
b += `<g transform="rotate(-11 ${CX} ${CY})">
 <text x="${CX + 4}" y="${CY - 24}" text-anchor="middle" class="bebas" font-size="84" fill="${NAVY}" stroke="${NAVY}" stroke-width="12" stroke-linejoin="round" letter-spacing="8" transform="skewX(-10)" style="transform-origin:${CX}px ${CY}px">DUEL</text>
 <text x="${CX}" y="${CY - 29}" text-anchor="middle" class="bebas" font-size="84" fill="url(#tx)" stroke="${NAVY}" stroke-width="3" letter-spacing="8" transform="skewX(-10)" style="transform-origin:${CX}px ${CY}px">DUEL</text>
 <text x="${CX + 3}" y="${CY + 51}" text-anchor="middle" class="dela" font-size="52" fill="#ff5a1a" stroke="${NAVY}" stroke-width="18" stroke-linejoin="round" letter-spacing="1">競り合い!!</text>
 <text x="${CX}" y="${CY + 46}" text-anchor="middle" class="dela" font-size="52" fill="${NAVY}" stroke="${NAVY}" stroke-width="16" stroke-linejoin="round" letter-spacing="1">競り合い!!</text>
 <text x="${CX}" y="${CY + 46}" text-anchor="middle" class="dela" font-size="52" fill="url(#tx)" stroke="#fff" stroke-width="0" letter-spacing="1">競り合い!!</text></g>`;
// plates
const plate = (x, y, w, team, tag, name, fis, flip) => {
  const c = team === 'blue' ? 'pB' : 'pR';
  return `<g transform="translate(${x} ${y})"><path d="M6 0 H${w + 6} L${w} 46 H0Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="7" stroke-linejoin="round"/><path d="M6 0 H${w + 6} L${w} 46 H0Z" fill="url(#${c})"/><path d="M6 0 H${w + 6} L${w + 5.4} 7 H5.4Z" fill="#fff" opacity=".45"/><path d="M6 0 H${w + 6} L${w} 46 H0Z" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <g transform="translate(26 24)"><circle r="16" fill="${NAVY}"/><circle r="13.5" fill="url(#gold)"/><circle r="11" fill="${NAVY}"/><text y="5" text-anchor="middle" class="dela" font-size="11" fill="#fff">${tag}</text></g>
  <text x="50" y="19" font-size="12" fill="#fff" class="ol" stroke-width="3" letter-spacing=".5">${name}</text>
  <text x="50" y="39" font-size="9" fill="#fff" opacity=".9" letter-spacing=".5">フィジカル</text><text x="${w - 14}" y="40" text-anchor="end" class="bebas ol" font-size="28" fill="${GOLD}" stroke-width="3.5">${fis}</text>
  <path d="M98 33.5 H${w - 54} L${w - 55} 40 H97Z" fill="${NAVY}"/><path d="M98.5 34.5 H${98.5 + (w - 54 - 98.5) * fis / 100} L${98.5 + (w - 54 - 98.5) * fis / 100 - .8} 38.8 H98Z" fill="url(#gold)"/></g>`;
};
b += plate(8, 14, 190, 'blue', '9', 'ストライカー', 55);
b += plate(10, 516, 190, 'red', '4', 'フィジカルDF', 90);
// turn tag
b += `<g transform="translate(300 18)"><path d="M6 0 H84 L80 26 H2Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="5" stroke-linejoin="round"/><path d="M6 0 H84 L80 26 H2Z" fill="#232b57"/><path d="M6 0 H84 L83.5 4 H5.5Z" fill="url(#gold)"/>
 <text x="43" y="20.5" text-anchor="middle" class="bebas" font-size="17" fill="#fff" letter-spacing="1.5"><tspan fill="${GOLD}" font-size="12">TURN </tspan>7<tspan fill="#8f9ed6" font-size="12">/20</tspan></text></g>`;
// WIN burst
b += `<g transform="translate(316 162) rotate(-10)">${L.starburst(0, 0, 66, 46, 14, '#ff7a00', NAVY, 5)}${L.starburst(0, 0, 58, 41, 14, 'url(#btn)', '#fff', 2)}
 <ellipse cx="-12" cy="-26" rx="30" ry="12" fill="#fff" opacity=".4" transform="rotate(-16)"/>
 <text y="12" text-anchor="middle" class="dela" font-size="38" fill="#fff" stroke="${NAVY}" stroke-width="8" paint-order="stroke" stroke-linejoin="round" letter-spacing="-.5">WIN!</text>
 <g transform="translate(0 38)"><path d="M-44 -9 H44 L40 8 H-48Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/><path d="M-44 -9 H44 L40 8 H-48Z" fill="${NAVY}"/><text x="-2" y="4.6" text-anchor="middle" font-size="11.5" fill="${GOLD}" letter-spacing="1">番狂わせ!</text></g></g>`;
// win gauge
const gy = 637, gh = 36, bx = 14, bw = 362, bsplit = bx + bw * .38;
b += `<g><text x="195" y="${gy - 6}" text-anchor="middle" class="bebas ol" font-size="15" fill="#fff" stroke-width="4" letter-spacing="3">WIN RATE</text>
 <path d="M${bx + 8} ${gy} H${bx + bw + 8} L${bx + bw} ${gy + gh} H${bx}Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="9" stroke-linejoin="round"/>
 <clipPath id="gc"><path d="M${bx + 8} ${gy} H${bx + bw + 8} L${bx + bw} ${gy + gh} H${bx}Z"/></clipPath>
 <g clip-path="url(#gc)"><rect x="0" y="${gy}" width="${bsplit + 12}" height="${gh}" fill="url(#pB)"/><path d="M${bsplit + 5} ${gy - 2} H400 V${gy + gh + 2} H${bsplit - 5}Z" fill="url(#pR)"/>
  <rect x="0" y="${gy}" width="400" height="${gh * .42}" fill="#fff" opacity=".35"/><rect x="0" y="${gy}" width="400" height="${gh}" fill="url(#ht)" opacity=".12"/></g>
 <path d="M${bsplit + 6.5} ${gy - 4} L${bsplit - 6.5} ${gy + gh + 4}" stroke="${NAVY}" stroke-width="8"/><path d="M${bsplit + 6.5} ${gy - 4} L${bsplit - 6.5} ${gy + gh + 4}" stroke="#fff" stroke-width="3.4"/>
 <text x="${bx + 20}" y="${gy + 30}" class="bebas ol" font-size="36" fill="#fff" stroke-width="5" transform="skewX(-8)" style="transform-origin:0 ${gy + 30}px">38<tspan font-size="22">%</tspan></text>
 <text x="${bx + bw - 14}" y="${gy + 30}" text-anchor="end" class="bebas ol" font-size="36" fill="#fff" stroke-width="5" transform="skewX(-8)" style="transform-origin:${bx + bw}px ${gy + 30}px">62<tspan font-size="22">%</tspan></text></g>`;
// dialogue box
const dy = 694;
b += `<g><path d="M14 ${dy} H382 L376 ${dy + 138} H8Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="9" stroke-linejoin="round"/>
 <path d="M14 ${dy} H382 L376 ${dy + 138} H8Z" fill="#101a46"/><path d="M14 ${dy} H382 L376 ${dy + 138} H8Z" fill="url(#ht)" opacity=".09"/>
 <path d="M14 ${dy} H382 L381 ${dy + 22} Q200 ${dy + 36} 9.5 ${dy + 22}Z" fill="#fff" opacity=".06"/>
 <path d="M14 ${dy} H382 L376 ${dy + 138} H8Z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
 <path d="M18 ${dy + 5} H378 L372.4 ${dy + 133} H12.6Z" fill="none" stroke="${GOLD}" stroke-width="1.2" stroke-linejoin="round" opacity=".7"/>
 <g transform="translate(26 ${dy - 14})"><path d="M7 0 H150 L142 26 H0Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="5" stroke-linejoin="round"/><path d="M7 0 H150 L142 26 H0Z" fill="url(#pB)"/><path d="M7 0 H150 L149 6 H6Z" fill="#fff" opacity=".45"/><path d="M7 0 H150 L142 26 H0Z" fill="none" stroke="${GOLD}" stroke-width="1.6"/>
  <text x="73" y="18.4" text-anchor="middle" class="ol" font-size="13" fill="#fff" stroke-width="3" letter-spacing=".5">ストライカー #9</text></g>
 <text x="${195}" y="${dy + 47}" text-anchor="middle" class="dela" font-size="23" fill="#fff" letter-spacing=".5" stroke="#0a4fc2" stroke-width="0">「止められるものなら、</text>
 <text x="${195}" y="${dy + 78}" text-anchor="middle" class="dela" font-size="23" fill="#fff" letter-spacing=".5">止めてみろ!」</text>
 <g transform="translate(352 ${dy + 66})"><path d="M-8 -6 H8 L0 7Z" fill="${GOLD}" stroke="${NAVY}" stroke-width="2.4" stroke-linejoin="round"/></g>
 <g transform="translate(0 ${dy + 94})"><path d="M30 0 H372 L368 30 H26Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="6" stroke-linejoin="round"/><path d="M30 0 H372 L368 30 H26Z" fill="url(#btn)"/><path d="M30 0 H372 L371.3 9 H29.4Z" fill="#fff" opacity=".5"/>
  <g transform="translate(58 15)">${L.ball(0, 0, 11)}</g>
  <text x="84" y="22.2" class="dela" font-size="18" fill="${NAVY}" letter-spacing="1.5">ボールキープ成功</text>
  <g transform="translate(335 15)"><path d="M-30 -9 H30 L27 9 H-33Z" fill="${NAVY}"/><text x="-2" y="4.6" text-anchor="middle" class="bebas" font-size="14" fill="${GOLD}" letter-spacing="1.2">UPSET WIN</text></g></g>
</g>`;
// sparkles
b += [[48, 360, 7], [344, 330, 6], [36, 600, 5], [352, 612, 7], [180, 110, 5]].map(([x, y, r]) => `<path d="M${x} ${y - r * 2} Q${x} ${y} ${x + r * 2} ${y} Q${x} ${y} ${x} ${y + r * 2} Q${x} ${y} ${x - r * 2} ${y} Q${x} ${y} ${x} ${y - r * 2}Z" fill="#fff" stroke="${NAVY}" stroke-width="1.2"/>`).join('');
fs.writeFileSync('/home/user/braibo/concept/src/ui/mockups/c-anime/screen2.html', L.page('BRAIBO 競り合い', b));
