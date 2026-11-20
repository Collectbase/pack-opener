# Changelog

## 0.6.0

**A fourth mechanic, `climb`, opens the whole purchase on one stage.** The
`climb` variant, with its `spectrum` preset: one pack flies in from the
centre and splits into a grid of as many as were bought (`climb.count` — one
alone and large, more in the columns that show them largest), each the
pack's own artwork in its own silhouette, and they spin in
perspective, each in a colour of its own out of `climb.cycleColors`, changed
at moments of its own and kept clear of its neighbours', so nothing in the
spin gives the pull away. The colours keep pace with the spin: each is held
for a share of one turn, `climb.spinMs`, so `motion.speed` hurries them too.
The host starts it on its own word — `start()`, the moment the player buys —
and hands the cards over once the purchase answers:
`setCards(cards, {combo})`, each card's artwork, the colour of its tier,
whether it is a hit and its price. Once they are in and the reel has run
`climb.reelMinMs` from the start, the items stop one by one in grid order,
each taking its card's colour only as it comes to rest; the ordinary cards
turn over in grid order, each with its price over its top edge in the host's
own format (`climb.price`) — large, gold, there at once and counted up in a
blink, with stars at its sides — and its tier under it; the hits wait,
tremble, then turn together under a white flash (`climb.flash`); the combo —
the host's own words, `DOUBLE GRAIL` or `MATCH ×3 · GRAIL` — is written under
the grid in the hits' light; and then the prices leave their cards and fly
together to where the host writes the total (phase `gather`, before `done`;
`climb.gatherY`), each card keeping a small price under its tier. A tap on a
card after that is the host's to answer. The next ceremony whisks the cards
on show away with a jolt.

The reel is short and loud: the fly-in takes half a second, the reel's
shortest run 1.3 s from the start, and the stops come as a cascade over in
half a second however many items there are (`stopStaggerMs` 120, closer on
a big grid). A spinning pack is flooded with its colour as a coloured foil
(`climb.flood`, 0.85), the artwork showing through, and it flashes to a
fresh colour every time it stands edge-on, every half turn.

**Three sound designs for the climb** (`sound.design`, chosen by ear):
`impact` (the default) — a deep pulse while the packs spin, closer and
louder towards the stop and hurried with Speed up, a riser ending on the
stop, one lock cascade for every stop, a glass pop for each pack bursting
(deeper and fuller the higher its tier), a drum roll as the hits tremble, a
sub boom under the flash and a shimmer for their rays, a drum for every beat
of the combo; `arcade` — a ratchet the whole reel, a clack for every stop, a
fanfare on the hits, a shower of coins; `music` — every moment a note of one
chord on a kalimba: the stops climb a pentatonic, each card sounds its tier,
the hits a chord. All three: a rubber stamp for a card sold, the coins and
their landing in the balance (`cue('ding')`), a whoosh for Speed up. The
scene tells the new moments as `MESSAGES.CUE` (`pulse`, `riser`, `burst`,
`rattle`, `beat`, `stamp`, `speed`, each with its `value` where it has one).
The sound engine now ends on a limiter and keeps at most three voices of one
cue at once.

**The opening hits harder.** A pack no longer turns over: it bursts off its
card in pieces of its own coloured foil, drawn in the pack's shader, that
fly out over the grid and tumble away while the card punches up in its place
(`climb.reveal` `shatter`, the preset's; `flare`, `motes` and `pixels` still
turn). As the hits come round the whole screen goes white for a moment and
fades; then each hit stands in a burst of rays of its colour, turning slowly
and swelling on every beat of the combo, and the whole stage fills with a
haze of the best colour shown — faint for an ordinary card, full for the
hits — until the next ceremony begins.

`setSpeed(m)` hurries the spin alone from the next frame — the reel, its
colours, its shortest run and the items coming to rest one by one; the
fly-in, the cards turning, the hits, the combo, the prices and the gather
keep their own pace — and `skipToEnd()` lands it at its
end at once, with no flash, telling the host what it has not heard yet in the
usual order, marked `skipped: true`; sent right after `setCards`, it waits for
those cards and lands them at their end. `start()` and `reset()` put the
speed back to 1×, and a batch shown as several grids sends each grid after
the first with `setCards` alone, at the pace already set. The events are new
— `cardSettled`, with its colour's place in the palette (`colorIndex`),
`cardRevealed`, `hitsRevealed`, `allRevealed` (once per ceremony that gets
there, whatever the host calls from inside its events) and `cardTap` — and so
are the `phase` names `intro`, `reel`, `settle`, `turn`, `hits`, `combo` and
`done`; the `timeline` carries `introMs`, `spinMs`, `reelMinMs`,
`stopStaggerMs`, `flipStaggerMs`, `hitHoldMs` and `rollUpMs`. A `setCards`
with no cards ends the ceremony at once on an empty grid, with `done` and an
`allRevealed` that lists none. The cards' artwork is loaded outside Pixi's
shared cache, decoded no larger than the climb draws a card at
`performance.resolutionCap`, and freed once the scene lets the cards go, so
a session of many purchases does not grow and a phone's photos are never
held at full size.

