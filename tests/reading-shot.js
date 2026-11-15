// tests/reading-shot.js <id1,id2,...> <outdir> — open named readings and screenshot each (run from the repo root):
//   NODE_PATH=$(npm root -g) node tests/reading-shot.js year-without-goodbyes,last-speakers /tmp/shots
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const [ids, outdir] = [process.argv[2].split(','), process.argv[3]];
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('dist/index.html')); await p.waitForTimeout(1500);
  if (await p.$eval('#hero', h => !h.classList.contains('gone'))) { await p.click('#heroEnter'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(600); await p.keyboard.press('Escape'); await p.waitForTimeout(900); }
  for (const id of ids) {
    const idx = await p.evaluate(id => window.__REGISTRY__.readings.findIndex(r => r.id === id), id);
    await p.click('#readingsBtn'); await p.waitForTimeout(250);
    const items = await p.$$('#readingsMenu .rm-item:not(.special):not(.citizen)'); await items[idx].click(); await p.waitForTimeout(3500);
    await p.screenshot({ path: path.join(outdir, 'rd-' + id + '.png') });
    await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
  }
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok'); await b.close();
})();
