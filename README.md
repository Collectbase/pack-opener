# pack-opener-js

Interactive pack-opening animation rendered by PixiJS. One scene, two hosts: the
web and React Native (inside a WebView).

The pack hangs there floating, light crossing its foil, a comet mimes the
gesture, and the seal is cut by an actual finger — the tear follows the path
the finger took, not a straight line between two points, glowing and throwing
sparks as it goes. The lid flies off, light pours out of the pack, the card
rises face down, gathers itself in its rarity colour and turns over in
perspective onto its stand.

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

opener.autoSlice();   // open it without a gesture
opener.shuffle();     // carousel: spin the ring on
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

`ref` exposes `autoSlice()`, `shuffle()` and `reset()`; `disabled` covers
ignoring input.

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
wrappers remount by themselves in that case; `setOptions` returns `'scene'` so
a direct caller knows (`'applied'` when the change took at once, `'deferred'`
when it waits for `reset()`).

Anything left out falls back to the chosen preset, field by field: a `theme`
with only `glow` set keeps the preset's card colours. `PackOpenerOptions` is the
full, commented surface — in short:

Well over two hundred fields, in the groups below — enough to build a
noticeably different ceremony out of the same mechanic:

| Group | What it covers |
| --- | --- |
| `variant` | Which animation mechanic runs: `slice`, `burst`, `carousel` or `climb`. |
| `preset` | Named set of numbers for that mechanic: `classic` for `slice`, `charged` for `burst`, `showcase` for `carousel`, `spectrum` for `climb`. |
| `assets` | Pack and card artwork, how long to wait for the card, and — for `carousel` — the card's `facts` (`{label, value}` pairs) and its tier `badge` (`{label, color}`), which it tells before the card is shown. `slice` and `burst` write the same `badge` behind the landed card when `motion.reveal.badgeWord` is on. `climb` takes its cards from `setCards` instead, waiting `card.timeoutMs` for each. |
| `theme` | Background, rarity glow, rim, bloom, beam, sparks, the light of the cut, hint, the card back's colours and print, corner radius, the font of the badge's word behind the card (`badgeFont`). |
| `motion` | Every shared duration, plus `speed` as one multiplier over all of them. How the lid is thrown, tumbled and faded; how far the emptied wrapper sinks; how thin the card goes edge-on in a flat turn and how it is shaded; the beam's width, glow, tip and tail; the opacity of all three glows, the phases they are off in (`reveal.glowDuring`) and how long they take to go out or come back between them (`reveal.glowFadeMs`); a light that keeps the pull's colour to itself until the card turns, taking a colour out of `reveal.chargeCycleColors` by chance each time the beam rounds a corner and landing on the pull's own just before the turn (`reveal.chargeCycle`, `slice`, off by default); the pull's `badge` as a giant outline word behind the landed card (`reveal.badgeWord`, `slice` and `burst`, off by default); the card's own flourish. |
| `interaction` | **`slice` only.** What counts as a swipe: activation distance, commit fraction, trail sampling, cut gap and raggedness, the band it may travel through, how the blade runs out, how often progress is reported, and the arc a programmatic cut follows. |
| `layout` | Where the pack sits and how much of the stage it takes; the card's size and widest allowed ratio; the size and softness of the three glows. |
| `rest` | Where the revealed card and its stand come to rest, given outright in css px (`card` box, `pedestal` left/width/bottom) — for a host whose own layout decides; absent, `layout` decides. |
| `hint` | **`slice` only.** The comet that mimes the swipe: position, sweep, head, tail, tail opacity and falloff, cadence. |
| `slice` | **`slice` only.** The pack's float, the light crossing its foil and the glow round its outline; the seam, the light under the blade and the sparks off it; the flare, the spray and the jolt when the seal gives, and the light pouring out; the card's charge — beam laps, halo, printed star, sway, tremble — its turn in perspective, the landing with its push, knock and glints, and the embers after it. |
| `charge` | **`burst` only.** How long a full charge takes and how fast it bleeds away; the shudder and squeeze of a pressured pack; the heat, halo, bloom and progress arc it lights up with; the sparks pulled in from outside; the breath of an untouched pack. |
| `carousel` | **`carousel` only.** The ring: how many copies, its radius, how far they turn with it and how they gather toward the front, the lens and the eye's height, how a copy fades and shades as it turns away, the hover; the idle drift, the shuffle, the finger's turn and the settle; the drop, the rise and how large the held pack grows; the float; the dissolve, the pacing of the facts, the banner's slide, hold and tilt, the flip; the floor reflection. |
| `burst` | **`burst` only.** The blast: flash, the grid the foil is torn into and how uneven that cut is, when the shards start burning as sparks and when they fade, plus the spikes, shock rings, debris streaks and glitter thrown off with them. Then the beat of quiet, and the card's arrival: the dust cloud, the grid the artwork is cut into, how far out its pieces start and how they are staggered, when the finished card comes up underneath them, the landing push and the ring that goes out with it. |
| `climb` | **`climb` only.** How many items stand on the grid (`count`); the colours they glow in while they spin (`cycleColors`, lowest tier first), a fresh one each time an item stands edge-on; how far the artwork takes the colour (`tint`) and how far a spinning pack is flooded with it as a coloured foil (`flood`); the white flash as the hits turn (`flash`); the price over a turned card (`price`: `prefix`, `suffix`, `decimals` — given, not looked up, as a host's currency is not always an ISO one); and the pace: the fly-in (`introMs`), one turn of the spin (`spinMs`), the shortest reel counted from the start (`reelMinMs`), the gaps between stops and between turns (`stopStaggerMs`, `flipStaggerMs`), the hits' hold (`hitHoldMs`) and the price's count (`rollUpMs`). Colours, tint and the pace apply at once, mid-ceremony too; a new `count` waits for `reset()` or the next `start()` once a ceremony has begun. |
| `performance` | Frame caps for moving, idling and sleeping; ceiling on the device pixel ratio; multisampling. |
| `sound` | The ceremony's sound, off unless `enabled`: its `volume`, the player's own `muted`, the pull's `badge`, which decides how hard the landing hits, and the host's own `samples` laid over the baked cues. See [Sound](#sound). |

What is deliberately *not* in here: easing curves, and the order of the phases
themselves. A different sequence of events is a different mechanic — that is
what a variant is for, and adding one does not touch this shape.

Two levels on purpose. A **variant** is a mechanic with its own scene module; a
**preset** is a set of numbers for one variant. New styles arrive as variants,
new looks as presets, and neither changes the shape above. Groups marked above
as belonging to one mechanic are only filled in when that mechanic runs, so a
host cannot spend an afternoon tuning knobs the running scene never reads.

`classic` is the animation as it shipped in the app this was built for — every
number in it was measured against the reference recording, so it is the baseline
other presets are judged against.

## The four mechanics

**`slice`** — the seal is cut with a finger. The cut follows the trail and
glows behind the blade, sparks flying off it; when it gives the lid tears
away, light pours out of the pack, the emptied wrapper sinks and the card
rises out past the lip face down, a plain card of white light. It gathers
itself — a beam in its colour lapping its edge, the halo behind it filling
with that colour — and turns over in perspective onto its stand, glints
catching on the artwork as it lands. It asks for a small piece of skill and
rewards a confident swipe.

**`burst`** — the pack is held under a finger and the pressure builds: it
shudders, squeezes, heats up from the inside and a line closes around it showing
how far the charge has come. At full charge it goes off: a flash, spikes of
light, shock rings, and the wrapper torn into a few hundred shards that burn out
as they fly, with debris streaking out and glitter left hanging in the air. Then
a beat of quiet — held, not empty, the glitter is still drifting. The card does
not slide in: dust gathers where it will be, resolves into pieces of the
artwork, and they fly into place until the card is whole. What marks the
landing is the card itself — its outline swells and a highlight runs across the
artwork — rather than anything thrown at it. It asks for nerve rather than aim,
and the wait is the point.

Both halves are cut by the same knife. The artwork — wrapper first, card
after — is re-cut into a mosaic: one grid of nodes pushed off true, every edge
torn along points both of its cells share. Pieces that interlock are what let
the wrapper look whole until it bursts and the card arrive as a card rather
than as a grid with gaps in it.

**`carousel`** — copies of the pack stand on a turntable, each turned with
the ring and facing out, seen from in front and a little above and mirrored
in the floor: the front one lit, the ones beside it turned away in
perspective, the two round the back seen from behind between them. A shuffle spins the ring round,
settles it on another copy and chooses it; a finger turns it, and let go it
coasts and settles on the nearest. A tap on a copy chooses it too: it drops off the ring as its neighbours fade and rises alone to
centre stage, where it floats until it is tapped again — the host opens the
pack server-side in between, and the float lasts as long as that takes,
nothing looping. The second tap dissolves the pack and the pull is told
before it is shown: its facts fade in one under the other, a long one wrapping
to the stage's width, then a pill in the
tier's colour, and for a tier worth shouting about a banner slides across the
stage with the tier's name running along it. Then the blank card flips over
into the artwork. It asks for nothing but a choice, and the telling is the
point: the reveal is read before it is seen.

**`climb`** — the whole purchase opens on one stage. One pack flies in from
the centre and splits into a grid of as many as were bought — one alone and
large, two or three in a row, up to nine in threes, sixteen in fours — each
the pack's own artwork in its own silhouette, and they spin in perspective
as packs are — flat at the sealed edges, swelling over the card inside,
the slopes of the swell in shade or catching the light as they turn —
each in a colour of its own that keeps changing and keeps clear of its
neighbours', so nothing in the spin gives the pull away. They do not start
together or in a row: one here, one there, in an order drawn afresh every
time, each turning slowly at first and then taking off all at once, and each
at a speed of its own from there — on the reel an item turns one and a half
to two times as fast as the `spinMs` turn the rest of the ceremony is paced
by. The host starts it
the moment the player buys and hands the cards over when the purchase
answers. Once they are in and the reel has run its shortest, the items stop
one by one in grid order, each taking its tier's colour only as it comes to
rest; the ordinary cards turn over in grid order, each with its price there
at once over its top edge — large, gold, counted up in the time it takes to
notice it, stars twinkling at its sides — and its tier written under it; the
hits wait, tremble, then turn together under a white flash; the host's combo
line — `DOUBLE GRAIL`, `MATCH ×3 · GRAIL` — is written under the grid in the
hits' light; and then every price leaves its card and they fly together into
one place over the grid, where the host writes the total (`climb.gatherY`),
each card keeping its price small under its tier. A price takes the time it
takes however the ceremony is hurried: hurried, the cards come sooner, not
the figures faster. A tap on a card after that is the host's to answer. When
the next ceremony begins the cards on show are whisked away — edge-on, small,
gone — and the stage is thrown.
It asks for nothing but a moment, and the order is the point: every colour
is seen before any card, and the best come last.

The mechanics share no part of their finish, on purpose: a second animation
that ends in the same spinning card back is not a second animation. `slice`
charges the card face down and turns it over in perspective; `burst` tears the wrapper into
pieces and then builds the card out of pieces; `carousel` tells the card in
words and then flips it over; `climb` lets a whole grid settle on its colours
before a single card turns. What the first three share is the card object,
its stand and the events, so a host swaps one for another with a single
option and changes nothing else. `climb` opens a purchase rather than a pack,
on the host's word, so it is driven with commands of its own.

Three numbers in `charged` carry most of its feel: `charge.holdMs`, the length
of the anticipation; `burst.beatMs`, the quiet between the blast and the dust —
borrowed from slot design, where the gap before the last reel stops is what
makes a result feel considered rather than rushed; and
`burst.assembleStagger`, which decides whether the card fills in from the
middle outwards or arrives as one flat sheet.

### Driving the climb

```ts
const opener = await createPackOpener(stage, {
  variant: 'climb',
  climb: {count: 8},
  assets: {pack: {url: pack.url}},
}, {onEvent});

opener.start();                     // the player buys: the items fly in and spin
await opener.setCards(cards, {combo: 'DOUBLE GRAIL'});   // the purchase answers
opener.setSpeed(2);                 // Speed up — 1, 2, 3 or 4 — at once
opener.skipToEnd();                 // every card up now, prices and combo with it
opener.markSold([0, 3]);            // sold since they came: stamped SOLD, dimmed, SOLD under them
opener.cue('coins');                // a sound for a moment of the host's own
opener.reset();                     // the empty grid again, at 1×
```

`cards` are `ClimbCard`s in grid order: the artwork's `url`; the `color` its
item stops on — the host maps its tiers onto `climb.cycleColors`, the pack's
top tier on the last; `hit` for a card held back to turn with the other hits,
last; the `price` written under it, none when left out; the `tier`'s name,
written under the price in the tier's light; and `sold` for a card sold with
the purchase, which dims once its price has counted and is stamped `SOLD`
across its face — red ink, coming down as a rubber stamp does — `SOLD` in
place of its tier. `markSold(indices)` does the same for cards sold later — at once
for a card that is up, once its price has counted for one that is not, and after the cards of a `setCards` still loading. The combo is the
host's own words, drawn as given; the line under the grid is kept whether
one comes or not — room made only for one would give the hits away before
they stop.

The grid takes the columns that show the batch largest on the stage it has
— ten stand 4-4-2 on a phone and 5-5 on a wide screen — with room under
every card for its price and tier. Every card has the one shape
(`layout.card.aspect`): the artwork whole on light paper, whatever the
photo's own shape. Prices, tiers and the combo are set in `climb.font`, the
host's family as CSS names it (a system family by default).

As a card's face comes up it pops its light and throws a burst in its colour
— light, never debris — then takes one band of sheen across its face
(`climb.sparkle`, on by default; less each the more cards there are). The
burst comes in three styles (`climb.reveal`): `flare`, a ring of light and
short rays with stars; `motes`, soft glowing motes rising off the card;
`pixels`, small square sparks that drift up like the dust. A hit throws
about twice as much, gets a star at its corner and a wider light that stays.
Behind it all dust rises all the time (`climb.dust`, on by default): small
square motes, most of them white, thick at the foot of the stage, shaken
with the stage — the far ones less than the near — so it is the whole world
that takes a blow, not the cards alone; while it rises the stage does not go
to sleep. The stage itself takes the blows (`climb.shake`, 0..1, 1 by default):
the pack coming down and bursting into the grid, the first card landing on
its face (a card alone the harder the higher its tier), the hits coming round
under the flash and landing, and every beat of the combo — which counts the
hits out one by one, each pulsing in its turn. A shake is a run of poses held
a thirtieth of a second each, thrown to one side and the other and dying
away; it lasts what it lasts however the ceremony is hurried. The cards move
as one with what they throw off; the prices, the tiers and the combo stand
still, so a card slides under its own price — and nothing of the host's page
moves. `opener.shake(strength)` strikes on the host's word — a sold sum
reaching the balance, say. A ceremony skipped to its end throws and shakes
nothing.

Call `start()` once per batch the player buys, then `setCards`. Cards sent a
moment before `start()` are not lost: still loading, they land in its
ceremony; already in, the ceremony they began goes on as this one while it
spins. The grid is laid out for up to sixteen, so a bigger batch is shown as
several grids: each grid after the first goes through `setCards` alone, once
the one before it is up (`allRevealed`), and begins a ceremony of its own.
Sent while a ceremony still spins, `setCards` replaces its cards; with none
spinning — none started, its items begun to stop, or all of them up — it
begins its own. An empty list ends the ceremony on show, or one of its own,
at once on an empty grid: `phase` `done`, then `allRevealed` with no cards —
for a purchase that answered with nothing to show; `start()` brings the grid
back. Each artwork is loaded outside Pixi's shared cache, decoded no larger
than the climb draws a card at `performance.resolutionCap`, and freed once
the scene lets the cards go — the next batch, `reset()`, `destroy()` — so a
long session does not grow and a phone's photos are not held at full size;
one that fails, or is not in within `assets.card.timeoutMs`, turns into a
blank card. `setCards` resolves once the cards are handed over, not once
they are shown.

`setSpeed` hurries the spin alone from the next frame, whatever is under
way: the reel, its colours, its shortest run and the stops. The fly-in, the
cards turning, the hits, the combo, the prices and the gather always run at
1× — the player hurries the wait, not the reveal. `start()` and
`reset()` put it back to 1×, and a ceremony `setCards` begins on its own
keeps the pace already set — so a host whose Speed up shows more than 1×
sends `setSpeed` again after each `start()`.

`skipToEnd()` lands the ceremony at its end at once, with no flash: what the
host has not been told yet comes now, in the usual order and marked
`skipped: true`, then `allRevealed`. Sent right after `setCards` — for a
player who skips every animation — it is kept for those cards, even with
nothing started, and they land at their end the moment they are in; until
then whatever is on show plays on at its pace, even a ceremony whose earlier
cards are already in. With nothing loading it does nothing before `start()`
or once every card is up.

The climb's events, in the order they come: `phase` `intro`, `reel` and
`settle`; `cardSettled` for each item come to rest, in grid order, with its
colour's place in `cycleColors` (`colorIndex`, for a sound that rises with
the tier); `phase` `turn` and `cardRevealed` for each ordinary card, with
where it is (`card`); `phase` `hits`, `hitsRevealed` as the hits come round
and `cardRevealed` for each of them; `phase` `combo` when there is one;
`phase` `done` and `allRevealed`, with where every card is — once per
ceremony. After that, `cardTap` with the `index` of a card tapped. A host
may answer any of them with `skipToEnd()`, `start()` or `reset()` on the
spot: a ceremony replaced or reset that way says nothing more. The
`timeline` carries `introMs`, `spinMs`, `reelMinMs`, `stopStaggerMs`,
`flipStaggerMs`, `hitHoldMs` and `rollUpMs`.

The React component has the same commands on its handle and the events as
props:

```tsx
<PackOpener
  ref={climbRef}
  options={{variant: 'climb', climb: {count}, assets: {pack: {url: pack.url}}}}
  onCardRevealed={index => trackRevealed(index)}
  onAllRevealed={showSellAll}
  onCardTap={openCard}
/>;
```

`onCardSettled`, `onCardRevealed`, `onHitsRevealed`, `onAllRevealed` and
`onCardTap` stand for the events above. Commands sent before the scene is up
wait for it and run in order once it is, so a host can `start()` the moment
it mounts the component; once no scene is coming — unmounted, or its mount
failed (`onError`) — they are dropped as they are sent, and a dropped
`setCards` resolves: it never rejects. The React Native wrapper has no
`start` or `setCards` yet, so the climb runs on the web.

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

## Sound

The ceremony can be heard: the foil tearing under the finger, the lid coming
off, the sweep and the impact as the card lands, the burst's blast, the
carousel's clicks, whooshes and chime, the climb's tick under the spinning
grid and its clicks as the items come to rest, higher the higher the tier,
with a swish per card and a stinger as the hits come round — what a skip
passes over stays silent. Each mechanic has its own score, played
on the scene's own events with Web Audio wherever the scene runs — the browser
on the web, the WebView on React Native — so a host wires nothing. It is **off
by default**; turn it on with an option:

```ts
sound: {enabled: true, volume: 0.8, muted: false, badge: 'Big Hit'}
```

`volume` is the master level (0.8 when left out). `muted` is for the player's
own mute button: pass the new options and what is playing fades out, while the
score keeps its place — lift the mute mid-ceremony and the next cue is heard.
`badge` is the pull's badge as the platform names it (Grail, Chase, Big Hit,
Epic, Rare); the bigger the pull, the harder the landing hits. It may arrive
late, with the card, and falls back to `assets.card.badge`'s label. The
climb needs no `badge`: its hits are the pack's top tier by construction, so
they come round on an epic's stinger at least, and on a grail's when `badge`
names one.

