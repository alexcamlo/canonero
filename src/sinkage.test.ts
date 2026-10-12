import { describe, expect, test } from 'vitest';
import { drag, SINKAGE, stepSinkage, traction, wheelSpin, type Wheel } from './sinkage';

const still: Wheel = { softness: 1, groundSpeed: 0, wheelSpin: 0, pressure: 1, load: SINKAGE.referenceLoad };

function run(s: number, w: Partial<Wheel>, seconds: number, dt = 1 / 60) {
  for (let t = 0; t < Math.round(seconds / dt); t++) s = stepSinkage(s, { ...still, ...w }, dt);
  return s;
}

describe('load-supported settling', () => {
  test('parked tyres reach a finite depth instead of continually burying themselves', () => {
    const settled = run(0, {}, 10);
    expect(settled).toBeGreaterThan(0.1);
    expect(settled).toBeLessThan(0.4);
    expect(run(settled, {}, 120)).toBeCloseTo(settled, 6);
  });

  test('more load sinks deeper; a larger aired-down footprint sinks less', () => {
    expect(run(0, { load: still.load * 2 }, 10)).toBeGreaterThan(run(0, {}, 10));
    expect(run(0, { pressure: 0.4 }, 10)).toBeLessThan(run(0, {}, 10) * 0.7);
    expect(run(0, { softness: 0 }, 10)).toBeLessThan(run(0, {}, 10));
  });

  test('unloaded tyres cannot dig, and zero time cannot alter depth', () => {
    expect(run(0.2, { load: 0, wheelSpin: 1 }, 30)).toBe(0.2);
    expect(stepSinkage(0.2, still, 0)).toBe(0.2);
  });
});

describe('digging and recovery', () => {
  test('excess drive digs deeper than controlled crawling, even at speed', () => {
    for (const groundSpeed of [0, 0.5, 6]) {
      expect(run(0, { wheelSpin: 1, groundSpeed }, 5)).toBeGreaterThan(run(0, { groundSpeed }, 5));
    }
    expect(run(0, { softness: 0, wheelSpin: 1 }, 30)).toBeLessThanOrEqual(SINKAGE.firmCap);
    expect(run(0, { wheelSpin: 1 }, 30)).toBeLessThanOrEqual(1);
  });

  test('lifting the throttle does not refill a hole; moving out does', () => {
    expect(run(0.8, {}, 30)).toBe(0.8);
    const forward = run(0.8, { groundSpeed: 1 }, 3);
    expect(forward).toBeLessThan(0.4);
    expect(run(0.8, { groundSpeed: -1 }, 3)).toBeCloseTo(forward);
    expect(run(0.8, { softness: 0, groundSpeed: 1 }, 3)).toBeLessThan(0.1);
  });

  test('speed cannot float tyres above their load-supported depth', () => {
    expect(run(0, { groundSpeed: 20 }, 10)).toBeCloseTo(run(0, {}, 10));
  });

  test('settling and excavation are stable across timestep sizes', () => {
    const wheel = { wheelSpin: 0.7, groundSpeed: 0.5 };
    expect(run(0.6, wheel, 3, 1 / 30)).toBeCloseTo(run(0.6, wheel, 3, 1 / 120), 6);
  });
});

test('spin follows unmet drive demand in either direction, not throttle or speed alone', () => {
  expect(wheelSpin(3000, 50, 1 / 60)).toBe(0);
  expect(wheelSpin(3000, 25, 1 / 60)).toBe(0.5);
  expect(wheelSpin(-3000, -25, 1 / 60)).toBe(0.5);
  expect(wheelSpin(0, 20, 1 / 60)).toBe(0);
  expect(wheelSpin(3000, 0, 0)).toBe(0);
  expect(wheelSpin(3000, 60, 1 / 60)).toBe(0);
});

test('loose sand and burial reduce grip; aired-down tyres retain more grip', () => {
  expect(traction(1)).toBeLessThan(traction(0.5));
  expect(traction(1, 1, 1)).toBeGreaterThan(0);
  expect(traction(0, 0.4, 1)).toBeLessThan(traction(0, 0.4, 0));
  expect(traction(0.8, 0.4)).toBeGreaterThan(traction(0.8, 1));
});

test('soil resistance scales with load and burial, with extra cost for sideways ploughing', () => {
  expect(drag(0, 0, still.load)).toBe(0);
  expect(drag(1, 1, 0, true)).toBe(0);
  expect(drag(1, 1, still.load)).toBeGreaterThan(drag(0.5, 1, still.load));
  expect(drag(0.2, 1, still.load * 2)).toBe(2 * drag(0.2, 1, still.load));
  expect(drag(0.2, 1, still.load, true)).toBeGreaterThan(drag(0.2, 1, still.load));
});
