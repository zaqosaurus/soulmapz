// tests/look.js <layer-id> <us|world> <out.png> [lensLabel] — solo one layer on a sheet and screenshot it,
// with the plate hidden, for the "look at it" step of the acquisition loop. Run from the repo root:
//   NODE_PATH=$(npm root -g) node tests/look.js loss-covid us /tmp/covid.png
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const [lid, sc, out, lensLabel] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('dist/index.html')); await p.waitForTimeout(1500);
  if (await p.$eval('#hero', h => !h.classList.contains('gone'))) { await p.click('#heroEnter'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(600); await p.keyboard.press('Escape'); await p.waitForTimeout(900); }
  if (sc === 'world') { await p.keyboard.press('w'); await p.waitForTimeout(2000); }
  await p.evaluate(lid => document.querySelector('.read[data-read="' + lid + '"]').click(), lid); await p.waitForTimeout(2500);
  if (sc === 'world' && await p.evaluate(() => window.__SURVEY__.scope()) !== 'world') { await p.keyboard.press('w'); await p.waitForTimeout(2500); }
  if (sc === 'us' && await p.evaluate(() => window.__SURVEY__.scope()) !== 'us') { await p.keyboard.press('u'); await p.waitForTimeout(2500); }
  if (lensLabel) { await p.click(`.lz-chip[data-lid="${lid}"][data-label="${lensLabel}"]`); await p.waitForTimeout(1500); }
  await p.evaluate(() => document.querySelector('#plate').classList.remove('open')); await p.waitForTimeout(800);
  await p.screenshot({ path: out }); console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok'); await b.close();
})();