The React component has the same commands on its handle, and the events as
`onCardSettled`, `onCardRevealed`, `onHitsRevealed`, `onAllRevealed` and
`onCardTap`. Commands sent before its scene is up wait for it and run in
order; once none is coming — unmounted, or its mount failed — they are
dropped as they are sent, and a dropped `setCards` resolves. With `sound` on
the climb has a score of its own, out of the baked cues: a whoosh as the
items fly in, a soft tick under the reel, a click for each item at rest that
rises with its tier, a swish per card, the stinger as the hits come round —
an epic's at least, since the hits are the pack's top tier, a grail's when
`sound.badge` names one — and an impact under the combo; what a skip passes
over stays silent. The native wrapper has no `start` or `setCards` yet, so
the climb runs on the web.

Two changes reach every mechanic, and neither changes what one does. A
press the browser takes away (`pointercancel`), or a mouse let go outside
the window, now reaches a scene that tells a tap from a drag as a gesture
taken away, so the climb counts it as no tap; every other mechanic hears it
as a release, as before. And a window resized while the scene sleeps is
drawn on the next frame, rather than up to a second later with the canvas
blank in between.

`slice`, `burst` and `carousel` are otherwise unchanged. The 0.4 slice phase
names (`spin`, `spinHold`, `unveil`, `beam`) and slice's `spinMs`,
`unveilMs` and `beamMs` timeline keys, which 0.5.1 said would go in 0.6,
stay for now: still deprecated, they go in a later release. The `spectrum`
preset: one item; white, green, blue, purple, red and gold (`#ffffff` to
`#ffc400`), lowest tier first; `tint` 0.25; the flash on; prices in `$` to
two decimals in a system family (`climb.font`); a 700 ms fly-in, a 900 ms
turn, the first stop no sooner than 1.8 s in, stops 280 ms and turns 220 ms
apart, the hits held 900 ms and the prices counting for 500 ms.

How the result reads: the grid takes the columns that show a batch largest
on the stage it has (ten stand 4-4-2 on a phone, 5-5 on a wide screen),
every card in one shape — the artwork whole on light paper — and under each
its price and, when the host names it (`ClimbCard.tier`), its tier in the
tier's light, lifted towards white so it reads on a stage of its own colour,
as the light round every item is. A card sold with the purchase
(`ClimbCard.sold`) dims once its price has counted and is stamped across
its face — `SOLD` in red ink in a double frame, slanted, coming down large
and landing pressed in, as a rubber stamp does (already there on a skip) —
with `SOLD` in place of its tier; `markSold(indices)` tells the same of
cards sold later.

A spinning pack is drawn as a pack is: flat at its sealed edges and swelling
over the card inside it, point by point in perspective, the slopes of the
swell in shade or catching the light as it turns, the whole of it darker the
further it turns from the eye. The light is worked into the artwork's own
pixels, so it falls only where the pack is and never past its outline. A
card, turned over, is flat.

**Sound for the climb**, chosen by ear: a swoosh as each item takes off into
its spin, a lock-tap as each comes to rest (each a little higher), a blow as
the first card lands and a flip for each card, a glass hit for the hits, a
rush of air as the prices gather, a whoosh as the cards on show leave, and
clinking coins on the host's word. The scene tells the moments it has no
other message for as `MESSAGES.CUE` (`takeoff` with the item's `index`,
`leave`), and `opener.cue(name)` lets the host mark one of its own (`coins`
as a sold sum sets off). The reel's tick is gone.

The reel starts the way the items would if each were spun by hand: not
together and not in a row but in an order drawn afresh every time, each
turning slowly at first, then taking off all at once — a little past its
speed, and back to it — and each at a speed of its own from there, one and a
half to two times the `spinMs` turn. A pack alone throws the stage as it
takes off.

