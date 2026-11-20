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

## Freesound — CC0, https://freesound.org

Public domain, no attribution required. Each is at
`https://freesound.org/s/<sound>/`. The score's lead times are tuned to where
these peak; a host laying its own file over a cue (`sound.samples`) keeps the
beat by matching that.

- `magic.mp3` — "Boom" (236956), trimmed to 2 s: the slice's landing, a sub
  boom under the card.
- `reveal-sweep.mp3` — "GLEAM-GLOW-SFX-CHIME" (351408), as it is, trimmed to
  4.5 s. The slice's sweep; the score starts it 2 s before the card lands.
- `impact.mp3` — "Riser Hit sfx 054" (712713), led by silence and trimmed to
  3.1 s: hits 0.94 s in, so the score starts it that much early. The slice's.
- `burst-sweep.mp3` — "Chimes" (389789), as it is, trimmed to 4.5 s. The
  burst's sweep, cued like the slice's.
- `burst-impact.mp3` — "Riser Hit sfx 041" (649066), led by silence and
  trimmed to 3.1 s: hits 0.94 s in. The burst's impact.
- `burst-magic.mp3` — "Ramon's Sexy Sub Drop 6000" (346316), trimmed to 2 s:
  the burst's landing, a sub drop under the card.
- `blast.mp3` — "POWERFUL RUMBLY HELLISH IMPACT" (826216), led by silence
  and trimmed to 4 s: the impact 0.57 s in, on the burst's flash frame.
- `ring-step.mp3` — "Points_Tick2" (721514), as it is: a click as the ring
  turns past a copy.
- `ring-whoosh.mp3` — "robowhoosh electrobass 4" (807444), as it is: under
  each fact, the banner, the chosen pack rising.
- `pack-select.mp3` — "Sound Design Elements Impact SFX PS 011" (751356),
  trimmed to 3.6 s: the tap that chooses a copy, its hit 0.4 s in.
- `chime.mp3` — "Vibrato Celesta C" (573617): on the flip.

## Rendered — our own

Synthesised with Web Audio (`OfflineAudioContext`, 44.1 kHz stereo, fixed
seeds) and rendered once in Chrome; react-native-audio-api renders the same
graph thinner, so they ship as files rather than being synthesised on load.

- `swish.mp3` — the air the turning card cuts
- `whoosh-deep.mp3` — the lid coming off
- `sub-hit.mp3` — the weight under it
- `boom.mp3` — the burst's blast

## Rarity Climb — chosen by ear on the audition stand (19.11.2026)

Mixkit files are under the Mixkit Sound Effects Free License (free for commercial use, no attribution);
Freesound files are Creative Commons 0.

- `climb-takeoff.mp3` — SWOSH-01 44.1kHz, https://freesound.org/people/qubodup/sounds/59988/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); trimmed and levelled for the climb's takeoff beat
- `climb-stop.mp3` — Gear fast lock tap, https://mixkit.co/free-sound-effects/click/ (Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree)); trimmed and levelled for the climb's stop beat
- `climb-reveal.mp3` — flipCard.wav, https://freesound.org/people/Splashdust/sounds/84322/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); trimmed and levelled for the climb's reveal beat
- `climb-land.mp3` — Impact of a blow, https://mixkit.co/free-sound-effects/hit/ (Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree)); trimmed and levelled for the climb's land beat
- `climb-hits.mp3` — Cinematic glass hit suspense, https://mixkit.co/free-sound-effects/cinematic/ (Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree)); trimmed and levelled for the climb's hits beat
- `climb-gather.mp3` — Air zoom vacuum, https://mixkit.co/free-sound-effects/transition/ (Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree)); trimmed and levelled for the climb's gather beat
- `climb-coins.mp3` — Clinking coins, https://mixkit.co/free-sound-effects/coin/ (Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree)); trimmed and levelled for the climb's coins beat
- `climb-leave.mp3` — Whoosh, https://freesound.org/people/qubodup/sounds/60013/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); trimmed and levelled for the climb's leave beat

## Rarity Climb — three sound designs, chosen by ear on the second stand (20.11.2026)

Freesound files are Creative Commons 0 (each read on its own page); Mixkit files are under the Mixkit Sound
Effects Free License (no attribution required). Trimmed, levelled and re-encoded for the climb.
`climb-stop`, `climb-reveal`, `climb-land` and `climb-hits` of the first round left the bank.

