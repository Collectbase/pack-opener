# Changelog

## 0.5.0

`slice` has a new ceremony. The white card spinning twice for three and a
half seconds, the wipe off its back and the beam run round it afterwards are
gone; after the cut the card now rises out of the pack face down, gathers
itself in its colour and turns over — about four seconds from the cut to
`revealed` instead of seven.

- **The pack at rest** floats a little, light crosses its foil every few
  seconds, and its own outline glows softly behind it (`slice.float*`,
  `slice.foil*`, `slice.backlight*`). The foil and the glow follow the
  pack's silhouette, read off the artwork's alpha; an image whose pixels
  cannot be read gets a glow round its box instead. The hint's comet runs
  the whole width of the pack (`hint.sweep` 1), fades only at the very ends
  of its run, and crosses the pack just under its seal (`hint.lineRatio`
  0.12).
- **The cut** is the pack coming apart and nothing else: no line, glow or
  shadow is drawn on it, and the slit shows the stage behind the pack. The
  glow round the pack is hollow for it — none of it lies under the foil to
  show through. The edge is cleaner (`interaction.edgeJitter` 0.2) and the
  slit finer (`interaction.gapRatio` 0.012). A small hot point sits under
  the blade while it is over the pack, and sparks are thrown back off it as
  it goes (`slice.bladeGlow`, `slice.bladeSparks`, `slice.spark*`). When the
  seal gives, a spray of sparks leaves the whole cut and the pack jolts
  (`slice.burstSparks`, `slice.joltScale`); light pours out of the opened
  pack as the lid goes (`slice.pourAlpha`). The lid is seen flying off
  rather than fading where it was cut. The light of the cut has its own
  colour, `theme.seam`. A finger that comes down beside the pack and slides
  onto it cuts from where it reaches it — the touch used to be turned away
  for good, and moving over the pack did nothing.
- **The card** comes out with a dark, engraved back — cross-hatching, a
  frame and a star, drawn from `theme.cardBack.line` and `emblem`, both
  `transparent` for a plain slab. Face down at rest it sways a little in
  perspective while a beam in the pull's colour laps its edge faster and
  faster and the star and the halo fill with that colour (`slice.charge*`,
  `slice.emblemAlpha`, `slice.tilt*`, `slice.tremble`) — the charge is also
  what plays while the artwork is late (`chargeHold`). Then half a turn in
  true perspective (`PerspectiveMesh`, so pixi.js ≥ 8.3 for `slice` too),
  the card's own light flaring as the edge passes (`slice.flip*`,
  `slice.focal`), and a landing: a push, a knock of the stage, the outline
  swelling, the highlight crossing the artwork and glints catching on it
  (`slice.land*`, `slice.twinkle*`), with embers in the pull's colour
  drifting up past it (`slice.ember*`).
