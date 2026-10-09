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

// Terrain height in metres at world (x, z); a pure function of the seed.
export function createHeight(seed: string) {
  const random = prng(seed);
  const swell = createNoise2D(random);
  const ridge = createNoise2D(random);
  const warp = createNoise2D(random);
  const ox = random() * 1e4; // simplex is 0 at the origin for every seed, so shift each desert
  const oz = random() * 1e4;

  return (wx: number, wz: number) => {
    const x = wx + ox;
    const z = wz + oz;
    const base = swell(x * 0.0025, z * 0.0025) * 10; // broad rises and basins
    // Dune ridges: crests of |noise|, stretched along z so they line up across a wind blowing along x.
    const w = warp(x * 0.004, z * 0.004) * 1.5;
    const n = ridge(x * 0.011 + w, z * 0.005);
    const r = 1 - Math.sqrt(n * n + 0.02); // soft |n|: rounded crests instead of knife edges
    return base + r * r * 9;
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

// Flattest point on a grid within `radius` of (x, z); the start itself is a candidate.
export function findFlatSpot(h: (x: number, z: number) => number, x: number, z: number, radius = 30, step = 5) {
  let best = { x, z };
  let bestSlope = slopeAt(h, x, z);
  for (let dx = -radius; dx <= radius; dx += step) {
    for (let dz = -radius; dz <= radius; dz += step) {
      if (Math.hypot(dx, dz) > radius) continue;
      const s = slopeAt(h, x + dx, z + dz);
      if (s < bestSlope) [best, bestSlope] = [{ x: x + dx, z: z + dz }, s];
    }
  }
  return best;
}