What the reveal throws off: a card coming face up pops its light, throws a
burst in its colour — `climb.reveal`: `flare`, `motes` or `pixels`, all of
them light and none of them debris — and takes a band of sheen
(`climb.sparkle`, on); a hit throws about twice as much, gets a star at its
corner and a wider light that stays. Dust rises behind the stage all the
time and is shaken with it (`climb.dust`, on). The stage takes the blows (`climb.shake`, 0..1,
1): the pack bursting into the grid, the first card landing on its face (a
card alone the harder the higher its tier), the hits coming round under the
flash and landing, and every beat of the combo — which now slams down, gives
a little and counts the hits out, each pulsing in its turn; `shake(strength)`
strikes on the host's word. A shake is a run of poses held a thirtieth of a
second each, so it reads as hard on a 60 fps screen as on a 30 fps one, and
it is not hurried with the ceremony. The cards move as one; what is written
under them stands still. The scene is at rest again once the last shard has
gone, and a skipped ceremony throws and shakes nothing.

Card artwork whose fetch is refused is asked for once more past the browser's
cache before the scene gives up on it: a page that has shown the same URL in
a plain `<img>` can leave it cached without the CORS header.

## 0.5.16

**The slice charge cycle ends on the pull's colour.** With
`motion.reveal.chargeCycle` on, the last colour the beam took before the
flip was as random as the rest, so a common pull could charge in purple and
turn over white. The cycle now lands on the pull's own colour at the last
corner the beam rounds at least 180ms before the card turns, and keeps it
into the flip — whatever the charge's length and `motion.speed`, and when
the artwork is late too. The colours before it are picked as before. Off by
default; nothing changes with the cycle off, nor for `burst` and `carousel`.

## 0.5.15

**The slice card can keep its colour to itself until it turns.** Face down
and charging, the card's light — the beam round its outline, the halo, the
bloom and the printed star — was already the pull's colour, so the colour
gave the pull away before the flip. `motion.reveal.chargeCycle` puts a
gamble there instead: each time the beam rounds a corner the light takes a
colour out of `motion.reveal.chargeCycleColors` (white, green, blue and
purple by default), by chance and never the same twice running, and the
pull's own colour comes up as the turning card shows its face. One colour
in the list is a steady, neutral light. Off by default; `burst` and
`carousel` are unchanged.

## 0.5.14

**The badge word sits on the centre of the card.** `motion.reveal.badgeWord`
put the font's em box on the card's centre rather than the letters, so with
Bebas Neue the capitals stood a tenth of the size high — 48px on a desktop
stage — and the gap the tracking leaves after the last letter pushed the
word a few pixels left. The word is now measured for its own letters and
centred on them, whatever font `theme.badgeFont` names. Nothing else about
it changes.

## 0.5.13

**The card's glow fades out instead of ending in a box on an ordinary
screen.** The halo and the rim round the card — and the glow round the burst
pack — are blurred shadows baked into a texture `spread` wider than the card.
A canvas shadow does not scale with the canvas, so on a sharp screen, baked
at twice the css pixel, the blur came out half as wide and faded inside the
texture, while at one device pixel per css px it ran on past the texture's
edge and was cut there: a faint square round the card on most Windows
laptops and on desktop monitors at 100%. The blur is now counted in css
pixels on every screen, the one a sharp screen has always shown, so an
ordinary screen gets the same glow, faded out. Sharp screens are unchanged,
and so are the sprites' sizes and `glow` options.

## 0.5.12

**The pull's badge behind the landed card.** A host that wanted the tier
written large behind the card, as a winner screen does, had to draw it in
its own page under the scene's canvas — so only the host that did had it,
and the React Native app could not. `motion.reveal.badgeWord` draws it in
the scene: `slice` and `burst` stroke `assets.card.badge`'s label in its
colour, under the card and its stand, as the card lands — opening out from
the centre and fading towards the stage's edges. Off by default, and a pull
without a badge gets no word, so which tiers have one stays the host's call.
Turned on or off while the card is down, or given a badge late, it shows or
goes at once. `theme.badgeFont` names the family, a narrow system one by
default so nothing ships in the bundle; a web font the host's page can load
is asked for ahead, so the first pull does not get the fallback. A host that
passes neither sees no change.

## 0.5.11

