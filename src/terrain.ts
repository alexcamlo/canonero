import { createNoise2D } from 'simplex-noise';

// mulberry32 seeded from an FNV-1a hash of the seed string
function prng(seed: string) {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};

// Weights in rolling, transverse, star order; also used for ground colours.
export function regionWeights(seed: string) {
  const noise = createNoise2D(prng(`${seed}:regions`));
  const frequency = 0.0003;
  return (x: number, z: number): [number, number, number] => {
    const n = noise(x * frequency + 123.4, z * frequency + 456.7);
    const rolling = 1 - smooth((n + 0.45) / 0.35);
    const star = smooth((n - 0.1) / 0.35);
    return [rolling, 1 - rolling - star, star];
  };
}

// Per-region sand tones (sRGB 0-1).
const GROUND = [[0.93, 0.72, 0.47], [0.92, 0.6, 0.33], [0.9, 0.5, 0.25]];
const LOOSE = { tone: [0.97, 0.84, 0.66], mix: 0.3 }; // loose sand reads paler, like fresh slip-face sand

// Ground colour at world (x, z): region palettes blended by weight, paled by softness so soft sand can be read.
export function createGroundColor(seed: string) {
  const weights = regionWeights(seed);
  return (x: number, z: number, soft: number): [number, number, number] => {
    const w = weights(x, z);
    return [0, 1, 2].map((c) => {
      const sand = w[0] * GROUND[0][c] + w[1] * GROUND[1][c] + w[2] * GROUND[2][c];
      return sand + (LOOSE.tone[c] - sand) * LOOSE.mix * soft;
    }) as [number, number, number];
  };
}

// Ridge crest softening: smaller = crisper crest lines.
const CREST = { transverse: 0.12, star: 0.006 };

// Terrain height in metres at world (x, z); a pure function of the seed.
export function createHeight(seed: string) {
  const dunes = {
    rollingAmplitude: 6, ridgeAmplitude: 18, starAmplitude: 32, starFrequency: 0.004,
    ridgeFrequency: 0.0066, skew: 0.75, // long windward rise, short +x slip face near the angle of repose
    megaAmplitude: 175, megaFrequency: 0.00072, // Erg Chebbi-size star dunes (~150 m with the rest); same slope ratio as the small ones
  };
  const random = prng(seed);
  const swell = createNoise2D(random);
  const ridge = createNoise2D(random);
  const warp = createNoise2D(random);
  const ox = random() * 1e4; // simplex is 0 at the origin for every seed, so shift each desert
  const oz = random() * 1e4;
  const weights = regionWeights(seed);
  const rolling = (x: number, z: number) => swell(x * 0.0033, z * 0.0033) * dunes.rollingAmplitude;
  const transverse = (x: number, z: number) => {
    const phase = x * dunes.ridgeFrequency + warp(x * 0.0005, z * 0.004) * 0.4;
    const t = phase - Math.floor(phase);
    const u = t < dunes.skew ? t / dunes.skew : (1 - t) / (1 - dunes.skew);
    // Round the brink and trough without steepening the planar faces or making seams at the wrap.
    const e = CREST.transverse;
    const profile = u < e ? u * u / (2 * e) : u > 1 - e ? 1 - e - (1 - u) ** 2 / (2 * e) : u - e / 2;
    const saddle = 0.3 + 0.7 * smooth((ridge(x * 0.0008, z * 0.006) + 1) * 0.75);
    return dunes.ridgeAmplitude * saddle * profile / (1 - e);
  };
  // Star dune shape, 0..1, at unit frequency. Intersect three ridge directions to make peaks with radial arms.
  const starShape = (x: number, z: number) => {
    const a = 1 - Math.sqrt(ridge(x, z * 0.3) ** 2 + CREST.star);
    const b = 1 - Math.sqrt(ridge(x * 0.5 + z * 0.866, (z * 0.5 - x * 0.866) * 0.3) ** 2 + CREST.star);
    const c = 1 - Math.sqrt(ridge(x * 0.5 - z * 0.866, (z * 0.5 + x * 0.866) * 0.3) ** 2 + CREST.star);
    return a * b * c;
  };
  // Small star dunes ride on the flanks of mega-dunes; the offset decorrelates the two scales.
  const star = (x: number, z: number) =>
    starShape(x * dunes.megaFrequency + 500, z * dunes.megaFrequency + 500) * dunes.megaAmplitude +
    starShape(x * dunes.starFrequency, z * dunes.starFrequency) * dunes.starAmplitude;

  return (wx: number, wz: number) => {
    const x = wx + ox;
    const z = wz + oz;
    const base = swell(x * 0.0018, z * 0.0018) * 14; // broad rises and basins (dune bowls)
    const [r, t, s] = weights(wx, wz);
    return base + r * rolling(x, z) + t * transverse(x, z) + s * star(x, z);
  };
}

