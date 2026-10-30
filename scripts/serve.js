#!/usr/bin/env node
/*
 * Local static server that applies the same headers Amplify will (from customHttp.yml),
 * so a CSP mistake shows up on your laptop instead of after a deploy.
 *   node scripts/serve.js [port]      then open http://localhost:8080
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'site');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };

// Read the headers for the catch-all pattern: lines of  - key: 'X' / value: '...'
const yml = fs.readFileSync(path.join(__dirname, '..', 'customHttp.yml'), 'utf8');
const firstBlock = yml.split(/\n  - pattern:/)[1] || '';
const headers = {};
for (const m of firstBlock.matchAll(/key: '([^']+)'\s*\n\s*value: (?:'([^']*)'|"([^"]*)")/g)) headers[m[1]] = m[2] !== undefined ? m[2] : m[3];

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, Object.assign({ 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }, headers));
    res.end(data);
  });
}).listen(PORT, () => console.log('Serving site/ with Amplify headers on http://localhost:' + PORT + ' (' + Object.keys(headers).length + ' headers)'));
