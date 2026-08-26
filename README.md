# @collectbase/pack-opener

Interactive pack-opening animation rendered by PixiJS. One scene, two hosts: the
web and React Native (inside a WebView).

The pack hangs there breathing, a comet mimes the gesture, and the seal is cut
by an actual finger — the tear follows the path the finger took, not a straight
line between two points. The lid flies off, the card rides out, spins to its
face and settles inside a halo tinted to its rarity.

```bash
npm install @collectbase/pack-opener
# web: also install pixi.js
# React Native: also install react-native-webview react-native-reanimated
```

## Web

```ts
import {createPackOpener} from '@collectbase/pack-opener';

const opener = await createPackOpener(document.querySelector('#stage'), {
  assets: {pack: {url: pack.url}, card: {url: card.url}},
  theme: {glow: rarityColor},
}, {
  onEvent: event => console.log(event.type, event),
});

opener.autoSlice();   // cut it without a gesture
opener.reset();       // put it back together
opener.destroy();
```

The engine is imperative on purpose — any framework can call it. For React there
is a component over it:

```tsx
import PackOpener from '@collectbase/pack-opener/react';

<PackOpener
  options={{assets: {pack: {url: pack.url}}, theme: {glow: rarityColor}}}
  onOpenComplete={callOpenApi}
  onRevealComplete={showResult}
/>;
```

Input goes through pointer events, so the cut follows a finger, a stylus or a
mouse with no separate code path.

## React Native

```tsx
import PackOpener from '@collectbase/pack-opener/native';

<PackOpener
  ref={openerRef}
  options={{
    assets: {pack: {url: pack.url}, card: {url: card.url}},
    theme: {glow: rarityColor},
  }}
  disabled={busy}
  hint={<Text>Slice the seal to open</Text>}
  topSlot={title}
  bottomSlot={actions}
  renderFallback={() => <MyImage uri={pack.url} />}
  onHaptic={intent => Haptics.trigger(intent)}
  onInteractionStart={hideChrome}
  onOpenComplete={callOpenApi}
  onRevealComplete={showResult}
/>;
```

`ref` exposes `autoSlice()`, `reset()` and `setEnabled()`.

The host owns everything around the animation. The package plays no haptics and
ships no typography: it reports intents (`light` / `heavy` / `success`) and
renders whatever `hint`, `topSlot` and `bottomSlot` are given, positioned
against the geometry the scene reports back — so slots sit on the revealed card
on any screen size.

Artwork is fetched by the WebView, so the pack and card URLs must be reachable
from it. Cross-origin images need CORS headers, or the host can hand over data
URLs instead.

## Options

Anything left out falls back to the chosen preset, field by field: a `theme`
with only `glow` set keeps the preset's card colours. `PackOpenerOptions` is the
full, commented surface — in short:

| Group | What it covers |
| --- | --- |
| `variant` | Which animation mechanic runs. Today only `slice`. |
| `preset` | Named set of numbers for that mechanic. Today only `classic`. |
| `assets` | Pack and card artwork, and how long to wait for the card. |
| `theme` | Background, rarity glow, rim, beam, sparks, hint, card back, corner radius. |
| `motion` | Every duration, plus `speed` as a single multiplier over all of them. |
| `interaction` | What counts as a swipe: activation distance, commit fraction, trail sampling, cut gap and the band it may travel through. |
| `layout` | Card size relative to the pack. |
| `hint` | The comet that mimes the swipe: position, sweep, tail, cadence. |

Two levels on purpose. A **variant** is a mechanic with its own scene module; a
**preset** is a set of numbers for one variant. New styles arrive as variants,
new looks as presets, and neither changes the shape above.

`classic` is the animation as it shipped in the app this was built for — every
number in it was measured against the reference recording, so it is the baseline
other presets are judged against.

## Events

Both hosts see the same sequence, as callbacks on the web and as props on React
Native: the gesture starts, the pack commits to being cut, the lid comes off
(`onOpenComplete` — the moment to call an open API, the reveal that follows buys
the request its time), and the whole ceremony ends (`onRevealComplete`).

## Requirements

- **Web**: `pixi.js` ^8 and a WebGL-capable browser. `react` ^18 or ^19 for the
  `/react` entry.
- **React Native**: 0.79 or newer (the package is resolved through `exports`),
  plus `react-native-webview` and `react-native-reanimated`. Pixi is *not*
  needed — it is compiled into the scene bundle and never reaches the host's
  `node_modules`.

## Adding an animation style

A **variant** is a mechanic — how the pack opens and what the reveal looks like.
A **preset** is a named set of numbers for one variant. Hosts pick both:

```ts
createPackOpener(el, {variant: 'slice', preset: 'classic', assets: {…}});
```

A variant declares itself and nothing else in the package changes — not the
engine, not either wrapper:

```ts
// src/core/variants/tear/index.ts
export const tear: VariantModule = {
  id: 'tear',
  presets: PRESETS,          // its own numbers; `resolveOptions` reads them
  defaultPreset: 'classic',
  create({app, texture, options, emit}) {
    return new TearScene(app, texture, options, emit);
  },
};
```

`create` gets a live Pixi app, the loaded pack texture, options with every field
already filled in, and `emit`. It returns the instance the engine drives:
`update(deltaMS)`, the gesture (`onDown` / `onMove` / `onUp`), `autoSlice`,
`reset`, `setEnabled`, `setCardTexture`, a `rect` telling hosts where the pack
was drawn, and an optional `destroy`. Full definitions with comments are in
`src/core/variants/types.ts`.

Register it in `src/core/variants/index.ts` and add its name to `VariantName` in
`src/core/config/types.ts`. Defaults resolve through the variant, so a new
mechanic never inherits numbers that were tuned for a different one.

## Working on the package

```
src/core/        the engine: createPackOpener(element, options) → handle
  config/        the public option surface: types, resolve, bridge protocol
  runtime/       shared helpers (colour parsing)
  variants/      one folder per animation style; today only `slice`
    types.ts     what a variant must provide
    index.ts     the registry
    slice/       the mechanic: declaration, presets, scene
src/react/       React component for the web, over the engine
src/native/      React Native wrapper: WebView + bridge + geometry-driven slots
  webviewEntry.js  what gets bundled: engine + bridge
  sceneBundle.js   GENERATED — that bundle, with Pixi, as a JS string
playground/      Vite demo: every option as a live control
scripts/         build tooling
```

Both hosts run the same engine. The scene itself knows nothing about where it
lives: it draws, reads the gesture it is handed, and reports through `emit` —
which becomes a callback in a browser and a `postMessage` across the WebView
bridge on React Native.

The scene cannot go through Metro, so it is bundled ahead of time. The committed
bundle must match the sources:

```bash
pnpm build           # scene bundle, then dist
pnpm verify:scene    # fails when the committed bundle is stale
pnpm typecheck
pnpm playground      # http://localhost:5173 — /index.html and /react.html
```

The playground runs on built-in placeholder artwork, so it works with no assets
at hand, and every option in the schema is a live control there — the fastest
way to see what a preset change does.

## Not done yet

`slice/scene.js` is still one 1100-line file in plain JS. It works and is
covered by the variant interface, but splitting it into pack / tear / reveal /
hint modules — and typing it — would make a second variant cheaper to write.

## License

MIT
