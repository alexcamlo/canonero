export type Range = 'high' | 'low';

export const GEARBOX = {
  gears: 4,
  ratios: [1.5, 1.2, 1.0, 0.85], // drive force multiplier per gear: short gears pull harder
  topSpeed: { high: 30, low: 14 }, // m/s
  rangeForce: { high: 1, low: 1.8 }, // low range: more torque at the wheels
  idleRpm: 0.2, // rpm is 0..1
  downshiftGap: 1.5, // m/s below the gear boundary before dropping back, so gears don't hunt
};

const G = GEARBOX;

// Automatic gearbox: no per-gear simulation, just the gear implied by speed plus a force multiplier.
export function shift(speed: number, range: Range, gear: number) {
  const s = Math.abs(speed);
  const band = G.topSpeed[range] / G.gears;
  while (gear < G.gears && s > gear * band) gear++;
  while (gear > 1 && s < (gear - 1) * band - G.downshiftGap) gear--;
  const rpm = G.idleRpm + (1 - G.idleRpm) * Math.min(1, Math.max(0, (s - (gear - 1) * band) / band));
  return { gear, rpm, driveForceMultiplier: G.ratios[gear - 1] * G.rangeForce[range] };
}
