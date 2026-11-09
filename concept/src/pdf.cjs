// Usage: node pdf.cjs <file.html> <out.pdf>
// Renders an HTML document made of fixed-size `.page` sections to PDF and reports overflowing pages.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [, , html, out] = process.argv;
  if (!html || !out) { console.error('usage: node pdf.cjs <file.html> <out.pdf>'); process.exit(2); }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()));
  await page.goto('file://' + path.resolve(html), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => ({
    pages: document.querySelectorAll('.page').length,
    overflow: [...document.querySelectorAll('.page')].map((p, i) => {
      const body = p.querySelector('.body') || p;
      const last = [...body.children].filter((c) => !c.classList.contains('foot')).pop();
      const limit = p.getBoundingClientRect().bottom - (p.dataset.safe ? +p.dataset.safe : 44);
      const over = last ? Math.round(last.getBoundingClientRect().bottom - limit) : 0;
      return { page: i + 1, spare: -over };
    }),
    fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i),
  }));
  await page.pdf({ path: out, printBackground: true, preferCSSPageSize: true });
  console.log(JSON.stringify({ out, ...info, errors }, null, 1));
  await browser.close();
})();
