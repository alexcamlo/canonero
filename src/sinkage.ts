export type Wheel = {
  softness: number; // 0 wind-packed .. 1 loose (terrain.ts softness)
  groundSpeed: number; // m/s
  wheelSpin: number; // 0..1, how much the wheel is turning without moving the truck
  steerRate: number; // rad/s
  pressure: number; // tyre pressure, 1 = road .. ~0.4 aired down
  isFront: boolean;
  dirChanged: boolean; // the truck just started moving the other way
  plough: number; // 0..1, see plough()
};

export const SINKAGE = {
  rise: 0.3, // per second, a stopped wheel on fully soft sand
  spin: 3, // a fully spinning wheel digs in this many times faster
  float: 0.12, // per second per m/s of ground speed: momentum lifts the wheel back on top
  firmRise: 0.3, // fully firm sand sinks this fraction as fast as soft
  firmCap: 0.15, // and never deeper than this; both scale linearly up to soft
  settle: 0.3, // per second, a wheel deeper than the cap rises back to it
  rock: 0.4, // instant drop each time the truck starts moving the other way
  saw: 0.8, // per rad of steering change: front wheels push into fresh sand
  grip: 0.6, // traction lost at full sinkage
  airedSink: 0.4, // sinking speed at zero pressure (1 at full pressure)
  airedGrip: 0.5, // fraction of the sinkage grip loss left at zero pressure (1 at full pressure)
  airedBonus: 0.3, // extra traction at zero pressure: a longer footprint bites the sand
  dig: 3, // per second at full plough: the front tyres bulldoze a mound of sand
  ploughBrake: 0.5, // brake input where ploughing starts (full at 1)
  ploughSkid: 0.85, // rear grip lost at full plough: weight leaves the locked rear wheels
  ploughSlope: 0.25, // sine of the descent where ploughing starts (~15°, full at twice that, ~30°)
  roll: 700, // N per wheel on fully soft sand at any sinkage: ~0.15 of the truck's weight, like loose sand
  drag: 4500, // N per wheel at full sinkage, linear so shallow sinkage already holds the truck on a slope; above high-range first-gear force, just under low range
};

const S = SINKAGE;

// One wheel's sinkage (0 on top .. 1 buried) after dt seconds.
export function stepSinkage(s: number, w: Wheel, dt: number) {
  let cap = S.firmCap + (1 - S.firmCap) * w.softness;
  let ds = S.rise * (S.firmRise + (1 - S.firmRise) * w.softness) * (S.airedSink + (1 - S.airedSink) * w.pressure) * (1 + S.spin * w.wheelSpin) - S.float * Math.abs(w.groundSpeed);
  if (w.isFront) {
    ds += S.dig * w.plough - S.saw * Math.abs(w.steerRate);
    cap = Math.max(cap, w.plough); // ploughing piles sand up even on firm ground
  }
  if (s > cap) ds = Math.min(ds, -S.settle);
  const next = s + ds * dt - (w.dirChanged ? S.rock : 0);
  return Math.max(0, Math.min(Math.max(s, cap), next));
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// 0..1: braking hard while pointed down a steep face. Weight shifts onto the front tyres and they dig in.
// downhill = sine of the descent along the direction of travel (negative when climbing).
export const plough = (brake: number, downhill: number) =>
  clamp01((brake - S.ploughBrake) / (1 - S.ploughBrake)) * clamp01(downhill / S.ploughSlope - 1);

// Multiplier on the wheel's friction; a flatter tyre grips more and floats better, so it loses less to sinkage.
export const traction = (s: number, pressure = 1) =>
  (1 + S.airedBonus * (1 - pressure)) * (1 - S.grip * s * (S.airedGrip + (1 - S.airedGrip) * pressure));

// Rolling resistance in N the engine has to overcome before the wheel pulls. Loose sand drags even before you sink.
export const drag = (s: number, softness = 0) => S.drag * s + S.roll * softness;
