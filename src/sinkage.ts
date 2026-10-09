import type { Surface } from './terrain';

export type Wheel = {
  surface: Surface;
  groundSpeed: number; // m/s
  wheelSpin: number; // 0..1, how much the wheel is turning without moving the truck
  steerRate: number; // rad/s
  isFront: boolean;
  dirChanged: boolean; // the truck just started moving the other way
};

export const SINKAGE = {
  rise: 0.15, // per second, a stopped wheel on soft sand
  spin: 2, // a fully spinning wheel digs in this many times faster
  float: 0.12, // per second per m/s of ground speed: momentum lifts the wheel back on top
  sandRise: 0.3, // firm sand sinks this fraction as fast as soft
  sandCap: 0.15, // and never deeper than this
  settle: 0.3, // per second, a wheel deeper than sandCap rises while on firm sand
  rock: 0.25, // instant drop each time the truck starts moving the other way
  saw: 0.4, // per rad of steering change: front wheels push into fresh sand
  grip: 0.6, // traction lost at full sinkage
  drag: 4500, // N per wheel at full sinkage, linear so shallow sinkage already holds the truck on a slope; above high-range first-gear force, just under low range
};

const S = SINKAGE;

// One wheel's sinkage (0 on top .. 1 buried) after dt seconds.
export function stepSinkage(s: number, w: Wheel, dt: number) {
  const soft = w.surface === 'soft';
  const cap = soft ? 1 : S.sandCap;
  let ds = S.rise * (soft ? 1 : S.sandRise) * (1 + S.spin * w.wheelSpin) - S.float * Math.abs(w.groundSpeed);
  if (w.isFront) ds -= S.saw * Math.abs(w.steerRate);
  if (s > cap) ds = Math.min(ds, -S.settle);
  const next = s + ds * dt - (w.dirChanged ? S.rock : 0);
  return Math.max(0, Math.min(Math.max(s, cap), next));
}

// Multiplier on the wheel's friction.
export const traction = (s: number) => 1 - S.grip * s;

// Rolling resistance in N the engine has to overcome before the wheel pulls.
export const drag = (s: number) => S.drag * s;
