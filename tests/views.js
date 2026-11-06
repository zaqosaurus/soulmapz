#!/usr/bin/env node
// THE SOUL SURVEY — canonical views (the Phase 0 QC loop).
// Renders 8 fixed views of the built page to PNG and, given a baseline directory,
// reports the share of pixels that changed per view.
//
//   node tests/views.js <outdir>                 # render
//   node tests/views.js <outdir> <baselinedir>   # render + compare (fails above 0.5%)
//
// Engine refactors must keep every view under the tolerance. Content changes
// (new layers, new defaults) re-baseline on purpose and say so in the commit.
// Known noise: the flows view (the Great Sorting) is baked progressively on the frame
// clock and varies by up to ~1.2% between two runs of the *same* build (measured on
// the v0.6 build, 2026-11-05), so it carries its own tolerance.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'dist', 'index.html');
const OUT = process.argv[2];
const BASE = process.argv[3];
const TOL = parseFloat(process.env.TOL || '0.005');
const VIEW_TOL = { 'reading-sorting': 0.015 };
if (!OUT) { console.error('usage: node tests/views.js <outdir> [baselinedir]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

async function open(browser) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 }, deviceScaleFactor: 1 });
  page._errors = [];
  page.on('pageerror', e => page._errors.push(e.message));
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  if (await page.$eval('#hero', h => !h.classList.contains('gone'))) {
    await page.click('#heroEnter'); await page.waitForTimeout(300);
    await page.keyboard.press('Escape'); await page.waitForTimeout(1800);
  }
  // freeze anything that moves so a view is a function of state, not of time
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important} #toast{display:none!important}' });
  return page;
}
async function reading(page, id) {
  const idx = await page.evaluate(id => window.__REGISTRY__.readings.findIndex(r => r.id === id), id);
  await page.click('#readingsBtn'); await page.waitForTimeout(250);
  const items = await page.$$('#readingsMenu .rm-item:not(.special):not(.citizen)');
  await items[idx].click(); await page.waitForTimeout(7000);
  // the caption card is UI, not the map: keep it out of the comparison
  await page.evaluate(() => { const c = document.querySelector('#capCard'); if (c) c.style.visibility = 'hidden'; });
}
async function plate(page, lid) {
  await page.evaluate(lid => document.querySelector('.read[data-read="' + lid + '"]').click(), lid);
  await page.waitForTimeout(4000);
}
const VIEWS = [
  ['us-default', async p => {}],
  ['world-default', async p => { await p.keyboard.press('w'); await p.waitForTimeout(6000); }],
  ['reading-corridor', async p => reading(p, 'corridor')],
  ['reading-sorting', async p => reading(p, 'great-sorting')],
  ['reading-ledger', async p => reading(p, 'ledger-betrayals')],
  ['reading-memory-pools', async p => reading(p, 'memory-pools')],
  ['plate-ledger', async p => plate(p, 'betrayal-ledger')],
  ['meta-constellation', async p => {
    await plate(p, 'power-datacenters');
    await p.click('.lz-chip[data-lid="power-datacenters"][data-label="Meta"]'); await p.waitForTimeout(1800);
  }],
];

(async () => {
  const browser = await chromium.launch();
  let worst = 0, failed = 0, errors = [];
  for (const [name, act] of VIEWS) {
    const page = await open(browser);
    await act(page);
    await page.mouse.move(2, 2); await page.waitForTimeout(400);
    const file = path.join(OUT, name + '.png');
    await page.screenshot({ path: file });
    if (page._errors.length) errors.push(name + ': ' + page._errors.join(' | '));
    let line = 'rendered ' + name;
    const bfile = BASE && path.join(BASE, name + '.png');
    if (bfile && fs.existsSync(bfile)) {
      const frac = await page.evaluate(async ([a, b]) => {
        const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return 1;
        const px = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
        const da = px(ia), db = px(ib); let n = 0;
        for (let i = 0; i < da.length; i += 4) {
          if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) n++;
        }
        return n / (da.length / 4);
      }, ['data:image/png;base64,' + fs.readFileSync(file).toString('base64'), 'data:image/png;base64,' + fs.readFileSync(bfile).toString('base64')]);
      worst = Math.max(worst, frac);
      const ok = frac <= (VIEW_TOL[name] || TOL);
      if (!ok) failed++;
      line = (ok ? 'SAME ' : 'DIFF ') + name + ' — ' + (frac * 100).toFixed(3) + '% of pixels changed';
    }
    console.log(line);
    await page.close();
  }
  await browser.close();
  if (errors.length) { console.log('PAGE ERRORS:\n  ' + errors.join('\n  ')); }
  if (BASE) console.log(`\nworst ${(worst * 100).toFixed(3)}% · tolerance ${(TOL * 100).toFixed(1)}% · ${failed ? failed + ' view(s) over' : 'all within'}`);
  process.exit(failed || errors.length ? 1 : 0);
})().catch(e => { console.error('VIEWS CRASHED:', e); process.exit(3); });
