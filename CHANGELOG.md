# Changelog

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
