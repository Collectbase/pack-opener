# Changelog

## Unreleased

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

## 0.1.0

First release. The `slice` variant with the `classic` preset, for the web
(`createPackOpener`, plus a React component) and for React Native (WebView
wrapper with geometry-driven slots and haptic intents).
