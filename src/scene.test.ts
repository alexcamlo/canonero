import * as THREE from 'three';
import { expect, test } from 'vitest';
import { DAY, skyAt } from './scene';

test('the cycle starts at the golden-hour look from #17', () => {
  const sky = skyAt(DAY.start);
  expect(sky.sunDir.dot(new THREE.Vector3(-0.55, 0.28, -0.8).normalize())).toBeGreaterThan(0.999);
  expect(sky.lightDir.dot(sky.sunDir)).toBeGreaterThan(0.999);
  expect(sky.horizon.getHex()).toBe(0xf8c487);
  expect(sky.zenith.getHex()).toBe(0x8fb4de);
  expect(sky.light.getHex()).toBe(0xffd0a0);
  expect(sky.lightIntensity).toBeCloseTo(3.2);
  expect(sky.stars).toBe(0);
  expect(sky.lamps).toBe(0);
});

test('noon is bright day; midnight is dark, moonlit and starry with headlights on', () => {
  const noon = skyAt(0.5);
  const midnight = skyAt(0);
  expect(noon.sunDir.y).toBeGreaterThan(0.8);
  expect(noon.zenith.getHex()).toBe(0x4f88c8);
  expect(noon.stars).toBe(0);
  expect(midnight.lightDir.y).toBeGreaterThan(0.8); // the moon is up
  expect(midnight.lightIntensity).toBeLessThan(noon.lightIntensity / 3);
  expect(midnight.horizon.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(noon.horizon.getHSL({ h: 0, s: 0, l: 0 }).l / 10);
  expect(midnight.stars).toBe(1);
  expect(midnight.lamps).toBe(1);
});

test('everything changes smoothly over the cycle, across the 1 → 0 wrap and the sun/moon handover', () => {
  const steps = 2000; // ~0.6 s of a 20 min cycle per step
  const colors = ['light', 'hemiSky', 'hemiGround', 'horizon', 'zenith'] as const;
  const numbers = ['lightIntensity', 'hemiIntensity', 'stars', 'lamps'] as const;
  const light = (s: ReturnType<typeof skyAt>) => s.lightDir.clone().multiplyScalar(s.lightIntensity); // a direction flip only counts if the light is on
  const worst: Record<string, number> = {};
  const track = (key: string, step: number) => (worst[key] = Math.max(worst[key] ?? 0, step));
  let b = skyAt(0);
  for (let n = 0; n < steps; n++) {
    const a = b;
    b = skyAt((n + 1) / steps); // the last step lands on 1, the same instant as 0
    for (const key of colors) track(key, Math.abs(a[key].r - b[key].r) + Math.abs(a[key].g - b[key].g) + Math.abs(a[key].b - b[key].b));
    for (const key of numbers) track(key, Math.abs(a[key] - b[key]));
    track('lightVector', light(a).distanceTo(light(b)));
  }
  for (const key of colors) expect(worst[key], key).toBeLessThan(0.05);
  for (const key of numbers) expect(worst[key], key).toBeLessThan(0.1);
  expect(worst.lightVector).toBeLessThan(0.1);
  expect(skyAt(1).horizon.getHex()).toBe(skyAt(0).horizon.getHex());
});