**A long fact wraps instead of running off the stage.** The carousel set
each fact on one line at a size taken from the pack, so on a phone a value of
fifteen letters or so — a player's full name, a long category — ran past both
edges. A value now wraps at the stage's width less a margin, takes a second
line before it gets smaller, and shrinks to keep to two lines down to 60% of
its size; past that it takes the lines it needs, and a word too long for a
line breaks. Labels wrap the same way. The facts are laid out by the height
they come out at, and a story that wraps its way taller than the pack gets
smaller as a whole. The tier's pill stays on one line and shrinks to fit.
Facts that fit on one line sit exactly where they did.

**The facts stay gone once the banner has taken them.** The banner fades
the facts as it slides in, but the flip — and the turning wait for the
artwork before it — faded them again on their own clocks, from full: the old
text flashed back for a moment before the card turned over, and again with
every turn of the wait. The story now only ever fades, so a tier's banner
goes straight into the flip. Without a banner the facts fade with the flip
as they did.

## 0.5.10

**The card's light can be left out of a phase.** Bloom, rim, halo and the
beam on the outline had one opacity each for the whole ceremony, so a host
that wanted the card at rest bare — no light round it, the card as the
player's collection shows it — had to zero them and lost the colour the card
gathers face down along with it. `motion.reveal.glowDuring` names the phases
the light is off in, by the names `onPhase` reports: `{hold: false}` keeps the
charge, the turn and the landing lit and leaves the card bare once it has
landed. They fade between phases over
`glowFadeMs` (200), never longer than the phase, and a retune shows at once,
on a card already at rest too. Every phase not named keeps its glows, so a
host that passes no `glowDuring` sees no change.

## 0.5.9

**The bank is all public domain.** The carousel's click, whoosh, select and
chime were the reference's own files, and the sweep, the impact and the blast
came from Mixkit, whose licence lets a product play them but not a package
ship them. All seven are replaced with CC0 recordings from Freesound, cut so
they peak where the score expects, and `assets/sounds/CREDITS.md` lists each.
The score is as it was; a host that wants the old files back lays them over
the cues with `sound.samples`. The burst now has a sweep, an impact and a landing
of its own (`burst-sweep`, `burst-impact`, `burst-magic`), and falls back to
the slice's where a bank or a host has none.

**A host can bring its own sounds.** `sound.samples` takes a file per cue
name — a URL or a `data:` URI — and lays it over the baked one, read once when
sound is first on. A file that will not load leaves the baked cue in place; in
the React Native WebView only `data:` URIs are sure to load. A host that
passes no `samples` hears no change.

## 0.5.8

