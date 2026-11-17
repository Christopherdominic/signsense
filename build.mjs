import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';

if (!existsSync('src/config.js')) {
  console.error('\nMissing src/config.js. Copy src/config.example.js to src/config.js and add your Firebase config.\n');
  process.exit(1);
}
const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
for (const f of ['manifest.json', 'review.html', 'review.css', 'popup.html', 'icons']) cpSync(`src/${f}`, `dist/${f}`, { recursive: true });

const common = { bundle: true, target: 'chrome139', sourcemap: true, logLevel: 'info' };
const builds = [
  // Extension pages: ES modules that bundle the Firebase SDK (no remote code, as MV3 requires).
  { ...common, entryPoints: ['src/review.js', 'src/popup.js'], outdir: 'dist', format: 'esm', splitting: true, chunkNames: 'chunks/[name]-[hash]' },
  { ...common, entryPoints: ['src/background.js'], outdir: 'dist', format: 'esm' },
  // Content scripts cannot be modules: bundle as classic IIFE scripts.
  { ...common, entryPoints: ['src/inject.js', 'src/content.js'], outdir: 'dist', format: 'iife' },
];
if (watch) {
  for (const b of builds) await (await esbuild.context(b)).watch();
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
}
