// Usage: node shot.cjs <file.html> <out.png> [width=390] [height=844] [dpr=2]
// Renders a standalone mockup HTML at phone size and saves a PNG (waits for web fonts).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [, , html, out, w = '390', h = '844', dpr = '2'] = process.argv;
  if (!html || !out) { console.error('usage: node shot.cjs <file.html> <out.png> [w] [h] [dpr]'); process.exit(2); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()));
  await page.goto('file://' + path.resolve(html), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
    fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i),
  }));
  await page.screenshot({ path: out });
  console.log(JSON.stringify({ out, ...overflow, errors }, null, 1));
  await browser.close();
})();
