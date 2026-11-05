#!/usr/bin/env node
// THE SOUL SURVEY — smoke test.
// Drives the built page (dist/index.html) in headless Chromium and checks that the
// survey still does what it promises. Run after every engine change:
//
//   python3 pipeline/build.py && node tests/smoke.js
//
// Needs Playwright with Chromium. Cloud sessions have it pre-installed; locally,
// `npm i -g playwright && npx playwright install chromium` (no package.json on purpose).
// Exit code 0 = all checks passed. Set SHOTS=<dir> to save screenshots.
'use strict';
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('Playwright is not installed — see the header of this file.'); process.exit(2); }

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'dist', 'index.html');
const SHOTS = process.env.SHOTS || '';
const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass, detail: detail || '' }); };

async function open(browser, url, vp) {
  const page = await browser.newPage({ viewport: vp || { width: 1600, height: 950 }, deviceScaleFactor: 1 });
  page._errors = [];
  page.on('pageerror', e => page._errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page._errors.push('console: ' + m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  return page;
}
async function enter(page) {
  if (await page.$eval('#hero', h => !h.classList.contains('gone'))) {
    await page.click('#heroEnter'); await page.waitForTimeout(300);
    await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
  }
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const zoomK = page => page.evaluate(() => d3.zoomTransform(document.querySelector('#stage')).k);
const litSamples = page => page.evaluate(() => {
  const c = document.querySelector('#cvGlow'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 20) n++; return n;
});
const tipState = page => page.evaluate(() => {
  const t = document.querySelector('#tooltip');
  return { shown: t.style.display === 'block', pinned: t.classList.contains('pinned'), links: t.querySelectorAll('a').length, text: t.textContent.slice(0, 100) };
});
async function reading(page, id) {
  const idx = await page.evaluate(id => window.__REGISTRY__.readings.findIndex(r => r.id === id), id);
  if (idx < 0) return false;
  await page.click('#readingsBtn'); await page.waitForTimeout(250);
  const items = await page.$$('#readingsMenu .rm-item:not(.special):not(.citizen)');
  await items[idx].click(); await page.waitForTimeout(3300);
  return true;
}
async function openPlate(page, lid) {
  await page.evaluate(lid => { const b = document.querySelector('.read[data-read="' + lid + '"]'); if (b) b.click(); }, lid);
  await page.waitForTimeout(1200);
}

(async () => {
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) { console.error('dist/index.html missing — run python3 pipeline/build.py'); process.exit(2); }
  const size = fs.statSync(path.join(ROOT, 'dist', 'index.html')).size;
  check('page stays under the 8 MB ceiling', size < 8e6, (size / 1e6).toFixed(2) + ' MB');
  const browser = await chromium.launch();
  const page = await open(browser, PAGE);
  check('loads without page errors', page._errors.length === 0, page._errors.join(' | '));
  const live = await page.evaluate(() => window.__REGISTRY__.layers.filter(l => l.status === 'live').length);
  check('registry has live layers', live >= 15, live + ' live');
  await enter(page);

  // --- readings land; every live point layer draws ---
  for (const r of await page.evaluate(() => window.__REGISTRY__.readings.filter(r => !r.special).map(r => r.id))) {
    await reading(page, r);
    const k = await zoomK(page);
    check(`reading "${r}" lands on land`, k >= 1 && k < 26, 'k=' + k.toFixed(2));
    if (r === 'ledger-betrayals') { check('the Ledger draws light', (await litSamples(page)) > 50); await shot(page, 'ledger'); }
    await page.keyboard.press('Escape'); await page.waitForTimeout(1700);
  }
  const pointLayers = await page.evaluate(() => window.__REGISTRY__.layers.filter(l => l.status === 'live' && (l.forms.points || l.forms.flows) && l.scopes.includes('us')).map(l => l.id));
  for (const lid of pointLayers) {
    await openPlate(page, lid);
    const n = await litSamples(page);
    check(`layer "${lid}" draws in solo view`, n > 10, n + ' lit samples');
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  }

  // --- the Index, receipts, pinning ---
  await page.keyboard.press('/'); await page.keyboard.type('Dixon, IL'); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(3000);
  let ts = await tipState(page);
  check('Index → Dixon pins a tooltip with its receipts', ts.shown && ts.pinned && ts.links >= 2, ts.text);
  await shot(page, 'dixon');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check('ESC releases a pinned tooltip', !(await tipState(page)).shown);
  // a direct click on the Dixon coin pins it (the camera is centred on it)
  const xy = await page.evaluate(() => { const r = document.querySelector('#rail').getBoundingClientRect(); return [(Math.min(r.right + 22, innerWidth * .42) + innerWidth - 46) / 2, (108 + innerHeight - 86) / 2]; });
  await page.mouse.click(xy[0], xy[1]); await page.waitForTimeout(400);
  ts = await tipState(page);
  check('a click on a point pins its tooltip', ts.shown && ts.pinned, ts.text);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.keyboard.press('/'); await page.keyboard.type('Lee, IL'); await page.waitForTimeout(300);
  const countyRow = await page.$('#idxResults .ix-row .ix-dossier');
  check('the Index knows counties', !!countyRow);
  if (countyRow) {
    await countyRow.click(); await page.waitForTimeout(2600);
    const doss = await page.$eval('#dossierInner', d => d.textContent);
    check('the dossier carries the v0.5 layers', /988/.test(doss) && /connectedness/i.test(doss) && /altar/i.test(doss) && /sorting/i.test(doss) && /LEDGER/.test(doss), doss.slice(0, 80));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  }

  // --- permalinks ---
  await page.mouse.move(1000, 480);
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 240); await page.waitForTimeout(150); }
  await page.waitForTimeout(900);
  const hash = await page.evaluate(() => location.hash);
  check('the hash carries a geographic centre', /[&#]c=-?\d/.test(hash), hash.slice(0, 80));
  const kA = await zoomK(page);
  const p2 = await open(browser, PAGE + hash, { width: 1280, height: 760 });
  const kB = await zoomK(p2);
  check('a v2 link reopens at another screen size', p2._errors.length === 0 && Math.abs(kA - kB) < 0.05, 'k ' + kA.toFixed(2) + ' → ' + kB.toFixed(2));
  await p2.close();
  const p1 = await open(browser, PAGE + '#s=us&l=100001000000000&e=-1&k=2.000&x=-500.0&y=-300.0');
  check('a v1 (pixel) link still opens', p1._errors.length === 0 && Math.abs((await zoomK(p1)) - 2) < 0.01);
  await p1.close();

  // --- lenses: entity lens in the link, seq lens steps ---
  await openPlate(page, 'power-datacenters');
  const meta = await page.$('.lz-chip[data-lid="power-datacenters"][data-label="Meta"]');
  if (meta) { await meta.click(); await page.waitForTimeout(900); }
  check('an entity lens rides in the link', /z=power-datacenters/.test(decodeURIComponent(await page.evaluate(() => location.hash))));
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await openPlate(page, 'loss-crashes');
  const play = await page.$('.lz-play[data-lid="loss-crashes"]');
  check('a seq lens offers ▶', !!play);
  if (play) {
    await play.click(); await page.waitForTimeout(1500);
    const s1 = await page.$eval('#statline', s => s.textContent);
    await page.waitForTimeout(1200);
    const s2 = await page.$eval('#statline', s => s.textContent);
    check('▶ steps the lens through time', /lens: \w+/.test(s1) && s1 !== s2, s1.slice(-12) + ' → ' + s2.slice(-12));
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);

  // --- citizen readings: record, share, reopen, play, fork ---
  await page.click('#readingsBtn'); await page.waitForTimeout(250);
  await page.click('#readingsMenu .rm-item.special');
  await page.waitForTimeout(400);
  await page.fill('#recTitle', 'Smoke & mirrors <b>');
  await page.fill('#recCap', 'Stop one.');
  await page.click('#recCapture'); await page.waitForTimeout(250);
  await page.mouse.click(900, 500); await page.waitForTimeout(250);
  await page.fill('#recCap', 'Stop two, with a benchmark.');
  await page.click('#recCapture'); await page.waitForTimeout(250);
  await shot(page, 'recorder');
  await page.click('#recFinish'); await page.waitForTimeout(500);
  const url = await page.inputValue('#shareUrl');
  check('finishing a reading yields a t= link', /[&#]t=/.test(url), url.length + ' chars');
  await page.keyboard.press('Escape');
  const p3 = await open(browser, url);
  await p3.waitForTimeout(2600);
  const cap = await p3.$eval('#capCard', c => ({ open: c.classList.contains('open'), html: c.innerHTML, text: c.textContent }));
  check('the link plays the reading', cap.open && /STOP 1 OF 2/.test(cap.text));
  check('reader text is escaped', !/<b>/.test(cap.html.replace(/<b>[^<]*<\/b>/g, '')) || /&lt;b&gt;/.test(cap.html));
  await p3.click('#ccNext'); await p3.waitForTimeout(2600);
  check('NEXT reaches the benchmark stop', /STOP 2 OF 2 · ▲/.test(await p3.$eval('#capCard', c => c.textContent)));
  await p3.click('#ccFork'); await p3.waitForTimeout(600);
  const fork = await p3.evaluate(() => ({ open: document.querySelector('#recCard').classList.contains('open'), title: document.querySelector('#recTitle').value, stops: document.querySelectorAll('.rc-stop').length }));
  check('COUNTER-READING forks the stops into the recorder', fork.open && fork.stops === 2 && /^Re: /.test(fork.title), JSON.stringify(fork));
  check('the reading page has no errors', p3._errors.length === 0, p3._errors.join(' | '));
  await p3.close();
  const bad = await open(browser, PAGE + '#t=not-a-tour!!');
  check('a garbage t= is ignored safely', bad._errors.length === 0);
  await bad.close();

  // --- plunge, about, sheets ---
  await page.keyboard.press('?'); await page.waitForTimeout(3000);
  ts = await tipState(page);
  check('? plunges somewhere with a pinned tooltip', ts.shown && ts.pinned, ts.text.slice(0, 60));
  await page.keyboard.press('Escape');
  await page.click('#aboutBtn'); await page.waitForTimeout(300);
  check('About shows the living log', await page.$eval('#aboutInner', a => /THE LIVING LOG/.test(a.textContent) && a.querySelectorAll('.ab-livelog div').length > 3));
  await page.keyboard.press('Escape');
  await page.keyboard.press('w'); await page.waitForTimeout(2000);
  check('the world sheet draws', (await litSamples(page)) > 50);
  await page.keyboard.press('u'); await page.waitForTimeout(1200);

  // --- the print atlas: composes, restores the view, prints ---
  const before = await page.evaluate(() => ({ hash: location.hash, k: d3.zoomTransform(document.querySelector('#stage')).k }));
  await page.evaluate(() => { window.__ATLAS_NOPRINT__ = true; window.__atlasPages = 0; document.addEventListener('atlas:ready', e => { window.__atlasPages = e.detail.pages; }); });
  await page.click('#atlasBtn');
  await page.waitForFunction(() => window.__atlasPages > 0, null, { timeout: 60000 }).catch(() => {});
  const atlas = await page.evaluate(() => ({ pages: window.__atlasPages, sections: document.querySelectorAll('#atlas .at-page').length, imgs: [...document.querySelectorAll('#atlas img')].filter(i => i.naturalWidth > 200).length }));
  const liveN = await page.evaluate(() => window.__REGISTRY__.layers.filter(l => l.status === 'live').length);
  check('the atlas composes a page per layer plus sheets', atlas.sections === liveN + 5 && atlas.imgs === liveN + 2, JSON.stringify(atlas));
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({ hash: location.hash, k: d3.zoomTransform(document.querySelector('#stage')).k }));
  check('the atlas puts the view back', Math.abs(before.k - after.k) < 0.01 && before.hash.split('&t=')[0] === after.hash.split('&t=')[0], before.hash.slice(0, 50) + ' vs ' + after.hash.slice(0, 50));
  if (SHOTS || process.env.ATLAS_PDF) {
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: process.env.ATLAS_PDF || path.join(SHOTS, 'atlas.pdf'), width: '11in', height: '8.5in', printBackground: true, preferCSSPageSize: true });
    await page.emulateMedia({ media: 'screen' });
  }
  check('the main page stayed error-free', page._errors.length === 0, page._errors.join(' | '));
  await page.close();

  // --- phone width ---
  const ph = await open(browser, PAGE, { width: 390, height: 844 });
  await enter(ph);
  await ph.click('#railToggle'); await ph.waitForTimeout(500);
  const railOpen = await ph.$eval('#rail', r => r.getBoundingClientRect().top < innerHeight);
  check('phone: the layer drawer opens', railOpen);
  await ph.click('#railToggle'); await ph.waitForTimeout(400);
  await ph.evaluate(() => { document.querySelector('#readingsBtn').click(); });
  await ph.waitForTimeout(200);
  await ph.evaluate(() => { const it = document.querySelector('#readingsMenu .rm-item.special'); if (it) it.click(); });
  await ph.waitForTimeout(500);
  const rc = await ph.$eval('#recCard', c => { const r = c.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
  check('phone: the recorder fits the screen', rc.l >= 0 && rc.r <= rc.w, JSON.stringify(rc));
  await shot(ph, 'phone-recorder');
  check('phone: no page errors', ph._errors.length === 0, ph._errors.join(' | '));
  await browser.close();

  const failed = results.filter(r => !r.pass);
  for (const r of results) console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.detail && !r.pass ? ' — ' + r.detail : ''));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('SMOKE TEST CRASHED:', e); process.exit(3); });
