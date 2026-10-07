# Sounds

The ceremony's cues. `manifest.json` maps a cue to its file;
`pnpm build:sounds` bakes them into `src/core/sound/samples.js` as data URIs, so
the scene has nothing to fetch. MP3 (LAME VBR `-q:a 2`, 44.1 kHz, channels as
they were): every browser decodes it.

The files carry their own licences below; the package's MIT licence covers the
code, not them.

## Kenney — CC0, https://kenney.nl

Casino Audio and Sci-Fi Sounds, public domain, no attribution required.

- `pack-open-1.mp3`, `card-place-2.mp3`
- `engine-low-1.mp3` — a low hum, looped under the charge

## Mixkit — Mixkit Sound Effects License, https://mixkit.co/license/

Free for commercial use, no attribution required. Shipped here with the
owners' consent.

- `reveal-sweep.mp3` — "Sweeping sparkle presentation intro" (sfx 2633),
  trimmed to 2.75 s: builds for 0.9 s to its peak. The score starts it 2 s
  before the card lands.
- `impact.mp3` — "Movie trailer epic impact" (sfx 2908), trimmed to 3.05 s:
  rises for 0.94 s before it hits, so the score starts it that much early.
- `blast.mp3` — "Cinematic whoosh deep impact" (sfx 1143): a whoosh for 0.57 s,
  then the deep impact on the burst's flash frame.

## Freesound — CC0, https://freesound.org

- `magic.mp3` — "SFX Magic" (sound 264981). Peaks 0.3 s in; played on the
  landing frame.

## Carousel — the reference's own sounds

Handed over by the product owner from the pack-opening flow the carousel was
built after.

- `ring-step.mp3` — a click as the ring turns past a copy
- `ring-whoosh.mp3` — under each fact, the banner, the chosen pack rising
- `chime.mp3` — on the flip
- `pack-select.mp3` — the tap that chooses a copy

## Rendered — our own

Synthesised with Web Audio (`OfflineAudioContext`, 44.1 kHz stereo, fixed
seeds) and rendered once in Chrome; react-native-audio-api renders the same
graph thinner, so they ship as files rather than being synthesised on load.

- `swish.mp3` — the air the turning card cuts
- `whoosh-deep.mp3` — the lid coming off
- `sub-hit.mp3` — the weight under it
- `boom.mp3` — the burst's blast
