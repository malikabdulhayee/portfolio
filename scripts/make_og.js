#!/usr/bin/env node
/*
 * Renders site/assets/og.png (1200x630 social preview) from the site's own fonts and colours.
 *   node scripts/make_og.js        (needs Playwright with Chromium installed)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SITE = path.join(__dirname, '..', 'site');
const font = 'file://' + path.join(SITE, 'fonts', 'archivo-var.woff2');
const mono = 'file://' + path.join(SITE, 'fonts', 'jbmono-700.woff2');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:A;src:url(${font});font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:M;src:url(${mono});font-weight:700}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#EDF0F3;color:#0F1A2B;font-family:A,Arial,sans-serif;position:relative;overflow:hidden}
.name{position:absolute;left:72px;top:64px;font-weight:800;font-stretch:125%;font-size:150px;line-height:.92;letter-spacing:-.03em}
.name span{display:block}
.role{position:absolute;left:72px;top:394px;width:560px;font-size:30px;line-height:1.35}
.btn{position:absolute;left:72px;top:506px;background:#D3232F;color:#fff;font-weight:700;font-stretch:108%;font-size:28px;padding:20px 34px;display:flex;gap:16px;align-items:center}
.btn i{width:14px;height:14px;border-radius:50%;background:#fff;display:block}
.card{position:absolute;right:72px;top:270px;width:440px;background:#FAFBFC;border:2px solid #0F1A2B;font-family:M,monospace;font-size:21px}
.card div{display:flex;justify-content:space-between;padding:16px 22px;border-bottom:1px solid rgba(15,26,43,.18)}
.card div:last-child{border:0;color:#D3232F}
.card b{color:#D3232F}
.card .h{color:#4A586B}
</style></head><body>
<div class="name"><span>Abdul</span><span>Hayee</span></div>
<p class="role">Cloud and DevOps engineer. Pipelines that check themselves.</p>
<div class="btn"><i></i>Audit my infrastructure</div>
<div class="card"><div class="h"><span>portfolio-assets-prod</span></div><div><span>Block public access</span><b>Off</b></div><div><span>Bucket policy</span><b>Public read</b></div><div><span>Default encryption</span><b>None</b></div><div>3 findings open</div></div>
</body></html>`;

(async () => {
  const tmp = path.join(require('os').tmpdir(), 'og-' + process.pid + '.html');
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto('file://' + tmp);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(SITE, 'assets', 'og.png') });
  await b.close();
  fs.unlinkSync(tmp);
  console.log('wrote site/assets/og.png');
})();
