import { describe, expect, test } from 'vitest';
import { drag, stepSinkage, traction, type Wheel } from './sinkage';

const still: Wheel = { surface: 'soft', groundSpeed: 0, wheelSpin: 0, steerRate: 0, pressure: 1, isFront: false, dirChanged: false };

// Run the step for `seconds` at 60 Hz.
function run(s: number, w: Partial<Wheel>, seconds: number) {
  for (let t = 0; t < seconds * 60; t++) s = stepSinkage(s, { ...still, ...w }, 1 / 60);
  return s;
}

describe('stepSinkage', () => {
  test('stopped on soft sand sinks', () => {
    expect(run(0, {}, 2)).toBeGreaterThan(0.1);
  });

  test('wheelspin sinks faster than standing still', () => {
    expect(run(0, { wheelSpin: 1 }, 1)).toBeGreaterThan(run(0, {}, 1) * 2);
  });

  test('momentum keeps you on top', () => {
    expect(run(0.5, { groundSpeed: 6 }, 2)).toBeLessThan(0.2);
    expect(run(0.5, { groundSpeed: -6 }, 2)).toBeLessThan(0.2);
  });

  test('firm sand only lets a wheel sink a little', () => {
    const shallow = run(0, { surface: 'sand', wheelSpin: 1 }, 30);
    expect(shallow).toBeGreaterThan(0);
    expect(shallow).toBeLessThan(0.2);
  });

  test('rolling from soft onto sand climbs back out', () => {
    expect(run(0.9, { surface: 'sand', groundSpeed: 1 }, 3)).toBeLessThan(0.3);
  });

  test('rocking: changing direction climbs out of the ruts', () => {
    expect(stepSinkage(0.6, { ...still, dirChanged: true }, 1 / 60)).toBeLessThan(0.5);
  });

  test('sawing the steering lifts the front wheels only', () => {
    const saw = { steerRate: 1.6, wheelSpin: 0.3 };
    expect(run(0.6, { ...saw, isFront: true }, 2)).toBeLessThan(0.4);
    expect(run(0.6, { ...saw, isFront: false }, 2)).toBeGreaterThan(0.6);
  });
});

test('sinkage costs traction and adds drag', () => {
  expect(traction(0)).toBe(1);
  expect(traction(1)).toBeLessThan(traction(0.5));
  expect(traction(1)).toBeGreaterThan(0);
  expect(drag(0)).toBe(0);
  expect(drag(1)).toBeGreaterThan(drag(0.5));
});

describe('air pressure', () => {
  test('lower pressure sinks slower', () => {
    expect(run(0, { pressure: 0.4 }, 2)).toBeLessThan(run(0, {}, 2) * 0.7);
  });

  test('lower pressure keeps more traction when sunk', () => {
    expect(traction(0.8, 0.4)).toBeGreaterThan(traction(0.8, 1));
    expect(traction(0, 0.4)).toBe(1);
  });
});
