/**
 * Bakes the ceremony's sounds into the core as data URIs.
 *
 * The scene runs inside react-native-webview with no asset server behind it,
 * so like the default stand it carries its sounds rather than fetching them.
 * The module is only ever imported dynamically: a web host's bundler splits it
 * off, and a host that leaves sound off never loads it.
 *
 * Run after adding or replacing a file in assets/sounds:
 *   pnpm build:sounds
 *
 * With --check it builds nothing and only verifies the committed module
 * matches the files.
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'assets/sounds');
const out = resolve(root, 'src/core/sound/samples.js');

const manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
const entries = Object.entries(manifest).map(
  ([cue, file]) =>
    `  ${JSON.stringify(cue)}: 'data:audio/mpeg;base64,${readFileSync(resolve(dir, file)).toString('base64')}',`,
);
const contents =
  `// GENERATED FILE — do not edit.\n` +
  `// Built from assets/sounds by scripts/buildSounds.mjs.\n` +
  `export default {\n${entries.join('\n')}\n};\n`;

const kb = (contents.length / 1024).toFixed(0);

if (process.argv.includes('--check')) {
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (current !== contents) {
    console.error('samples.js is out of date — run `pnpm build:sounds` and commit the result.');
    process.exit(1);
  }
  console.log(`samples.js is up to date — ${entries.length} cues, ${kb} KB`);
} else {
  writeFileSync(out, contents);
  console.log(`samples.js written — ${entries.length} cues, ${kb} KB`);
}
