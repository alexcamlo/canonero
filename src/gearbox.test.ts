import { describe, expect, test } from 'vitest';
import { GEARBOX, shift } from './gearbox';

describe('shift', () => {
  test('gears go up with speed', () => {
    let gear = 1;
    const seen: number[] = [];
    for (let v = 0; v <= GEARBOX.topSpeed; v += 0.5) {
      gear = shift(v, gear).gear;
      seen.push(gear);
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen[0]).toBe(1);
    expect(seen.at(-1)).toBe(GEARBOX.gears);
  });

  test('hysteresis: no downshift right at the boundary', () => {
    const boundary = GEARBOX.topSpeed / GEARBOX.gears;
    expect(shift(boundary - 0.1, 2).gear).toBe(2);
    expect(shift(boundary - GEARBOX.downshiftGap - 0.1, 2).gear).toBe(1);
  });

  test('downshifts automatically as the truck slows on a climb', () => {
    const cruising = shift(GEARBOX.topSpeed * 0.9, 1);
    const climbing = shift(1, cruising.gear);
    expect(cruising.gear).toBe(GEARBOX.gears);
    expect(climbing.gear).toBe(1);
    expect(climbing.driveForceMultiplier).toBeGreaterThan(cruising.driveForceMultiplier);
  });

  test('rpm stays in 0..1 and resets after an upshift', () => {
    const boundary = GEARBOX.topSpeed / GEARBOX.gears;
    const before = shift(boundary - 0.1, 1);
    const after = shift(boundary + 0.1, 1);
    expect(before.rpm).toBeGreaterThan(0.9);
    expect(after.rpm).toBeLessThan(0.3);
    expect(shift(100, 1).rpm).toBeLessThanOrEqual(1);
  });
});
