# Audio credits

All three recordings are **CC0 1.0 Universal**:
<https://creativecommons.org/publicdomain/zero/1.0/>. Redistribution and
modification are permitted, including in this public repository. These are
recorded samples, not synthesized engine audio. Freesound's publicly accessible
HQ MP3 previews were downloaded without an account; the original WAV/AIFF files
require login.

- **engine.m4a** — [4WD Engine & Rev.wav](https://freesound.org/people/Alex_hears_things/sounds/379914/)
  by **Alex_hears_things (Alex Fitzwater / needle media)**, CC0 1.0.
  A Toyota Hilux diesel 4×4, used as an approximation of the KDJ95 diesel.
  [Downloaded preview](https://cdn.freesound.org/previews/379/379914_2309965-hq.mp3).
  Trimmed 49–56 s to a steady engine section, mixed to mono, filtered at
  35–5000 Hz, crossfaded the last/first 0.15 s, and reduced gain by 8.9 dB.
  Final loop: 6.85 s, **70,992 bytes**; RMS **−20.0 dBFS**, peak **−8.7 dBFS**.

- **wind.m4a** — [WIND_loop](https://freesound.org/people/kevinklang/sounds/841982/)
  by **kevinklang**, CC0 1.0. Wind recorded through a partly open veranda door.
  [Downloaded preview](https://cdn.freesound.org/previews/841/841982_14469752-hq.mp3).
  Trimmed 2–16 s, mixed to mono, filtered at 120–6500 Hz, crossfaded the
  last/first 1 s, and raised gain by 1.4 dB.
  Final loop: 13 s, **133,615 bytes**; RMS **−21.9 dBFS**, peak **−3.2 dBFS**.

- **sand.m4a** — [sand pour on sand FF662.aif](https://freesound.org/people/martinimeniscus/sounds/199332/)
  by **martinimeniscus (Florentine Films SFX)**, CC0 1.0. Actual sand pouring
  onto sand, used as tyre crunch texture rather than a recording of tyres.
  [Downloaded preview](https://cdn.freesound.org/previews/199/199332_2320755-hq.mp3).
  Trimmed 9–20 s, mixed to mono, filtered at 180–6500 Hz, crossfaded the
  last/first 0.6 s, raised gain by 22.5 dB, and limited transients with ffmpeg
  `alimiter=limit=0.7:attack=5:release=100:level=false:latency=true`.
  Final loop: 10.4 s, **111,355 bytes**; RMS **−23.8 dBFS**, peak **−2.0 dBFS**.

All files were resampled to 44.1 kHz and encoded as mono AAC at 80 kbps in M4A
with faststart for Safari/iPhone and desktop decoding. Total: **315,962 bytes**
(about 309 KiB). RMS and peak were measured on the final decoded AAC files with
`ffmpeg -i FILE -af volumedetect -f null -`; AAC can overshoot the pre-encode
limiter peak slightly. Loop joins overlap tail and head, then continue through
the middle of the recording, avoiding a fade to silence on every repeat.

The engine uses one steady loop with smooth RPM pitch changes (1–2.1×) and
throttle volume, rather than claiming separate recorded RPM bands. Wind rises
with speed; sand rises with contacting wheel movement, wheelspin approximation,
and sinkage. `M` or the speaker button toggles mute. Audio starts on the first
pointer/key gesture and retries on later gestures after load failures or mobile
audio interruptions. Master volume and smoothing are tunable in `src/audio.ts`.

These clips and the mix still need a human listening pass, especially the
engine's upper pitch range and loop joins. No listening or physical iPhone test
was possible during implementation.
