# pack-opener-js

Interactive pack-opening animation rendered by PixiJS. One scene, two hosts: the
web and React Native (inside a WebView).

The pack hangs there breathing, a comet mimes the gesture, and the seal is cut
by an actual finger — the tear follows the path the finger took, not a straight
line between two points. The lid flies off, the card rides out, spins to its
face and settles inside a halo tinted to its rarity.

```bash
npm install pack-opener-js
# web: also install pixi.js
# React Native: also install react-native-webview react-native-reanimated
```

## Web

```ts
import {createPackOpener} from 'pack-opener-js';

const opener = await createPackOpener(document.querySelector('#stage'), {
  assets: {pack: {url: pack.url}, card: {url: card.url}},
  theme: {glow: rarityColor},
}, {
  onEvent: event => console.log(event.type, event),
});

opener.autoSlice();   // cut it without a gesture
opener.reset();       // put it back together
opener.setOptions({assets: {pack: {url}}, motion: {speed: 2}});   // retune live
opener.destroy();
```

The engine is imperative on purpose — any framework can call it. For React there
is a component over it:

```tsx
import PackOpener from 'pack-opener-js/react';

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
import PackOpener from 'pack-opener-js/native';

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

`ref` exposes `autoSlice()` and `reset()`; `disabled` covers ignoring input.

The host owns everything around the animation. The package plays no haptics and
ships no typography: it reports intents (`light` / `heavy` / `success`) and
renders whatever `hint`, `topSlot` and `bottomSlot` are given, positioned
against the geometry the scene reports back — so slots sit on the revealed card
on any screen size.

Artwork is fetched by the WebView, so the pack and card URLs must be reachable
from it. Cross-origin images need CORS headers, or the host can hand over data
URLs instead.

## Options

Options can change while the animation is on screen. Pass a new object (React
Native and React) or call `setOptions` on the handle (web) and the running scene
picks it up — durations, colours and gesture thresholds take effect at once, and
anything baked into a texture, such as the card's colours or its size, is rebuilt
on the next `reset()` rather than mid-ceremony. Two things do need a new scene
and cannot be retuned: a different `variant` and different pack artwork. The
wrappers remount by themselves in that case; `setOptions` returns `false` so a
direct caller knows.

Anything left out falls back to the chosen preset, field by field: a `theme`
with only `glow` set keeps the preset's card colours. `PackOpenerOptions` is the
full, commented surface — in short:

A hundred fields in eight groups — enough to build a noticeably different
ceremony out of the same mechanic:

| Group | What it covers |
| --- | --- |
| `variant` | Which animation mechanic runs. Today only `slice`. |
| `preset` | Named set of numbers for that mechanic. Today only `classic`. |
| `assets` | Pack and card artwork, and how long to wait for the card. |
| `theme` | Background, rarity glow, rim, bloom, beam, sparks, hint, the four card-back colours, corner radius. |
| `motion` | Every duration, plus `speed` as one multiplier over all of them. How the lid is thrown, tumbled and faded; how far the emptied wrapper sinks; how the card turns, how thin it goes edge-on, how it is shaded; the beam's width, glow, tip and tail; the sparks' size, scatter and opacity; the opacity of all three glows. |
| `interaction` | What counts as a swipe: activation distance, commit fraction, trail sampling, cut gap and raggedness, the band it may travel through, how the blade runs out, how often progress is reported, and the arc a programmatic cut follows. |
| `layout` | Where the pack sits and how much of the stage it takes; the card's size and widest allowed ratio; the size and softness of the three glows. |
| `hint` | The comet that mimes the swipe: position, sweep, head, tail, tail opacity and falloff, cadence. |
| `performance` | Frame caps for moving, idling and sleeping; ceiling on the device pixel ratio; multisampling. |

What is deliberately *not* in here: easing curves, and the order of the phases
themselves. A different sequence of events is a different mechanic — that is
what a variant is for, and adding one does not touch this shape.

Two levels on purpose. A **variant** is a mechanic with its own scene module; a
**preset** is a set of numbers for one variant. New styles arrive as variants,
new looks as presets, and neither changes the shape above.

`classic` is the animation as it shipped in the app this was built for — every
number in it was measured against the reference recording, so it is the baseline
other presets are judged against.

## Performance

A WebGL canvas the size of a phone screen, redrawn sixty times a second, is what
makes a device hot — and the scene spends most of its life with nothing new to
draw: waiting for a finger, or holding a card that has already settled. So it
throttles itself in three steps, all of them yours to change:

```ts
performance: {maxFps: 60, idleFps: 30, sleepFps: 1, resolutionCap: 2, antialias: true}
```

`maxFps` applies while something moves, `idleFps` while the pack just hangs
there looping the hint, `sleepFps` once nothing changes at all. Commands and the
first touch always restore the full rate immediately, so a sleeping scene never
feels stuck. `resolutionCap` is the ceiling on the device pixel ratio the canvas
is drawn at — phones report 3 and up, and each step multiplies the pixels the GPU
shades for a scene made of soft glows, where the difference is hard to see.

Turn the caps up if you are on a desktop and want it perfectly smooth; turn them
down further on low-end phones.

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
    slice/       the mechanic: declaration, presets, and the scene split
                 into geometry, textures, wrapper, card and hint
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
at hand, and most of the schema is a live control there, grouped the way this
README groups it — the fastest way to see what a number does. Sliders retune the
running scene instead of restarting it.

## Not done yet

The `slice` scene is plain JS, not TypeScript: it is split into modules and is
covered by the variant interface, but typing it would make a second variant
cheaper to write.

## License

MIT
