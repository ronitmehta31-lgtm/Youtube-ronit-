// Inline the icon, drop the manifest link (no server to serve it), name the file.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const icon = 'data:image/svg+xml;base64,' + readFileSync('public/icon.svg').toString('base64');
let html = readFileSync('release/index.html', 'utf8');
html = html.replaceAll('./icon.svg', icon).replace(/<link rel="manifest"[^>]*>\s*/, '');
writeFileSync('release/index.html', html);
renameSync('release/index.html', 'release/bahi.html');
console.log('release/bahi.html', (html.length / 1024).toFixed(0) + ' KB');
