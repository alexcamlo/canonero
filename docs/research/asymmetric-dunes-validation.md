# Asymmetric dunes — issue #21

Validated against `d0c267c` on 2026-10-11. Shared seed URLs now produce different transverse terrain. Rolling and star height formulas, seed/noise allocation, truck physics, camera, audio and HUD are unchanged.

## Shape and softness

A warped, asymmetric periodic ridge replaces the symmetric noise ridge. The upwind rise occupies 75% of the wavelength; the +x lee face occupies 25%. Frequency is 0.0066/m (about 152 m between ridges), amplitude 18 m. Quadratic rounding over the last/first 12% of each face gives continuous height and slope at both brinks and troughs, including the phase wrap. Noise along z reduces amplitude to 30% at saddles. The same two noise evaluations per transverse sample now control bending and saddle height.

The suggested one/two-pass wave skew was sampled first: isolated slopes exceeded repose before the overall lee/windward distribution reached the target. Explicit face lengths make slope tuning predictable without folds or an iterative solve.

Softness retains the existing crest/bowl curvature and windward terms. Lee aspect weight drops from 2 to 1.5; a new `0.8 * max(0, slope - 0.25)` contribution makes steep crosswind faces looser without penalising gentle routes. Existing terrain, softness, sinkage and spawn/reset tests pass. Pure-seam regressions cover three-seed slope distributions and crosswind softness.

## Slopes

Sample world x/z from −2000 to +2000 m, every 8 m; retain transverse weight >0.9. Gradient is `(h(x+2,z)-h(x-2,z))/4`. Percentiles are **within each facing direction**: `-gx` for negative gx, `gx` for positive gx. This differs from the issue's introductory ±0.27 percentiles over the combined population; before and after below use identical sampling and definitions.

| Seed | Samples | Before lee / windward P90 | After lee / windward P90 | Ratio | Lee samples >0.75 |
| --- | ---: | --- | --- | ---: | ---: |
| dune | 54,919 | 0.392 / 0.395 | 0.559 / 0.232 | 2.41 | 0% |
| erg | 61,636 | 0.396 / 0.401 | 0.562 / 0.219 | 2.56 | 0% |
| chebbi | 56,349 | 0.407 / 0.374 | 0.566 / 0.224 | 2.52 | 0.035% |

Lee P90 is 29.2–29.5°; windward P90 12.4–13.1°. Maximum sampled lee gradients are 0.715, 0.734 and 0.817. The last is a rare outlier in the blended terrain, not a hard cap: all three 99.9th percentiles remain below 0.75. Existing shared-edge and star-region tests pass.

## Scripted driving

Scratch Vitest harness: Rapier at 60 Hz, real `createTruck`, real `chunkHeights` heightfield colliders within two chunks of the truck, no terrain meshes. Stream every 30 steps. Reset at the requested yaw with the normal 1.5 m drop. High range/full pressure except explicit recovery tests; reinflate to 100% before the next run. Each command was time limited. Scratch harnesses are removed before commit as requested.

These are fresh location selections, not exact replays of #20's unpublished harness. A companion run against the old generator and softness helps separate harness differences from changed terrain.

### Cruise

Full throttle, sinusoidal steering ±0.12, 60 s, four cardinal headings from the normal spawn in each seed. **10/12** never remain below 0.5 m/s for three consecutive seconds, matching #20's 10/12. Successful runs average **20.1–27.2 m/s** (#20: 16–26); the other two average 2.7 and 11.5 m/s. Three runs tip beyond the 0.25 upright threshold, including one that recovers without a prolonged stop. Straight cruising is not a safe autopilot over every brink.

### Stop, bog and recovery

Select transverse lee slopes (gx −0.55 to −0.25, soft >0.65), windward slopes (gx 0.12–0.25, soft <0.1), and soft bowls (slope <0.12, curvature >0.018). Drop/settle for 3 s facing each way, then full throttle for 8 s. Bog = speed below 0.5 m/s for >3 consecutive seconds. Recovery repeats the bog, uses a technique for 12 s, then full throttle for 8 s; escape = >12 m displacement during that final phase. Rocking changes pedals every 1.2 s; sawing is sinusoidal at 6 rad/s.

| Scenario | #20 reported | Old terrain, this harness | New terrain |
| --- | --- | --- | --- |
| Lee bogs | 13/18 (9/9 uphill) | 8/18 | 9/18 (8/9 uphill) |
| Bowl bogs | 5/8 | 6/8 | 7/8 |
| Windward bogs | 0/12 | 0/12 | 0/12 |
| Rock + saw escapes | 13/18 | 11/14 | 11/16 |
| Rock alone | 4/18 | 3/14 | 1/16 |
| Saw alone | 6/18 | 4/14 | 4/16 |
| Low range + air-down | 14/18 | 7/14 | 5/16 |