A host that already scores the ceremony itself from the events (`onPhase`,
`onProgress`, `onTimeline` and the rest) keeps `sound` off, or drops its own
score when it turns this one on — with both, every cue plays twice.

The sounds are baked into the package, so there is nothing to host or fetch.
On the web they sit in a chunk of their own that is only loaded once sound is
on; the React Native wrapper lets its WebView start audio without a touch
inside the page, so a pack opened with `autoSlice` is heard too. On iOS the
session is ambient where the browser lets it be set: the ringer switch silences
the ceremony and the player's music keeps playing. The files and their
licences are listed in `assets/sounds/CREDITS.md`; replace one there and run
`pnpm build:sounds`.

A host with sounds of its own lays them over the baked ones by cue name, a URL
or a `data:` URI each:

```ts
sound: {
  enabled: true,
  samples: {'reveal-sweep': '/sounds/sweep.mp3', impact: '/sounds/impact.mp3'},
}
```

The cues are the keys of `assets/sounds/manifest.json`. The files are read
once, when sound is first on; one that will not load leaves the baked cue in
place. In the React Native WebView only `data:` URIs are sure to load. The
score's timing is tuned to the baked files — `reveal-sweep` starts 2 s before
the card lands, `impact` 0.94 s before it hits, `blast` 0.57 s before the
flash — so a replacement with a different run-up lands off the beat.

