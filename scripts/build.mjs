/**
 * Builds the publishable package: ESM + CJS for every entry point, plus types.
 *
 * Consumers get compiled JavaScript, never the sources — a host bundler is not
 * expected to know how to read TypeScript or the React Native JSX in `native`.
 * Peers (React, React Native, Pixi) stay external so the host keeps a single
 * copy of each; the WebView scene is the one exception, it ships inlined as a
 * string because it cannot go through the host bundler at all.
 *
 *   pnpm build          scene bundle, then this
 *   pnpm build:dist     only this
 */
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {rmSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

const ENTRIES = [
  {in: 'src/core/index.ts', out: 'index'},
  {in: 'src/react/index.tsx', out: 'react'},
  {in: 'src/native/index.tsx', out: 'native'},
];

// Anything the host owns. Bundling a second React or Pixi into the package
// would break hooks and duplicate the WebGL runtime.
const EXTERNAL = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-native',
  'react-native-reanimated',
  'react-native-webview',
  'pixi.js',
];

rmSync(dist, {recursive: true, force: true});

for (const entry of ENTRIES) {
  // ESM keeps the .js extension because `type: module` already marks it as
  // ESM, and Metro only treats known source extensions as JavaScript — a .mjs
  // entry would resolve and then fail to transform on React Native
  for (const [format, ext] of [
    ['esm', 'js'],
    ['cjs', 'cjs'],
  ]) {
    await build({
      entryPoints: [resolve(root, entry.in)],
      outfile: resolve(dist, `${entry.out}.${ext}`),
      bundle: true,
      format,
      platform: 'neutral',
      target: ['es2020'],
      jsx: 'automatic',
      external: EXTERNAL,
      // The native entry is mostly the pre-minified scene bundle as a string —
      // a source map for it would double the tarball and explain nothing
      sourcemap: entry.out !== 'native',
      logLevel: 'warning',
    });
  }
}

// Types come from tsc — esbuild does not produce them
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
execFileSync(process.execPath, [tsc, '-p', resolve(root, 'tsconfig.build.json')], {
  stdio: 'inherit',
  cwd: root,
});

console.log(`dist written — ${ENTRIES.length} entries, esm + cjs + types`);
