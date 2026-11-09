// Copies the single-file build to docs/index.html so GitHub Pages can serve it from main (/docs).
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('docs', { recursive: true });
copyFileSync('dist-single/index.html', 'docs/index.html');
writeFileSync('docs/.nojekyll', '');
console.log('docs/index.html updated');