- The card's corners are the artwork's own: the `slice` preset rounds it at
  `theme.cornerRadius` 6 instead of 14. A graded slab is barely rounded, and
  cut any rounder its frame lost its corners while the glow ran round a shape
  the card does not have. The lit outline round a finished card is stroked
  outside its edge rather than on it — centred, half the line lay over the
  artwork (the carousel's finished card gets the same).
- **The artwork is no longer cropped.** A card built before its artwork
  arrived — in a host that learns the pull only once the pack is opened,
  every time — was sized to `layout.card.aspect` and the artwork was
  cover-fitted into it: a slab lost the top and bottom of its frame, about a
  twentieth of its height at each end, and the card kept the wrong shape for
  every replay. The card is now built again to the artwork's own shape when
  it arrives, as long as its face has not been shown, and every mechanic lays
  out its stand again under it. Wide artwork lost its sides to
  `layout.card.maxRatio` 0.8; every preset now has 2. The burst and carousel
  card is rounded like a slab too (`theme.cornerRadius` 6).
- A new event, `impact`, marks the card landing face up; the React Native
  wrapper answers it with `onHaptic('heavy')`. The `phase` names for slice
  are now `runOut`, `open`, `charge`, `chargeHold`, `flip`, `land`, `hold`
  (and `autoSlice`, `retract`), and `timeline` carries `chargeMs`, `flipMs`,
  `landMs` and `holdMs`.

**Layout.** The sealed pack is no longer held to the card's rule of staying
off the lower half of the stage: that rule is for what the host hangs under
the card once it is out, and a band at the top shrank the pack by twice its
own height — in the app, under a title, the pack came out 164 px wide on a
384 px screen. It is now sized against the band the host left free, and centred on the
stage as long as that keeps it out of the bands. It is also measured by the
pack itself rather than by its image: pack images carry transparent margins,
and laid out by the image's edges the pack came out a fifth smaller than
asked and the card it held looked bigger than it. The `slice` preset sizes
the pack at `layout.pack` `widthRatio` 0.6, `heightRatio` 0.58, `offsetY`
0.02, and the card at `layout.card.packWidthRatio` 0.76 of it — the card
keeps the size it had, and its own rule.

**Removed** — read by nothing once the spin went: `motion.reveal.spinMs`,
`unveilMs`, `beamMs`, `spinTurns`, and the wipe's sparks (`sparks`,
`sparkSize`, `sparkJitter`, `sparkAlpha`, `sparkSpreadX`, `sparkSpreadY`).
The flat turn the carousel flips its card with keeps `spinFlatness`,
`spinShade`, `spinBloom` and `artWaitSpinMs`. `contentBoundsOf` moved from
the carousel's turntable to the shared textures.

## 0.4.1

Third mechanic: the `carousel` variant with the `showcase` preset. Copies of
the pack — five, by default — stand on a turntable seen from in front and a
little above, each turned with the ring and facing out, the front one lit,
the ones beside it turned away in true perspective (`PerspectiveMesh`, so
pixi.js ≥ 8.3 for this mechanic), the two round the back seen from behind
between them, all mirrored in the floor and hovering a little, each on its
own beat. The ring has the whole stage — `layout.pack` is read against it,
not against the band between `layout.stage`'s reserves, which shape only
where the card comes to rest — and against the pack as seen, not its image:
the opaque part of the artwork is read off its pixels once, so a pack image
with transparent margins is still laid out at `widthRatio` of the stage, and
its reflection meets the pack rather than the image's edge. On a phone the
front copy is half the screen wide, as in the reference. `shuffle()` (the `shuffle` command over the bridge,
`shuffle` on the React and native handles) turns the ring `shuffleTurns`
whole turns, settles it on some other copy and chooses that copy — it drops
and rises as if tapped; a finger turns it too — a drag across one
pack width is `carousel.dragTurn` of a turn — and, let go, it coasts and
settles on the nearest copy. A tap on a copy chooses it: it drops off the
ring as its neighbours fade and rises alone to centre stage, where it floats
— for as long as it takes, nothing looping — until it is tapped again. That
second tap opens it: the pack dissolves, and the pull is told before it is
shown. Its facts fade in one under the other —
`assets.card.facts`, `{label, value}` pairs, any the host has — then a pill
in the tier's colour, and for a tier worth shouting about a banner slides
across the stage with the tier's name running along it: `assets.card.badge`,
`{label, color}`, absent for a tier that gets none. Then the blank card flips
over into the artwork, on the same stand the other mechanics end on. Facts
and badge are read when their moment comes, so a host that learns them from
the open — after the first tap — passes them with `setOptions` and they are
told. The scene bundle carries it, so a native host gets it with the update.

