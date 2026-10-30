#!/usr/bin/env node
/*
 * Static checks for the site. No dependencies. Runs in CI and in the Amplify build,
 * so a broken page or bad game content stops the deploy instead of going live.
 *   node scripts/check-site.js
 */
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'site');
const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const scenarios = require(path.join(SITE, 'js', 'scenarios.js')).scenarios;

const problems = [];
const fail = (msg) => problems.push(msg);

// 1. Required sections and the hint (challenge requirements C-2, C-3, C-4)
['about', 'skills', 'projects', 'contact', 'main'].forEach((id) => {
  if (!new RegExp('id="' + id + '"').test(html)) fail('missing section #' + id);
});
if (!/id="open-audit"/.test(html)) fail('missing the visible hint button #open-audit');
if ((html.match(/<h1[\s>]/g) || []).length !== 1) fail('page must have exactly one h1');
if (!/<title>[^<]{5,}<\/title>/.test(html)) fail('missing page title');
if (!/<meta name="description" content="[^"]{40,}"/.test(html)) fail('missing meta description');
if (!/<html lang="/.test(html)) fail('missing html lang');

// 2. Content-security-policy friendliness: no inline script, style, or event handlers
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail('inline <script> found (CSP forbids it)');
if (/<style[\s>]/i.test(html)) fail('inline <style> found (CSP forbids it)');
if (/\sstyle="/i.test(html)) fail('inline style attribute found (CSP forbids it)');
if (/\son[a-z]+="/i.test(html)) fail('inline event handler found (CSP forbids it)');

// 3. Privacy: no phone numbers on a public page
if (/\+\s?92[\s\d-]{8,}|\b03\d{2}[\s-]?\d{7}\b/.test(html)) fail('a phone number is on the page');

// 4. No leftover markers
if (/TODO|FIXME|lorem ipsum|\[\[/i.test(html)) fail('placeholder text found in index.html');

// 5. Every image has alt text; every local file reference exists
(html.match(/<img\b[^>]*>/g) || []).forEach((tag) => {
  if (!/\balt="[^"]{10,}"/.test(tag)) fail('image without useful alt text: ' + tag.slice(0, 80));
});
const refs = [...html.matchAll(/\b(?:src|href)="([^"#:]+?)(?:#[^"]*)?"/g)].map((m) => m[1]);
refs.forEach((ref) => {
  if (ref.startsWith('mailto') || ref.startsWith('http')) return;
  if (!fs.existsSync(path.join(SITE, ref))) fail('missing file: ' + ref);
});
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
[...html.matchAll(/href="#([^"]+)"/g)].forEach((m) => { if (!ids.has(m[1])) fail('broken in-page link: #' + m[1]); });
[...html.matchAll(/\bid="([^"]+)"/g)].forEach((m, i, all) => {
  if (all.findIndex((x) => x[1] === m[1]) !== i) fail('duplicate id: ' + m[1]);
});

// 6. External links are https
[...html.matchAll(/href="(http[^"]+)"/g)].forEach((m) => { if (!m[1].startsWith('https://')) fail('non-https link: ' + m[1]); });

// 7. Game content
const seen = new Set();
scenarios.forEach((s) => {
  if (seen.has(s.id)) fail('duplicate scenario id ' + s.id);
  seen.add(s.id);
  if (s.options.filter((o) => o.correct).length !== 1) fail(s.id + ': needs exactly one correct option');
  if (s.options.length !== 4) fail(s.id + ': needs 4 options');
  s.options.filter((o) => !o.correct).forEach((o) => { if (!o.hint) fail(s.id + ': wrong option without a hint'); });
  if (!ids.has(s.unlock.target.replace('#', ''))) fail(s.id + ': unlock target ' + s.unlock.target + ' not on the page');
  if (!new RegExp('data-case="' + s.id + '"').test(html)) fail(s.id + ': no case-file row in index.html');
});
if (scenarios.filter((s) => !s.bonus).length < 3) fail('need at least 3 core scenarios');

// 8. Security header file must agree with the page
const headers = fs.readFileSync(path.join(__dirname, '..', 'customHttp.yml'), 'utf8');
['Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy'].forEach((h) => {
  if (!headers.includes(h)) fail('customHttp.yml is missing ' + h);
});

if (problems.length) {
  console.error('check-site: ' + problems.length + ' problem(s)');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('check-site: OK (' + scenarios.length + ' scenarios, ' + ids.size + ' ids, ' + refs.length + ' file references)');
