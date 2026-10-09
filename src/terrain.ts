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

// Weights in rolling, transverse, star order; shared with future surface lookup.
export function regionWeights(seed: string) {
  const noise = createNoise2D(prng(`${seed}:regions`));
  const frequency = 0.0003;
  return (x: number, z: number): [number, number, number] => {
    const n = noise(x * frequency + 123.4, z * frequency + 456.7);
    const smooth = (t: number) => {
      t = Math.max(0, Math.min(1, t));
      return t * t * (3 - 2 * t);
    };
    const rolling = 1 - smooth((n + 0.45) / 0.35);
    const star = smooth((n - 0.1) / 0.35);
    return [rolling, 1 - rolling - star, star];
  };
}

// Terrain height in metres at world (x, z); a pure function of the seed.
export function createHeight(seed: string) {
  const dunes = { rollingAmplitude: 4, ridgeAmplitude: 12, starAmplitude: 21, starFrequency: 0.006 };
  const random = prng(seed);
  const swell = createNoise2D(random);
  const ridge = createNoise2D(random);
  const warp = createNoise2D(random);
  const ox = random() * 1e4; // simplex is 0 at the origin for every seed, so shift each desert
  const oz = random() * 1e4;
  const weights = regionWeights(seed);
  const rolling = (x: number, z: number) => swell(x * 0.005, z * 0.005) * dunes.rollingAmplitude;
  const transverse = (x: number, z: number) => {
    // One wind along +x: stretch every crest along z, with only a light warp.
    const w = warp(x * 0.004, z * 0.004) * 0.2;
    const n = ridge(x * 0.008 + w, z * 0.0015);
    const r = 1 - Math.sqrt(n * n + 0.02);
    return r * r * dunes.ridgeAmplitude;
  };
  const star = (x: number, z: number) => {
    x *= dunes.starFrequency;
    z *= dunes.starFrequency;
    // Intersect three ridge directions to make peaks with radial arms.
    const a = 1 - Math.sqrt(ridge(x, z * 0.3) ** 2 + 0.02);
    const b = 1 - Math.sqrt(ridge(x * 0.5 + z * 0.866, (z * 0.5 - x * 0.866) * 0.3) ** 2 + 0.02);
    const c = 1 - Math.sqrt(ridge(x * 0.5 - z * 0.866, (z * 0.5 + x * 0.866) * 0.3) ** 2 + 0.02);
    return a * b * c * dunes.starAmplitude;
  };

  return (wx: number, wz: number) => {
    const x = wx + ox;
    const z = wz + oz;
    const base = swell(x * 0.0025, z * 0.0025) * 10; // broad rises and basins
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