// ?seed= from the URL, or a fresh random one written back so the desert can be shared/reloaded.
export function seedFromUrl() {
  const url = new URL(location.href);
  let seed = url.searchParams.get('seed');
  if (!seed) {
    seed = Math.random().toString(36).slice(2, 8);
    url.searchParams.set('seed', seed);
    history.replaceState(null, '', url);
  }
  return seed;
}

const slopeAt = (h: (x: number, z: number) => number, x: number, z: number) =>
  Math.hypot(h(x + 1, z) - h(x - 1, z), h(x, z + 1) - h(x, z - 1)) / 2;

// Flattest, firmest point on a grid within `radius` of (x, z); the start itself is a candidate.
// Softness counts like slope so reset never drops you on a slip face or in a bowl.
export function findFlatSpot(h: (x: number, z: number) => number, soft: (x: number, z: number) => number, x: number, z: number, radius = 30, step = 5) {
  const score = (x: number, z: number) => slopeAt(h, x, z) + soft(x, z);
  let best = { x, z };
  let bestScore = score(x, z);
  for (let dx = -radius; dx <= radius; dx += step) {
    for (let dz = -radius; dz <= radius; dz += step) {
      if (Math.hypot(dx, dz) > radius) continue;
      const s = score(x + dx, z + dz);
      if (s < bestScore) [best, bestScore] = [{ x: x + dx, z: z + dz }, s];
    }
  }
  return best;
}

// Sand softness, 0 wind-packed .. 1 loose. The wind blows along +x (see transverse()).
export const SOFT = {
  step: 2, // m between stencil samples; matches the chunk grid so colours reuse its heights
  base: 0.1, // flat open ground
  lee: 1.5, // per unit of slope falling toward +x: slip faces collect sand blown over the crest
  windward: 1.5, // per unit of slope rising toward +x: the wind packs the stoss side
  steep: 0.8, slopeFloor: 0.25, // steep sand is loose even across the wind; gentle slopes keep their firm lines
  crest: 16, // per 1/m of convex curvature: loose grains pile up on sharp crests
  bowl: 25, // per 1/m of concave curvature: avalanching sand settles in hollows and at the toe of slip faces
  curveFloor: 0.01, // 1/m; broad shoulders and gentle swells don't count
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Softness from heights at a point and `d` m along +x, -x, +z, -z.
export function softness(c: number, xp: number, xm: number, zp: number, zm: number, d = SOFT.step) {
  const gx = (xp - xm) / (2 * d);
  const slope = Math.hypot(gx, (zp - zm) / (2 * d));
  const curve = (xp + xm + zp + zm - 4 * c) / (d * d); // Laplacian: crest < 0 < bowl
  return clamp01(
    SOFT.base + SOFT.lee * Math.max(0, -gx) - SOFT.windward * Math.max(0, gx) +
    SOFT.steep * Math.max(0, slope - SOFT.slopeFloor) +
    SOFT.crest * Math.max(0, -curve - SOFT.curveFloor) + SOFT.bowl * Math.max(0, curve - SOFT.curveFloor),
  );
}

export function createSoftness(height: (x: number, z: number) => number) {
  const d = SOFT.step;
  return (x: number, z: number) => softness(height(x, z), height(x + d, z), height(x - d, z), height(x, z + d), height(x, z - d));
}
