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

// Ground colour at world (x, z): region palettes blended by weight.
export function createGroundColor(seed: string) {
  const weights = regionWeights(seed);
  return (x: number, z: number): [number, number, number] => {
    const w = weights(x, z);
    return [0, 1, 2].map((c) => w[0] * GROUND[0][c] + w[1] * GROUND[1][c] + w[2] * GROUND[2][c]) as [number, number, number];
  };
}

// Ridge crest softening: smaller = crisper crest lines. Transverse dunes stay drivable; star dunes are meant to be hard.
const CREST = { transverse: 0.013, star: 0.006 };

// Terrain height in metres at world (x, z); a pure function of the seed.
export function createHeight(seed: string) {
  const dunes = {
    rollingAmplitude: 6, ridgeAmplitude: 18, starAmplitude: 32, starFrequency: 0.004,
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
    // One wind along +x: stretch every crest along z, with only a light warp.
    const w = warp(x * 0.004, z * 0.004) * 0.2;
    const n = ridge(x * 0.0053 + w, z * 0.001);
    const r = 1 - Math.sqrt(n * n + CREST.transverse);
    return r * r * dunes.ridgeAmplitude;
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

// Flattest firm point on a grid within `radius` of (x, z); the start itself is a candidate.
// Soft sand is skipped so reset never drops you back in.
export function findFlatSpot(h: (x: number, z: number) => number, surface: (x: number, z: number) => Surface, x: number, z: number, radius = 30, step = 5) {
  let best = { x, z };
  let bestSlope = surface(x, z) === 'soft' ? Infinity : slopeAt(h, x, z);
  for (let dx = -radius; dx <= radius; dx += step) {
    for (let dz = -radius; dz <= radius; dz += step) {
      if (Math.hypot(dx, dz) > radius || surface(x + dx, z + dz) === 'soft') continue;
      const s = slopeAt(h, x + dx, z + dz);
      if (s < bestSlope) [best, bestSlope] = [{ x: x + dx, z: z + dz }, s];
    }
  }
  return best;
}

export type Surface = 'sand' | 'soft';

// ponytail: riverbeds were the only soft sand and are gone; everything is firm until soft sand gets a new home.
export function createSurface(_seed: string) {
  return (_x: number, _z: number): Surface => 'sand';
}
