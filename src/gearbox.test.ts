import { describe, expect, test } from 'vitest';
import { GEARBOX, shift } from './gearbox';

describe('shift', () => {
  test('gears go up with speed', () => {
    let gear = 1;
    const seen: number[] = [];
    for (let v = 0; v <= GEARBOX.topSpeed.high; v += 0.5) {
      gear = shift(v, 'high', gear).gear;
      seen.push(gear);
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen[0]).toBe(1);
    expect(seen.at(-1)).toBe(GEARBOX.gears);
  });

  test('hysteresis: no downshift right at the boundary', () => {
    const boundary = GEARBOX.topSpeed.high / GEARBOX.gears;
    expect(shift(boundary - 0.1, 'high', 2).gear).toBe(2);
    expect(shift(boundary - GEARBOX.downshiftGap - 0.1, 'high', 2).gear).toBe(1);
  });

  test('low range has more force and a lower top speed', () => {
    expect(GEARBOX.topSpeed.low).toBeLessThan(GEARBOX.topSpeed.high);
    expect(shift(3, 'low', 1).driveForceMultiplier).toBeGreaterThan(shift(3, 'high', 1).driveForceMultiplier);
    expect(shift(20, 'low', 1).gear).toBe(GEARBOX.gears);
    expect(shift(20, 'high', 1).gear).toBeLessThan(GEARBOX.gears);
  });

  test('rpm stays in 0..1 and resets after an upshift', () => {
    const before = shift(7.4, 'high', 1);
    const after = shift(7.6, 'high', 1);
    expect(before.rpm).toBeGreaterThan(0.9);
    expect(after.rpm).toBeLessThan(0.3);
    expect(shift(100, 'high', 1).rpm).toBeLessThanOrEqual(1);
  });
});
