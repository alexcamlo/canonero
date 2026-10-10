import { describe, expect, test } from 'vitest';
import { drag, plough, stepSinkage, traction, type Wheel } from './sinkage';

const still: Wheel = { softness: 1, groundSpeed: 0, wheelSpin: 0, steerRate: 0, pressure: 1, isFront: false, dirChanged: false, plough: 0 };

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
    const shallow = run(0, { softness: 0, wheelSpin: 1 }, 30);
    expect(shallow).toBeGreaterThan(0);
    expect(shallow).toBeLessThan(0.2);
  });

  test('half-soft sand sinks slower and less deep than soft sand', () => {
    const half = run(0, { softness: 0.5, wheelSpin: 1 }, 30);
    expect(half).toBeGreaterThan(run(0, { softness: 0, wheelSpin: 1 }, 30));
    expect(half).toBeLessThan(0.8);
    expect(run(0, { softness: 0.5 }, 1)).toBeLessThan(run(0, {}, 1));
  });

  test('rolling from soft onto firm sand climbs back out', () => {
    expect(run(0.9, { softness: 0, groundSpeed: 1 }, 3)).toBeLessThan(0.3);
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

describe('braking hard downhill', () => {
  test('ploughs only when braking hard on a steep descent', () => {
    expect(plough(1, 0.5)).toBe(1); // full brake, 30° nose down
    expect(plough(0.3, 0.5)).toBe(0); // feathering the brake
    expect(plough(1, 0.15)).toBe(0); // gentle descent
    expect(plough(1, -0.5)).toBe(0); // braking uphill
  });

  test('ploughing digs the front wheels in fast, past the firm-sand cap', () => {
    const dig = { softness: 0, groundSpeed: 6, plough: 1 };
    expect(run(0, { ...dig, isFront: true }, 0.5)).toBeGreaterThan(0.5);
    expect(run(0, { ...dig, isFront: false }, 0.5)).toBe(0);
  });
});

test('sinkage costs traction and adds drag', () => {
  expect(traction(0)).toBe(1);
  expect(traction(1)).toBeLessThan(traction(0.5));
  expect(traction(1)).toBeGreaterThan(0);
  expect(drag(0)).toBe(0);
  expect(drag(1)).toBeGreaterThan(drag(0.5));
  expect(drag(0, 1)).toBeGreaterThan(0); // loose sand drags even on top
});

describe('air pressure', () => {
  test('lower pressure sinks slower', () => {
    expect(run(0, { pressure: 0.4 }, 2)).toBeLessThan(run(0, {}, 2) * 0.7);
  });

  test('lower pressure grips better, sunk or not', () => {
    expect(traction(0.8, 0.4)).toBeGreaterThan(traction(0.8, 1));
    expect(traction(0, 0.4)).toBeGreaterThan(traction(0, 1));
  });
});
