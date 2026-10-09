import { expect, test } from 'vitest';
import { compass, hudIdle } from './hud';

test('idle resets on change and otherwise accrues', () => {
  expect(hudIdle(2, true, 0.1)).toBe(0);
  expect(hudIdle(2, false, 0.5)).toBe(2.5);
});

test('compass: north is -z, east is +x', () => {
  expect(compass(0, -1)).toBe('N 0°');
  expect(compass(1, 0)).toBe('E 90°');
  expect(compass(-1, 0)).toBe('W 270°');
});