The ceremony's moments are the `phase` events `shuffle`, `drop`, `rise`,
`float`, `dissolve`, `facts`, `banner`, `flip`, `hold`, and `step` — no
length — each time the ring turns past a copy, under the finger or on its
own, for a host that clicks along; `committed` marks the first tap, `opened`
the pack gone. Artwork still on its way is waited
for as in slice — `spinHold`, posted once — and the `timeline` carries
`shuffleMs`, `dropMs`, `riseMs`, `dissolveMs`, `factMs`, `factGapMs`,
`bannerMs`, `bannerHoldMs`, `flipMs`. `autoSlice()` chooses the front copy
and opens it in one go. The `carousel` group holds the knobs: how many
copies, the ring's radius, how far they turn with it and how they gather
toward the front, the lens and the eye's height, the fade and the shade of a
copy turning away, the hover, the drift, the shuffle, the drag and the
settle, the drop, the rise, how large the held pack, the float, the story's
pacing, the banner's tilt, the reflection.

`rest` — where the revealed card and its stand come to rest, given outright
in css px: `rest.card` is the card's box, the artwork fitted into it the way
a contained image is (by height when narrower than the box, by width when
wider, centred across and set on the box's bottom edge); `rest.pedestal` is
the stand's left edge, width and bottom edge, its height its artwork's own
ratio. For a host that lays its winner chrome out around the card in the DOM
and wants the scene's card exactly where its own would be, whatever
`layout` would have worked out. Every mechanic ends there. A change to it
mid-ceremony waits for `reset()`, like a change to `layout`.

`setOptions` now says what became of the change — `applied`, `deferred` or
`scene` — instead of true or false. `deferred` is new: the scene is
mid-ceremony or holding a revealed card, and the change waits for `reset()`.
The React wrapper reports it through `onOptionsDeferred`, so an editor can
reset there and show every change the moment it is made; the playground does.
A host that only checked for `false` should check for `'scene'`.

A slice card whose artwork is still on its way keeps turning at one steady
speed until it comes — a whole turn per hold, holds joined with no stop
between them — where it used to replay the eased two-turn spin, braking to a
halt every 600 ms. The wait is its own phase, `spinHold`, posted once when
it begins rather than once per hold, so a host scoring the ceremony cues its
sound once. The burst's swarm, which turns on the same way, is likewise
posted once per wait rather than once per pass.

The web engine posts a `timeline` event — with `ready` and after every retune
— carrying each phase's length in ms after `motion.speed` (`spinMs`,
`unveilMs`, `beamMs`, `holdMs`; for burst `chargeHoldMs`, `releaseMs`,
`beatMs`, `swarmMs`, `assembleMs`, `snapMs`). A host that cues a sound ahead
of a phase, so it lands as the card does, counts from these instead of the
presets; the React wrapper hands them to `onTimeline`. The scene bundle does
not post it, so the native host sees nothing new.

The bands a host keeps back (`layout.stage.reserveTop` / `reserveBottom`) now
hold the sealed pack as well as the card. A host that draws a button under the
stage had its pack laid out for the whole stage and sitting on the button,
while the stage was cut off at the button's edge if the host shrank it
instead — taking the glow around the card with it. The pack is sized and
centred in the free band by the card's own rule: a band at the top makes it
smaller around the middle of the stage rather than pushing it down.

