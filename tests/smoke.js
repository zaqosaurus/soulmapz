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
  const digest = p => p.evaluate(() => { const s = JSON.stringify([window.__LAYERDATA__, window.__BASEMAPS__]); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return s.length + ':' + h; });
  check('the compressed payload unpacks before the survey starts', await page.evaluate(() => window.__SURVEY_UNPACKED__ === true && !!window.__LAYERDATA__));
  const PLAIN = path.join(ROOT, 'dist', 'index.plain.html');
  if (fs.existsSync(PLAIN)) {
    const pp = await open(browser, 'file://' + PLAIN);
    check('the plain build (fallback path) loads without errors', pp._errors.length === 0 && await pp.evaluate(() => !window.__SURVEY_UNPACKED__ && !!window.__LAYERDATA__), pp._errors.join(' | '));
    const [a, b] = [await digest(page), await digest(pp)];
    check('compressed and plain builds carry identical data', a === b, a + ' vs ' + b);
    await pp.close();
  } else console.log('(no dist/index.plain.html — the build writes it beside index.html)');
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
  const pointLayers = await page.evaluate(() => window.__REGISTRY__.layers.filter(l => l.status === 'live' && (l.forms.points || l.forms.flows)).map(l => l.id));
  for (const lid of pointLayers) {
    await openPlate(page, lid);
    const n = await litSamples(page);
    check(`layer "${lid}" draws in solo view`, n > 10, n + ' lit samples');
    if (!(await page.evaluate(lid => window.__REGISTRY__.layers.find(l => l.id === lid).scopes.includes('us'), lid))) await shot(page, 'solo-' + lid);
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    if ((await page.evaluate(() => window.__SURVEY__.scope())) !== 'us') { await page.keyboard.press('u'); await page.waitForTimeout(1200); }
  }

  // --- the Index, receipts, pinning ---
  await page.keyboard.press('/'); await page.keyboard.type('Dixon, IL'); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(3000);
  let ts = await tipState(page);
  check('Index → Dixon pins a tooltip with its receipts', ts.shown && ts.pinned && ts.links >= 2, ts.text);
  check('the Ledger tooltip carries the price per head', await page.$eval('#tooltip', t => /\$3,516 per resident/.test(t.textContent)));
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
  check('an old link still means the same layers (frozen v0.6 order)', await p1.evaluate(() => { const on = [...document.querySelectorAll('.chip.on[data-lid]')].map(c => c.dataset.lid).sort().join(','); return on === 'memory-births,motion-sorting'; }), await p1.evaluate(() => [...document.querySelectorAll('.chip.on[data-lid]')].map(c => c.dataset.lid).join(',')));
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

  // --- v0.7 Phase 1: unlocked fields ---
  for (const lid of await page.evaluate(() => window.__REGISTRY__.layers.filter(l => l.status === 'live' && l.time && l.time.buckets && l.scopes.includes('us')).map(l => l.id))) {
    await openPlate(page, lid);
    const last = await page.$$eval('#eraBar button[data-era]', bs => bs.length - 2);
    await page.click('#eraBar button[data-era="' + last + '"]'); await page.waitForTimeout(900);
    const st = await page.$eval('#statline', s => s.textContent);
    const lab = await page.evaluate(([lid, i]) => window.__REGISTRY__.layers.find(l => l.id === lid).time.buckets[i][2], [lid, last]);
    check(`time: "${lid}" scrubs to ${lab}`, st.includes(lab) && (await litSamples(page)) > 0, st.slice(0, 90));
    await page.click('#eraBar button[data-era="-1"]'); await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  }
  await openPlate(page, 'faith-altar');
  await page.click('.cat-mode[data-cat="1"]'); await page.waitForTimeout(700);
  check('faith: the families map has a 9-colour legend', (await page.$$eval('#plateInner .pl-legend .lg-item', a => a.length)) === 9);
  await shot(page, 'faith-families');
  await page.click('.cat-mode[data-cat="0"]'); await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  await openPlate(page, 'motion-sorting');
  await page.click('.ppl-mode[data-p="1"]'); await page.waitForTimeout(900);
  check('sorting: counts in people on request', await page.$eval('.ppl-mode[data-p="1"]', b => b.classList.contains('on')) && (await litSamples(page)) > 50);
  await page.click('.ppl-mode[data-p="0"]'); await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  await openPlate(page, 'memory-births');
  const scr = await page.$('.lz-chip[data-lid="memory-births"][data-label="Thought & science"]');
  if (scr) { await scr.click(); await page.waitForTimeout(1000); }
  check('memory: the calling lens shows only those stars', !!scr && (await litSamples(page)) > 5 && /lens: Thought/.test(await page.$eval('#statline', s => s.textContent)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  for (const [lid, lab] of [['omen-names', 'Summits'], ['power-datacenters', 'AI campus, under construction'], ['wonder-ufos', 'Triangle']]) {
    await openPlate(page, lid);
    const ch = await page.$(`.lz-chip[data-lid="${lid}"][data-label="${lab}"]`);
    if (ch) { await ch.click(); await page.waitForTimeout(900); }
    check(`lens: ${lid} → ${lab} draws`, !!ch && (await litSamples(page)) > 0);
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  }

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

  // --- v0.7 forms, exercised on synthetic fixtures injected into the plain page ---
  // (country tint + categories + series, great-circle flows, a timed point layer with a
  //  tooltip template, a raster). Fixtures never ship; they prove the engine paths.
  {
    const FIX = `(function(){var R=window.__REGISTRY__,D=window.__LAYERDATA__;
      function L(o){o.status='live';o.essay={what:'fixture',how:'fixture',why:'fixture'};o.plateStats=[];o.count=1;o.weight=o.weight||0;o.sources=[];R.layers.push(o);}
      L({id:'fx-country',title:'Fixture Countries',theme:'wonder',accent:'#e0607e',scopes:['world'],forms:{points:false,tint:true,regionKind:'country'},unit:'per 100k',statline:'fixture countries',
         categories:{label:'kind',labels:['Alpha','Beta'],colors:['#e0607e','#60b0e0'],counts:[2,1]},
         time:{label:'Fixture year',buckets:[[2000,2000,'2000'],[2010,2010,'2010']],mode:'series'}});
      D['fx-country']={kind:'regions',regionKind:'country',vmax:10,countries:{'076':{v:8,label:'FIXTURE BR 8',c:0,t:[2,9]},'356':{v:4,label:'FIXTURE IN 4',c:1,t:[1,5]},'484':{v:6,label:'FIXTURE MX 6',c:0,t:[null,6]}},
         categories:{label:'kind',labels:['Alpha','Beta'],colors:['#e0607e','#60b0e0'],counts:[2,1]},time:{label:'Fixture year',buckets:[[2000,2000,'2000'],[2010,2010,'2010']],mode:'series'}};
      L({id:'fx-flows',title:'Fixture Flows',theme:'wonder',accent:'#9de07a',scopes:['world'],forms:{flows:true},unit:'people',statline:'fixture flows'});
      D['fx-flows']={kind:'flows',geo:true,n:3,arcmax:100,arcs:{alat:[-10,20,35],alon:[-52,78,139],blat:[51,-25,37],blon:[0,134,-120],hh:[100,60,30]}};
      L({id:'fx-points',title:'Fixture Points',theme:'wonder',accent:'#f0c050',scopes:['us'],forms:{points:true},unit:'things',statline:'fixture points',
         tip:{ti:'{name}',s:'{kind} · {yr|year} · {missing}'},time:{field:'yr',label:'Fixture decade',mode:'in',buckets:[[1990,1999,'1990s'],[2000,2009,'2000s']],counts:[2,1]}});
      var P={kind:'points',n:0,lat:[],lon:[],name:[],k:[],yr:[],codes:{kind:['Kind A','Kind B']}};
      function add(la,lo,nm,k,y){P.lat.push(la);P.lon.push(lo);P.name.push(nm);P.k.push(k);P.yr.push(y);P.n++;}
      add(40,-100,'Fx One',0,1995);
      for(var q=0;q<40;q++){add(30+q%8,-115+Math.floor(q/8)*3,'Fx 90s '+q,1,1990+q%10);add(38+q%8,-95+Math.floor(q/8)*3,'Fx 00s '+q,0,2000+q%10);}
      D['fx-points']=P;
      L({id:'fx-raster',title:'Fixture Raster',theme:'wonder',accent:'#ff3030',scopes:['us'],forms:{points:false},unit:'light',statline:'fixture raster'});
      var w=40,h=20,b='';for(var j=0;j<h;j++)for(var i=0;i<w;i++)b+=String.fromCharCode((i>5&&i<35&&j>3&&j<17)?220:0);
      D['fx-raster']={kind:'raster',n:1,bbox:[-120,30,-80,50],w:w,h:h,b64:btoa(b)};
    })();`;
    // the points fixture's enum lives in field "k" (its tooltip template is rewritten to match)
    let html = fs.readFileSync(path.join(ROOT, 'dist', 'index.plain.html'), 'utf8')
      .replace('window.__SOUL_APP__=function(){', FIX.replace("s:'{kind} · {yr|year} · {missing}'", "s:'{k} · {yr|year} · {missing}'").replace("codes:{kind:['Kind A','Kind B']}", "codes:{k:['Kind A','Kind B']}") + '\nwindow.__SOUL_APP__=function(){');
    const FX = path.join(ROOT, 'dist', 'fixtures.html');
    fs.writeFileSync(FX, html);
    const fx = await open(browser, 'file://' + FX);
    await enter(fx);
    check('fixtures: the page boots with the synthetic layers', fx._errors.length === 0, fx._errors.join(' | '));
    const hover = async (lon, lat) => { const p = await fx.evaluate(([a, b]) => window.__SURVEY__.screenOf(a, b), [lon, lat]); if (!p) return ''; await fx.mouse.move(p[0], p[1]); await fx.waitForTimeout(350); return fx.$eval('#tooltip', t => t.style.display === 'block' ? t.textContent : ''); };
    const solo = async lid => { await fx.evaluate(lid => document.querySelector('.read[data-read="' + lid + '"]').click(), lid); await fx.waitForTimeout(1600); };
    const shut = async () => { await fx.keyboard.press('Escape'); await fx.waitForTimeout(700); };
    // timed points + template tooltip (US)
    await solo('fx-points');
    check('time: the bar follows the first active timed layer', await fx.evaluate(() => window.__SURVEY__.timeLayer() === 'fx-points' && /FIXTURE DECADE/.test(document.querySelector('#eraBar').textContent) && document.querySelector('#eraBar').classList.contains('show')));
    const tipA = await hover(-100, 40);
    check('tooltip template fills fields and drops empty parts', /Fx One/.test(tipA) && /Kind A · 1995/.test(tipA) && !/· *$/.test(tipA.trim()), tipA);
    await fx.mouse.move(5, 400);
    const litAll = await litSamples(fx);
    await fx.click('#eraBar button[data-era="1"]'); await fx.waitForTimeout(1200);
    const litOne = await litSamples(fx);
    const stl = await fx.$eval('#statline', s => s.textContent);
    check('time: a bucket filters the points and names itself', litOne > 0 && litOne < litAll && /2000s/.test(stl), litAll + ' → ' + litOne + ' · ' + stl);
    check('time: the hash carries the bucket', /[&#]e=1/.test(await fx.evaluate(() => location.hash)));
    await fx.click('#eraBar button[data-era="-1"]'); await fx.waitForTimeout(400);
    await shut();
    // raster (US)
    await solo('fx-raster');
    const ras = await fx.evaluate(() => { const p = window.__SURVEY__.screenOf(-100, 40), c = document.querySelector('#cvBase'), r = devicePixelRatio || 1; const d = c.getContext('2d').getImageData(Math.round(p[0] * r), Math.round(p[1] * r), 1, 1).data; const q = window.__SURVEY__.screenOf(-75, 40), e = c.getContext('2d').getImageData(Math.round(q[0] * r), Math.round(q[1] * r), 1, 1).data; return [d[0] - d[2], e[0] - e[2]]; });
    check('raster: lit cells colour the base, empty cells do not', ras[0] > 60 && ras[1] < 20, JSON.stringify(ras));
    await shut();
    // world: country tint, categories, series; great-circle flows
    await fx.keyboard.press('w'); await fx.waitForTimeout(2200);
    await solo('fx-country');
    check('categorical: the plate carries a legend', await fx.$$eval('#plateInner .pl-legend .lg-item', a => a.length) === 2);
    const tipBR = await hover(-52, -10);
    check('country tint: a country answers with its value', /FIXTURE BR 8/.test(tipBR), tipBR);
    await fx.click('#eraBar button[data-era="1"]'); await fx.waitForTimeout(900);
    const tipBR2 = await hover(-52, -10);
    check('country series: the scrubber changes the reading', /9 per 100k · 2010/.test(tipBR2), tipBR2);
    await fx.click('#eraBar button[data-era="0"]'); await fx.waitForTimeout(900);
    const tipAU = await hover(-102, 23);
    check('country series: a missing year says so', /no figure for 2000/.test(tipAU), JSON.stringify(tipAU) + ' at ' + JSON.stringify(await fx.evaluate(() => window.__SURVEY__.screenOf(-102, 23))));
    await shut();
    await solo('fx-flows');
    const litF = await litSamples(fx);
    check('world flows: great-circle arcs draw', litF > 30, litF + ' lit samples');
    await shot(fx, 'fixtures-flows');
    check('fixtures: no page errors', fx._errors.length === 0, fx._errors.join(' | '));
    await fx.close();
    fs.unlinkSync(FX);
  }

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
