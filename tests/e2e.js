/*
 * End-to-end check with Playwright (run locally, not in CI):
 *   cd site && python3 -m http.server 8123 &
 *   node tests/e2e.js http://localhost:8123 ./out
 * Plays the whole game on desktop and on a 360 px phone, checks scoring,
 * keyboard, Esc, saved progress, case-file reveal, and a mocked leaderboard.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const DATA = require('../site/js/scenarios.js');

const BASE = process.argv[2] || 'http://localhost:8123';
const OUT = process.argv[3] || './out';
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name);
  else { failures++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
}

async function playAll(page, tag, { wrongFirst = true } = {}) {
  const sc = DATA.scenarios.filter(s => !s.bonus);
  await page.click('#open-audit');
  await page.waitForSelector('dialog#audit[open]');
  check(tag + ' intro title shown', await page.locator('#audit-root .view-title').innerText() === 'Three misconfigurations are hiding my story.');
  await page.screenshot({ path: path.join(OUT, tag + '-1-intro.png') });
  await page.click('text=Start the audit');

  for (let i = 0; i < sc.length; i++) {
    const s = sc[i];
    await page.waitForSelector('.opt');
    const wrongOpt = s.options.find(o => !o.correct);
    const goodOpt = s.options.find(o => o.correct);
    if (i === 0 && wrongFirst) {
      await page.locator('.opt', { hasText: wrongOpt.text }).first().click();
      const fb = await page.locator('#feedback').innerText();
      check(tag + ' wrong pick shows its hint', fb.includes(wrongOpt.hint.slice(0, 20)), fb);
      check(tag + ' wrong pick lowers points to 75', (await page.locator('#worth').innerText()).includes('75'));
      check(tag + ' wrong option is disabled', await page.locator('.opt', { hasText: wrongOpt.text }).first().isDisabled());
      await page.screenshot({ path: path.join(OUT, tag + '-2-wrong.png') });
    }
    if (i === 0) await page.screenshot({ path: path.join(OUT, tag + '-2b-play.png') });
    await page.locator('.opt', { hasText: goodOpt.text }).first().click();
    await page.waitForSelector('.card-unlock');
    const unlockTitle = await page.locator('.card-unlock h4').innerText();
    check(tag + ' unlock ' + s.id, unlockTitle === 'Unlocked: ' + s.unlock.title, unlockTitle);
    const cfText = await page.locator('[data-case="' + s.id + '"] .cf-value').innerText();
    check(tag + ' case file ' + s.id + ' declassified', cfText === s.casefile.value, cfText);
    if (i === 0) await page.screenshot({ path: path.join(OUT, tag + '-3-unlock.png') });
    if (i < sc.length - 1) await page.click('text=Next finding');
    else await page.click('text=See the audit report');
  }
}

(async () => {
  const browser = await chromium.launch();

  for (const [tag, vp] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 360, height: 740 }]]) {
    console.log('\n== ' + tag + ' ==');
    const ctx = await browser.newContext({ viewport: vp, hasTouch: tag === 'mobile', deviceScaleFactor: tag === 'mobile' ? 2 : 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(BASE + '/index.html');

    await playAll(page, tag);
    await page.waitForSelector('.findings');
    const report = await page.locator('#audit-root').innerText();
    check(tag + ' report says Audit passed', report.includes('Audit passed'));
    // 75 + 100 + 100 = 275 base, plus a time bonus of at most 120
    const pts = parseInt(await page.locator('.stat b').first().innerText(), 10);
    check(tag + ' score in range 275..395', pts >= 275 && pts <= 395, String(pts));
    check(tag + ' leaderboard hidden when no API configured', (await page.locator('.board-wrap').count()) === 0);
    check(tag + ' counter reads 3 of 4', (await page.locator('#casefile-count').innerText()) === '3 of 4 declassified');
    await page.screenshot({ path: path.join(OUT, tag + '-4-report.png') });
    await page.locator('#audit-root').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.screenshot({ path: path.join(OUT, tag + '-4b-report-bottom.png') });

    // tap targets inside the dialog
    const small = await page.evaluate(() => [...document.querySelectorAll('#audit button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 44).map(b => b.textContent.trim()));
    check(tag + ' all dialog buttons >= 44px tall', small.length === 0, small.join(', '));
    const dlgOverflow = await page.evaluate(() => { const b = document.getElementById('audit-root'); return b.scrollWidth - b.clientWidth; });
    check(tag + ' no sideways scroll inside the dialog', dlgOverflow <= 0, String(dlgOverflow));

    // Esc closes; page behind usable; progress kept
    await page.keyboard.press('Escape');
    check(tag + ' Esc closes the dialog', (await page.locator('dialog#audit[open]').count()) === 0);
    await page.click('nav >> text=Skills');
    check(tag + ' page behind still navigable', await page.locator('#skills').isVisible());
    await page.click('#open-audit');
    check(tag + ' reopening keeps the report', (await page.locator('#audit-root .view-title').innerText()) === 'Audit passed');

    // bonus path after a reload with saved progress
    await page.keyboard.press('Escape');
    await page.reload();
    check(tag + ' progress survives reload (case file)', (await page.locator('#casefile-count').innerText()) === '3 of 4 declassified');
    await page.click('#open-audit');
    await page.click('text=Play again');
    check(tag + ' play again resets case file', (await page.locator('#casefile-count').innerText()) === '0 of 4 declassified');
    await page.click('text=Start the audit');
    // keyboard path: answer finding 1 with number keys until correct
    const s1 = DATA.scenarios[0];
    const texts = await page.locator('.opt .opt-text').allInnerTexts();
    const idx = texts.findIndex(t => t.startsWith(s1.options.find(o => o.correct).text));
    await page.keyboard.press(String(idx + 1));
    await page.waitForSelector('.card-unlock');
    check(tag + ' number key picks an option', true);
    await page.click('text=Next finding');
    // finish 2 and 3, then take the bonus
    for (const s of DATA.scenarios.slice(1, 3)) {
      await page.locator('.opt', { hasText: s.options.find(o => o.correct).text }).first().click();
      await page.waitForSelector('.card-unlock');
      if (s.id === 's2') await page.click('text=Next finding');
    }
    check(tag + ' bonus offered after the third fix', (await page.locator('text=Try the bonus finding').count()) === 1);
    await page.click('text=Try the bonus finding');
    const s4 = DATA.scenarios[3];
    await page.locator('.opt', { hasText: s4.options.find(o => o.correct).text }).first().click();
    await page.waitForSelector('.card-unlock');
    await page.screenshot({ path: path.join(OUT, tag + '-5-bonus-unlock.png') });
    await page.click('text=See the audit report');
    check(tag + ' report lists 4 findings', (await page.locator('.findings tbody tr').count()) === 4);
    check(tag + ' counter reads 4 of 4', (await page.locator('#casefile-count').innerText()) === '4 of 4 declassified');
    await page.keyboard.press('Escape');
    await page.locator('#casefile').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, tag + '-6-casefile-open.png') });

    check(tag + ' no console or page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // leaderboard with a mocked API
  console.log('\n== leaderboard (mocked API) ==');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const API = 'https://abc123.execute-api.ap-south-1.amazonaws.com';
    await page.route('**/js/config.js', r => r.fulfill({ contentType: 'application/javascript', body: "window.AUDIT_CONFIG={apiUrl:'" + API + "'};" }));
    let posted = null;
    await page.route(API + '/**', async r => {
      const req = r.request();
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      if (req.method() === 'POST') { posted = JSON.parse(req.postData()); return r.fulfill({ status: 201, headers: cors, contentType: 'application/json', body: JSON.stringify({ ok: true }) }); }
      return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ entries: [{ nickname: '<b>x</b>', score: 380, seconds: 41 }, { nickname: 'ops-hero', score: 350, seconds: 60 }] }) });
    });
    await page.goto(BASE + '/index.html');
    await playAll(page, 'lb', { wrongFirst: false });
    await page.waitForSelector('.board li');
    check('leaderboard renders entries', (await page.locator('.board li').count()) === 2);
    check('nicknames are plain text, not HTML', (await page.locator('.board .nick').first().innerText()) === '<b>x</b>' && (await page.locator('.board b').count()) === 0);
    await page.fill('#lb-nick', 'x');
    await page.click('text=Post my score');
    check('invalid nickname is rejected client-side', (await page.locator('.board-wrap .lb-msg').innerText()).includes('2 to 16'));
    await page.fill('#lb-nick', 'Umer Ops');
    await page.click('text=Post my score');
    await page.waitForFunction(() => document.body.innerText.includes('Saved. You are on the board.'));
    check('score posted with the right shape', posted && posted.nickname === 'Umer Ops' && posted.scenarios === 3 && posted.score >= 300 && Number.isInteger(posted.seconds), JSON.stringify(posted));
    await page.screenshot({ path: path.join(OUT, 'lb-report.png') });
    await ctx.close();

    // API down: the game still works and says so
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p2 = await ctx2.newPage();
    await p2.route('**/js/config.js', r => r.fulfill({ contentType: 'application/javascript', body: "window.AUDIT_CONFIG={apiUrl:'" + API + "'};" }));
    await p2.route(API + '/**', r => r.abort());
    await p2.goto(BASE + '/index.html');
    await playAll(p2, 'offline', { wrongFirst: false });
    await p2.waitForFunction(() => document.body.innerText.includes('Leaderboard offline'));
    check('API down: game completes and shows "Leaderboard offline"', true);
    await ctx2.close();
  }

  // blocked storage must not break the game
  console.log('\n== storage blocked ==');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE + '/index.html');
    await playAll(page, 'nostorage', { wrongFirst: false });
    check('game completes with storage blocked', (await page.locator('#audit-root .view-title').innerText()) === 'Audit passed');
    check('no page errors with storage blocked', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + (failures ? failures + ' FAILED' : 'ALL PASSED'));
  process.exit(failures ? 1 : 0);
})();