The beam can run the card's outline as one piece: `motion.reveal.beamStyle:
'ribbon'` lays a soft gradient along it with a rope, continuous at any size.
The segmented beam draws each short stroke on its own, and on a desktop stage —
a card several hundred pixels tall — the round caps stop overlapping and the
trail reads as a row of dots. `segments` stays the default, so a host that has
not asked for the ribbon draws exactly what it drew before.

A retune or a resize after the ceremony has played out no longer rebuilds the
scene under the revealed card, which rewound it into the pack and left the
stage blank; like a change mid-ceremony, it waits for the next `reset()`.

`layout.pack.anchor: 'card'` places the sealed pack where the card will come
to rest, so the card unveils in the pack's place instead of climbing out of it
— on a tall stage the climb was a good hundred pixels. The default, `stage`,
keeps the pack centred on the stage and nudged by `offsetY`, as before.

`layout.card.spinAt: 'pack'` keeps the card where the pack was while it turns
— it slides out and stops there, the wrapper sinking away under it — and lifts
it onto its stand as the artwork is unveiled, the stand fading in once the
card has arrived. For a host that wants the pack and the turning card low on
the stage and only the finished card up on its stand. `rest`, the default,
slides the card straight to its resting place as before. Slice only.

The scene says which phase of the ceremony has just begun: a `phase` event
with the scene's own name for it (`open`, `spin`, `unveil`, `beam`, `hold`
for slice; `release`, `beat`, `swarm`, `assemble`, `snap`, `settle` for
burst), and `onPhase` on the React component. `opened` and `revealed` were
too coarse for a host that scores the ceremony with sound — a lid coming off
and a card landing want their own cues. Nothing else changes: a host that
does not listen hears nothing new.

## 0.4.0

The host can keep bands of the stage for its own UI: `layout.stage.reserveTop`
and `reserveBottom`, in css px. The card and its stand are centred in what is
left and shrink together to fit it, so a title above the card gets its room
from the scene instead of landing on the artwork.

The pair is never dropped below the middle of the stage to make that room — it
shrinks instead. Whatever a host hangs under the card was laid out around a
card that sits in the middle, and its height is rarely known before it is
drawn; a band at the top must not push the stand onto it. Nothing is reserved
by default, and a scene that reserves nothing is laid out exactly as before.

## 0.3.0

The revealed card is shown above a stand. It belongs to the card rather than to
a mechanic, so both `slice` and `burst` get the same arrival: the stand is
placed under where the card comes to rest, holds still while the card travels,
and fades in with it. The card hangs over it — it does not stand on it, which is
what the design asks for.

Whose stand it is, is the host's business: `assets.pedestal.url` takes any
artwork, and without one the scene draws the stand baked into the package, so a
host that has none still gets the same scene. `layout.pedestal` moves it —
width against the card, its own aspect, and the gap under the card's edge.

## 0.2.0

Second mechanic: the `burst` variant with the `charged` preset. The pack is held
under a finger while the pressure builds — shudder, squeeze, heat from within,
and a line closing around it — then goes off: flash, spikes of light, shock
rings, debris streaks, glitter, and the wrapper torn into a few hundred shards
that burn out as they fly. The card is not slid out and turned over as in
`slice`: after a beat of quiet, dust gathers where it will be, resolves into
pieces of the artwork and they fly into place, landing with a ring. Same events,
one option to switch.

The card's arrival belongs to the card: its outline flares and a highlight runs
across the artwork, and nothing is thrown at it — a ring or a flash two seconds
after the blast reads as a second explosion rather than as a reveal.

Artwork is cut into a mosaic rather than into separate outlines — neighbouring
pieces share the points along the edge between them — so the wrapper reads as
whole until it bursts and the card assembles into artwork instead of into a grid
with gaps in it. The finished card comes up underneath the last of the assembly
and the pieces dissolve off it, so nothing is swapped in on a single frame.

The card and the maths behind it moved to `variants/shared`, so a mechanic is
now only the wrapper and the gesture. Option groups that belong to a single
mechanic (`interaction` and `hint` for `slice`, `charge` and `burst` for
`burst`) are resolved only for the variant that owns them.

The waiting cloud no longer takes the scene down with it. `burst` prepares the
assembly as soon as the card's rect is known instead of waiting for the artwork,
because the cloud that plays while the artwork downloads turns around that very
rect — without it the first frame of the wait threw, and a throw inside the
ticker stops every frame after it, leaving the shards of the wrapper frozen on
screen for good.

## 0.1.0

First release. The `slice` variant with the `classic` preset, for the web
(`createPackOpener`, plus a React component) and for React Native (WebView
wrapper with geometry-driven slots and haptic intents).
