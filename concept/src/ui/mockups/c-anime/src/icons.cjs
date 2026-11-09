const { NAVY } = require('./lib.cjs');
// 24x24 icons, white with navy outline; returns group at (x,y) center, size s
const P = {
 move: `<ellipse cx="8" cy="15.5" rx="4.2" ry="6" transform="rotate(-12 8 15.5)"/><ellipse cx="16.5" cy="8.5" rx="4" ry="5.6" transform="rotate(12 16.5 8.5)"/>`,
 pass: `<path d="M3 19 Q7 4 17 7" fill="none" stroke-dasharray="1 3.2" stroke-linecap="round"/><path d="M15 2.5 L21 7.5 L14 10Z"/><circle cx="6.5" cy="18" r="3.8"/>`,
 cross: `<path d="M3 20 C4 6 14 2 20 10" fill="none"/><path d="M21.5 13 L14.5 12.5 L19.5 6.5Z"/><circle cx="5.5" cy="19" r="3.6"/>`,
 shoot: `<circle cx="16" cy="12" r="6"/><path d="M2 8 H8 M1 12 H7 M3 16 H8" fill="none"/>`,
 keep: `<path d="M12 2 L20 5 V12 C20 17 16 20 12 22 C8 20 4 17 4 12 V5Z"/><circle cx="12" cy="12" r="3.2" fill="${NAVY}" stroke="none"/>`,
};
function icon(name, x, y, s = 20, col = '#fff') {
  const k = s / 24;
  const body = P[name];
  return `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${k})"><g fill="${NAVY}" stroke="${NAVY}" stroke-width="5.2" stroke-linejoin="round" stroke-linecap="round">${body.replace(/fill="none"/g, 'fill="none"')}</g>
  <g fill="${col}" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${body}</g></g>`;
}
module.exports = { icon };
