export const GEARBOX = {
  gears: 4,
  ratios: [2.7, 2.16, 1.8, 1.53], // fixed short gearing: the former low-range drive multipliers
  topSpeed: 30, // m/s, before the sand-tyre speed limit (~82 km/h on sand tyres)
  idleRpm: 0.2, // rpm is 0..1
  downshiftGap: 1.5, // m/s below the gear boundary before dropping back, so gears don't hunt
};

const G = GEARBOX;

// shortcut: speed bands approximate the automatic; replace when calibrated engine/converter data is available.
export function shift(speed: number, gear: number) {
  const s = Math.abs(speed);
  const band = G.topSpeed / G.gears;
  while (gear < G.gears && s > gear * band) gear++;
  while (gear > 1 && s < (gear - 1) * band - G.downshiftGap) gear--;
  const rpm = G.idleRpm + (1 - G.idleRpm) * Math.min(1, Math.max(0, (s - (gear - 1) * band) / band));
  return { gear, rpm, driveForceMultiplier: G.ratios[gear - 1] };
}