Four of 16 new bogs resist all four scripts. This is not a claim that every real player needs Flip there: a driver can reverse farther or select another line. Low range/air-down alone is less reliable on the new steep faces. No sinkage/gearbox tuning was changed to mask that outcome.

### Descents

Use four gentle sites and two steep sites per seed, 5 s per run. Gentle entry is 9 m/s, coast / 25% brake / hard brake; steep entry is 9 or 14 m/s, 0/20/30° off fall line, coast / hard brake / brake plus 0.45 steering. Release braking below 0.6 m/s to avoid commanding reverse. Broach = yaw change >45°; tip/roll = up vector y <0.25. Gentle sites additionally keep terrain slope below 0.22 for the next 30 m, so the test does not accidentally enter a steep face.

All **36 gentle runs** have no rolls or broaches, matching #20. On the steep sites, coasting has **0/18 broaches at each entry speed**. At 9 m/s hard braking stops all 18 and broaches **5/12 off-line runs** (#20: 4/10); brake plus steering broaches 11/18. At 14 m/s hard braking broaches **6/12 off-line runs**, brake plus steering 16/18. No rolls occur in this selected descent matrix, so it does **not reproduce #20's 2–3/5 fast off-line rolls**; high-speed rollover risk does appear in the cresting runs below. On the old terrain, the same steep-site selection method produced 1/18 and 2/18 hard-brake broaches at 9 and 14 m/s, also with no rolls.

### Upwind phone crossing

Four starts per seed, transverse weight >0.95, firm gentle approach with an >8 m rise and a steep lee face in the next 160 m. Pair 60 s runs: hold −x versus line picking within ±45°. The pilot samples nine rays to 120 m every 0.5 s, scoring maximum elevation and uphill gradient with a small turning penalty. Normalize the throttle/steering pair to the drag stick's unit circle and apply `readInput`'s 0.12 deadzone. Only throttle and steering; no low range, air-down or Flip. An initial unconstrained run was discarded after review caught its impossible full-throttle/full-steering combination.

- Straight: **9/12** reach 160 m upwind without stopping; **156 s** total stopped time before that target.
- Pick lines: **10/12** reach it without stopping, all within **17.3 s**; **112 s** total stopped time before that target. The two failures also fail the straight run.
- Over the full minute, detected brinks crossed without a preceding stop: **43/44 straight**, **38/38 picking lines**. Detection tracks uphill-to-downhill transitions with 40 m separation; later travel can enter other regions.
- Full-minute stopped time: **217 s straight**, **145 s picking lines**, with no rolls in either group. The simple pilot mostly gets through, but two of twelve approaches still need a different line or recovery.

### Downwind cresting

Four windward approaches per seed with a lee face about 25 m ahead, +x heading, entry velocity 8 or 15 m/s, then full throttle for 8 s. Air means all wheels out of contact for >0.15 s after landing from the initial reset. **12/12 get air at both speeds**. At 8 m/s all land upright; at 15 m/s **2/12 roll**, one of those ends with sinkage >0.8. No run stays stopped for three seconds. Entry speeds are at the approach, not speed-controlled measurements at the exact brink.

## Cost and browser

Alternating before/after `chunkHeights` batches on seed `dune`, chunk (−10,2), transverse weight >0.99 at its centre. Twelve batches per implementation, 200 chunks per batch; discard the first two and compare median time/chunk: **1.719 ms before, 2.148 ms after (+24.9%)**, within the approximate +30% budget. Shared-machine timings are noisy; this measures height generation, not whole-frame/mobile performance.

Inspected the actual app at desktop and phone-landscape sizes, plus an elevated view of the real chunk meshes at dune (−800,300), low sun `time=0.28`. Faces and saddles are visible, brinks smooth at the 2 m grid, and no visible seams or application console errors. Screenshot capture emitted GPU ReadPixels performance warnings. Used T3's collaborative browser as required by the environment; screenshots are `/tmp/dunes/issue-21-transverse.png` and `/tmp/dunes/issue-21-phone.png`. Closed the browser and stopped the timeout-wrapped tmux dev server.

No physical-phone performance or human driving session was performed. No push, PR, issue closure or deployment.

Final checks: `pnpm tsc --noEmit`, all 43 tests in seven files via `pnpm vitest run`, `pnpm build`, and `git diff --check` pass. Build retains the existing large-bundle warning. Independent standards review found no issues; spec review's phone-stick validation finding was corrected and re-reviewed with zero remaining findings.
