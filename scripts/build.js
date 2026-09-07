import { build } from 'esbuild';
import { cp, rm, mkdir } from 'node:fs/promises';

const DIST = 'dist';

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

// 정적 파일을 그대로 옮기고, 워커는 단일 파일로 번들해 _worker.js로 둔다.
await cp('public', DIST, { recursive: true });

const result = await build({
  entryPoints: ['src/worker.js'],
  outfile: `${DIST}/_worker.js`,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  conditions: ['workerd', 'worker', 'browser'],
  minify: true,
  metafile: true,
});

const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log(`build 완료: dist/_worker.js ${(bytes / 1024).toFixed(1)} KiB`);
