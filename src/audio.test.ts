import { expect, test } from 'vitest';
import { AUDIO, audioMix } from './audio';
import { GEARBOX } from './gearbox';

const idle = { rpm: GEARBOX.idleRpm, throttle: 0, speed: 0, wheelSpeed: 0, sinkage: 0 };

test('idle plays at the recorded pitch; throttle adds load and RPM raises pitch', () => {
  expect(audioMix(idle).engineRate).toBe(1);
  const loaded = audioMix({ ...idle, rpm: 1, throttle: 1 });
  expect(loaded.engineRate).toBe(AUDIO.engineRate);
  expect(loaded.engineGain).toBeGreaterThan(audioMix(idle).engineGain);
});

test('wind follows speed in either direction; crunch needs moving contact wheels', () => {
  expect(audioMix(idle).windGain).toBe(0);
  expect(audioMix(idle).sandGain).toBe(0);
  const driving = { ...idle, speed: 15, wheelSpeed: 15 };
  expect(audioMix(driving).windGain).toBeGreaterThan(0);
  expect(audioMix({ ...driving, speed: -15 }).windGain).toBe(audioMix(driving).windGain);
  expect(audioMix({ ...driving, sinkage: 1 }).sandGain).toBeGreaterThan(audioMix(driving).sandGain);
  expect(audioMix({ ...driving, wheelSpeed: 0, sinkage: 1 }).sandGain).toBe(0);
});

test('extreme inputs keep gains and playback rates bounded', () => {
  const low = audioMix({ rpm: -10, throttle: -10, speed: 0, wheelSpeed: -10, sinkage: -10 });
  expect(low.engineRate).toBe(1);
  expect(low.engineGain).toBe(AUDIO.engineIdle);
  expect(low.sandGain).toBe(0);
  const high = audioMix({ rpm: 10, throttle: 10, speed: 1000, wheelSpeed: 1000, sinkage: 10 });
  expect(high.engineRate).toBe(AUDIO.engineRate);
  expect(high.engineGain).toBe(1);
  expect(high.windGain).toBe(AUDIO.windGain);
  expect(high.sandGain).toBe(AUDIO.sandGain * (1 + AUDIO.looseBoost));
});
