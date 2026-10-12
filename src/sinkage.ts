export type Wheel = {
  softness: number; // 0 wind-packed .. 1 loose (terrain.ts softness)
  groundSpeed: number; // m/s across the contact plane
  wheelSpin: number; // 0..1, fraction of requested drive impulse not delivered
  pressure: number; // tyre pressure, 1 = road .. ~0.4 aired down
  load: number; // N supported by this wheel
};

export const SINKAGE = {
  referenceLoad: 4905, // N, one quarter of the 2000 kg truck's weight
  settle: 2, // per second, approach load-supported depth
  spin: 0.9, // per second, excavation under excess traction demand
  contactLength: 0.8, // m of travel to replace the sand beneath a tyre
  firmCap: 0.15,
  grip: 0.6, // traction lost at full sinkage
  airedSink: 0.4, // relative contact pressure at zero tyre pressure
  airedGrip: 0.5,
  airedBonus: 0.3,
  roll: 0.14, // rolling resistance / normal load on fully loose sand
  drag: 0.9, // added rolling resistance / normal load at full burial
  scrub: 0.5, // extra lateral soil displacement resistance / normal load
};

const S = SINKAGE;

// shortcut: excess drive demand estimates spin; replace with wheel angular dynamics for measured slip.
export function wheelSpin(engineForce: number, forwardImpulse: number, dt: number) {
  const requested = Math.abs(engineForce) * dt;
  return requested > 0 ? Math.max(0, Math.min(1, 1 - Math.abs(forwardImpulse) / requested)) : 0;
}

// One wheel's sinkage (0 on top .. 1 buried); unloaded tyres cannot deform sand.
export function stepSinkage(s: number, w: Wheel, dt: number) {
  if (w.load <= 0 || dt <= 0) return s;
  const cap = S.firmCap + (1 - S.firmCap) * w.softness;
  const pressure = (w.load / S.referenceLoad) * (S.airedSink + (1 - S.airedSink) * w.pressure);
  // Pressure–sinkage approximation; coefficients are game calibration, not measured soil data.
  const rest = Math.min(cap, (0.04 + 0.32 * w.softness) * pressure ** (1 / 1.1));
  // shortcut: travel replaces local sand without persistent ruts; add terrain memory for repeated-track recovery.
  const supportRate = (s < rest ? S.settle : 0) + Math.abs(w.groundSpeed) / S.contactLength;
  const digRate = S.spin * w.wheelSpin * (0.2 + 0.8 * w.softness) * Math.min(pressure, 2);
  const rate = supportRate + digRate;
  if (rate === 0) return s; // a dug hole does not heal just because the throttle is released
  const target = (supportRate * rest + digRate * Math.max(s, cap)) / rate;
  return Math.max(0, Math.min(1, target + (s - target) * Math.exp(-rate * dt)));
}

export const traction = (s: number, pressure = 1, softness = 0) =>
  (1 - 0.55 * softness) * (1 + S.airedBonus * (1 - pressure)) * (1 - S.grip * s * (S.airedGrip + (1 - S.airedGrip) * pressure));

// Soil displacement resistance is separate from Rapier's tyre grip and scales with support load.
export const drag = (s: number, softness: number, load: number, lateral = false) =>
  Math.max(0, load) * (S.drag * s + S.roll * softness + (lateral ? S.scrub * (softness + s) : 0));
