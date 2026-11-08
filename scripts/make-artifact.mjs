// Turns dist-single/index.html (a full HTML document) into a fragment suitable
// for hosts that wrap the page in their own <html>/<head>/<body> skeleton:
// keeps <title>, inline <style> and <script> blocks and the body content.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = readFileSync('dist-single/index.html', 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const body = src.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? '';

const headParts = [];
const titleMatch = head.match(/<title>[\s\S]*?<\/title>/i);
headParts.push(titleMatch ? titleMatch[0] : '<title>BRAIBO</title>');
// Keep styles and scripts from <head>, drop <meta> tags (the host supplies them).
for (const m of head.matchAll(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi)) headParts.push(m[0]);

const out = `${headParts.join('\n')}\n${body.trim()}\n`;
mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/braibo.html', out);
console.log(`dist-artifact/braibo.html ${(out.length / 1024).toFixed(1)} kB`);