**The ceremony can be heard.** Every mechanic now has a score — the foil
tearing under the finger, the lid coming off, the sweep and the impact as the
card lands, the burst's blast, the carousel's clicks, whooshes and chime —
played with Web Audio on the scene's own events, in the browser and in the
React Native WebView alike. It is the score the Repackz iframe plays, moved
into the package with its sounds, so every host sounds the same and none has
to wire anything. It is off by default: `sound: {enabled: true}` turns it on,
`volume` sets the level, `muted` is the player's own mute and works
mid-ceremony, and `badge` (or `assets.card.badge`'s label) decides how hard the
landing hits. The sounds are baked in as data URIs; on the web they are a chunk
of their own, loaded only once sound is on. The native wrapper's WebView now
plays audio without a touch inside the page, so a pack opened by `autoSlice`
is heard too. A host that passes no `sound` sees and hears no change.

## 0.5.7

**The native wrapper hands on what a host needs to score the ceremony with
sound.** The scene has always sent a tick with the cut's progress, the start
of every phase with how long it will run, and the timeline of every phase;
the React wrapper hands them on as `onProgress`, `onPhase` and `onTimeline`,
but the native one only played a haptic on the tick and dropped the rest. It
now has the same three props, so a React Native host can lay sound under the
ceremony the way a web host does. The tick's haptic is as it was; a host that
passes none of them sees no change. Only the native entry changed — the core,
the mechanics and the React wrapper are byte for byte 0.5.6's.

## 0.5.6

**The native wrapper tells the host when the pack is committed to.** The
scene has always sent `committed` at the point of no return — the cut through,
the charge gone off, the carousel's copy chosen — and the React wrapper hands
it on as `onCommitted`, but the native one only played a haptic on it. It now
calls `onCommitted` as well, so a React Native host can open the pack the
moment the carousel's copy is chosen, as a web host does, and have the card's
`facts` in by the time they are told. The haptic is as it was; a host that
passes nothing sees no change. Only the native entry changed — the core, the
mechanics and the React wrapper are byte for byte 0.5.5's.

## 0.5.5

**The carousel's chosen pack no longer flashes across the stage.** When the
tapped copy has dropped off the ring and rises alone to the centre, its own
sprite was made visible a frame before `rise` placed it: for that frame it was
drawn at its artwork's own size in the stage's top-left corner. It is now put
where the copy left the ring, at that copy's size, before it is shown.
`slice` and `burst` are as they were.

## 0.5.4

**The halo takes a colour that arrives mid-ceremony.** The halo round the
card was baked into its texture in `theme.glow` when the card was built — on
`slice`, before the pack is even cut — so a `theme.glow` set later reached the
beam lapping the edge, the bloom and the contour, but not the halo: it kept the
colour the card was built with. A host that learns the pull's colour once the
lid is off saw a tier-coloured edge inside a halo of the default. The halo is
now baked white and tinted with `theme.glow`, as the pack's backlight already
was, so a new colour reaches it at once. A host that sets its colour up front
sees no change.

## 0.5.3

**The card comes out of the pack as white light.** Face down, the `slice`
card had a dark engraved back — cross-hatching, a frame and a star — and it
read as a grey slab rising out of the pack. The `slice` preset's back is now a
plain white card (`theme.cardBack` white to a cool off-white, a strong sheen,
no `line` or `emblem`), and with no star printed on it `slice.emblemAlpha` is
0. The pull's colour is where it was: the beam lapping the edge and the halo
filling behind the card as it charges, then the flip. A host that wants the
engraved back keeps it with `theme.cardBack` `{top: '#262b3d', mid:
'#141825', bottom: '#0a0c13', sheen: 'rgba(255,255,255,0.10)', line:
'rgba(170,186,255,0.09)', emblem: 'rgba(222,228,246,0.86)'}` and
`slice.emblemAlpha` 0.95. `burst` and `carousel` are as they were.

## 0.5.2

**The card no longer jumps in size when its artwork arrives late.** Built to
`layout.card.aspect` while its artwork was on the way, a card out of the pack
was built again to the artwork's own shape there and then — in front of the
player, face down, from one size to the other. A host that opens the pack on
the backend when the lid comes off, and learns the card only then, saw it
every time. The card now takes its shape as it turns edge-on in the flip,
where it has no width to be seen by and its face shows for the first time;
its stand is laid out again with it, out of sight until the card lands.
Artwork that arrives after the card has turned no longer rebuilds it at all.
`burst` and `carousel` are as they were.

The peer dependency says what 0.5.0 already needed: `pixi.js` ^8.3, for the
`PerspectiveMesh` slice turns its card with. It said ^8, so a host on Pixi
8.0–8.2 installed without a word and failed in the browser; the package
manager now warns at install instead.

## 0.5.1

A host that scored `slice` with sound by 0.4's phases went quiet at the
reveal in 0.5.0: `spin`, `spinHold`, `unveil` and `beam` were gone, and with
them `spinMs`, `unveilMs` and `beamMs` from `timeline`. They are announced
again, beside the new ceremony's own phases, so a 0.4 score plays on the new
ceremony as it is — the lid, the sweep, the impact and the magic where the
card lands.

Each starts with a phase of the new ceremony and lasts until the next one
does: `spin` with `open`, `unveil` with `charge`, `beam` with `flip`, and
`spinHold` with `chargeHold`. The card lands as `beam` ends, as it did in
0.4, so a score that counts its leads to the landing from them — `spin +
unveil + beam` after `spin`, `unveil + beam` after `unveil` — still lands
them there. `timeline` carries `spinMs` (`motion.open.ms`), `unveilMs`
(`slice.chargeMs`) and `beamMs` (`slice.flipMs`).

A card still waiting for its artwork at the charge is not unveiled until the
artwork arrives — mid-charge or mid-hold, with what is left before it turns
over — or, if it never does, at the start of the last hold before the wait
runs out. A 0.4 score's impact hits the landing either way; its sweep, cued
from the unveil, peaks late after a wait, as it did in 0.4.

What does not carry over: the swish a 0.4 score plays on each edge-on pass
of the spinning card. The card no longer spins; it turns over once, in
`flip`.

The old names are deprecated and go in 0.6 — score by `open`, `charge`,
`chargeHold`, `flip` and `land`, or by `impact` for the landing itself.

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