## Events

Both hosts see the same sequence, as callbacks on the web and as props on React
Native: the gesture starts, the pack commits to being cut, the lid comes off
(`onOpenComplete` — the moment to call an open API, the reveal that follows buys
the request its time), and the whole ceremony ends (`onRevealComplete`). The
carousel commits on the first tap and opens on the second, so a host that
wants the open API called at the commit — and its facts and badge passed in
with `setOptions` before the second tap — has the whole float to do it in.
The climb opens a purchase on the host's word and tells it card by card; its
events are listed under [Driving the climb](#driving-the-climb).

## Requirements

- **Web**: `pixi.js` ^8.3 (`slice` turns its card, `carousel` draws its ring and `climb` spins its items with `PerspectiveMesh`) and a WebGL-capable browser. `react` ^18 or ^19 for the
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
createPackOpener(el, {variant: 'burst', preset: 'charged', assets: {…}});
```

A variant declares itself, and a mechanic the handle already drives — a
gesture, `autoSlice`, `shuffle`, `reset` — changes nothing else in the
package, not the engine, not either wrapper. One that needs a command of its
own, as `climb` does with `start` and `setCards`, also adds it to the
engine's handle and to the wrappers that offer it:

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
was drawn, and an optional `destroy`. A mechanic that starts on the host's
word rather than a gesture, as `climb` does, adds the optional `start`,
`setCards`, `setSpeed`, `skipToEnd` and `markSold`, with `awaitingCards` (true while a
ceremony `start()` began can still take its cards) and `cardHeight` (the
tallest it draws a card, which bounds how large the cards' artwork is
decoded); one that tells a tap from a drag adds `onCancel` for a gesture
taken away. Full definitions with comments are in
`src/core/variants/types.ts`.

Register it in `src/core/variants/index.ts` and add its name to `VariantName` in
`src/core/config/types.ts`. Defaults resolve through the variant, so a new
mechanic never inherits numbers that were tuned for a different one.

What comes *out* of the pack is not part of a mechanic: the card, its glows and
the beam around it live in `variants/shared`, and a variant only picks how the
card enters — `place` + `emerge` for a blast, `park` + `slide` for a cut. Option
groups that belong to one mechanic are declared optional in `ResolvedOptions`
and resolved only when its preset carries them.

## Working on the package

```
src/core/        the engine: createPackOpener(element, options) → handle
  config/        the public option surface: types, resolve, bridge protocol
  runtime/       shared helpers (colour parsing, artwork loaded outside
                 Pixi's cache)
  variants/      one folder per animation style
    types.ts     what a variant must provide
    index.ts     the registry
    shared/      what every mechanic reveals: geometry, textures, the card
    slice/       cut the seal: declaration, presets, scene, wrapper, hint
    burst/       charge and detonate: declaration, presets, scene, pack,
                 shreds, and the card assembled out of particles
    carousel/    choose and be told: declaration, presets, scene, the ring
                 of copies (turntable) and the story told in text
    climb/       the whole purchase on one grid: declaration, presets, scene,
                 the grid, the items, their colours, the reveal's order,
                 the faces, the prices and the combo
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
running scene instead of restarting it. For the climb, Start, Cards, Speed and
Skip stand in for a host: Cards hands over eight cards, two of them hits, with
`DOUBLE GRAIL` to write under them, and Speed steps through 1×–4×.

## Not done yet

The `slice` scene is plain JS, not TypeScript: it is split into modules and is
covered by the variant interface, but typing it would make a second variant
cheaper to write.

## License

MIT for the code. The sounds carry their own licences, listed in
`assets/sounds/CREDITS.md`.