- `climb-pulse.mp3` — heartbeat sub kick - softer, music_is_wiggly_air https://freesound.org/people/music_is_wiggly_air/sounds/784658/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); Soft sub kick, almost pure low thump around 50-60 Hz with a rounded attack; the gentlest of the four.
- `climb-riser.mp3` — Orch 001 boom+crash.wav, Karma-Ron https://freesound.org/people/Karma-Ron/sounds/151813/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); Reversed orchestral bass-drum-and-crash: a deep, ominous inhale that ends abruptly at full size.
- `climb-cascade.mp3` — Gear metallic lock sound, Mixkit https://mixkit.co/free-sound-effects/click/ (Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree)); Two light metal clicks then a firmer gear lock; compact and mechanical.
- `climb-pop.mp3` — Classic Glass Hit-C6, CAT-FOX_ALEX https://freesound.org/people/CAT-FOX_ALEX/sounds/865789/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); Single struck glass, clean tuned 'ting' (measures C5) with a soft ring; elegant, very clean.
- `climb-boom-sub.mp3` — Cinematic_Boom_Rhapsodize.wav, rhapsodize https://freesound.org/people/rhapsodize/sounds/255111/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); Deep cinematic sub boom, almost all below 150 Hz; dark rolling weight, no top.
- `climb-boom-hall.mp3` — Orch 001 boom+crash.wav, Karma-Ron https://freesound.org/people/Karma-Ron/sounds/151813/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); Orchestral bass drum with a cymbal crash on top, natural 2 s hall decay; grand and classical.
- `climb-beat.mp3` — Low Floor Tom.wav, kiddinla https://freesound.org/people/kiddinla/sounds/170490/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); Low floor tom, real kit: round woody punch with a short skin ring.
- `climb-stamp.mp3` — traditional stamp.wav, I.fekry https://freesound.org/people/I.fekry/sounds/470710/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); Traditional wooden rubber stamp pressed onto paper on a desk: a firm, papery thud with a little desk body.
- `climb-ding-silver.mp3` — ding 3.wav, organicmanpl https://freesound.org/people/organicmanpl/sounds/149268/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); Small metal bell 'ding' with a long silvery ring; airy, slightly higher.
- `climb-ding-desk.mp3` — desk bell center.mp3, tonmayster https://freesound.org/people/tonmayster/sounds/685111/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); Reception desk bell struck once: bright clean 'ting' with a fast shimmer; hotel-lobby classic.
- `climb-speed.mp3` — Arrow whoosh, Mixkit https://mixkit.co/free-sound-effects/whoosh/ (Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree)); An arrow flying past: short, dense, low-mid air rip, about 0.35 s; the most physical.
- `climb-shimmer.mp3` — Celesta Glissando, Ryan_Ouellette4706 https://freesound.org/people/Ryan_Ouellette4706/sounds/829054/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); Celesta glissando: soft bell-piano notes running up, warm and fairy-tale; the most musical.
- `climb-note.mp3` — Kalimba (C-note), foochie_foochie https://freesound.org/people/foochie_foochie/sounds/331047/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); Kalimba, measured C4 (+17 cents): plucked metal tine, warm and long-ringing.
- `climb-ratchet.mp3` — Single_Ratchet-05.wav, CallFlan https://freesound.org/people/CallFlan/sounds/495238/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); One click of a real ratchet pawl: crisp, high, woody-metal tick; very short.
- `climb-clack.mp3` — Box with Metal Latches Hit 2.wav, suspensiondigital https://freesound.org/people/suspensiondigital/sounds/389705/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); A box with metal latches hit hard: low, heavy thump with a short latch rattle; the weightiest.
- `climb-fanfare.mp3` — Tada Fanfare A, plasterbrain https://freesound.org/people/plasterbrain/sounds/397355/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); Short 'ta-da' brass fanfare, 1.7 s with its own ending; bright and to the point.
- `climb-shower.mp3` — Coins Fall 7.mp3, belanhud https://freesound.org/people/belanhud/sounds/537930/ (Creative Commons 0 (http://creativecommons.org/publicdomain/zero/1.0/)); A handful of coins falling onto a hard surface: dense metallic patter that settles; natural.
- `climb-rattle.mp3` — Drum Roll, https://mixkit.co/free-sound-effects/drum/ (Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree))
