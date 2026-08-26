/**
 * Bundles the Pixi scene for the React Native WebView.
 *
 * The scene runs inside react-native-webview, so it cannot go through Metro —
 * esbuild tree-shakes Pixi down to what the scene actually uses and the result
 * is written as a JS string module that the native wrapper inlines into its
 * HTML. The entry is the WebView bridge; the engine itself is in `src/core`.
 *
 * Run after every change to the scene or its config defaults:
 *   pnpm build:scene        (or `pnpm build:pack-opener` from the app root)
 *
 * With --check it builds nothing and only verifies that the committed bundle
 * matches the sources — the build is deterministic, so a mismatch means someone
 * edited the scene and forgot to rebuild:
 *   pnpm verify:scene
 */
import {build} from 'esbuild';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const entry = resolve(root, 'src/native/webviewEntry.js');
const out = resolve(root, 'src/native/sceneBundle.js');

const result = await build({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome100', 'safari15'],
  legalComments: 'none',
  write: false,
  logLevel: 'info',
});

const code = result.outputFiles[0].text;
const contents =
  `// GENERATED FILE — do not edit.\n` +
  `// Built from src/native/webviewEntry.js by scripts/buildScene.mjs.\n` +
  `export default ${JSON.stringify(code)};\n`;

const kb = (code.length / 1024).toFixed(0);

if (process.argv.includes('--check')) {
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (current !== contents) {
    console.error(
      'sceneBundle.js is out of date — run `pnpm build:scene` and commit the result.',
    );
    process.exit(1);
  }
  console.log(`sceneBundle.js is up to date — ${kb} KB of JS`);
} else {
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, contents);
  console.log(`sceneBundle.js written — ${kb} KB of JS`);
}
