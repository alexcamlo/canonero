import { describe, expect, test } from 'vitest';
import { CHUNK_CELLS, chunkHeights } from './chunks';
import { createHeight, createSurface, findFlatSpot, regionWeights } from './terrain';

const samples = [
  [0, 0],
  [12.5, -40],
  [-300, 777],
  [5000, 5000],
];

describe('createSurface', () => {
  test('surface is reproducible per seed and changes with the seed', () => {
    const a = createSurface('dune');
    const b = createSurface('dune');
    const c = createSurface('erg');
    let differences = 0;
    for (let x = -800; x <= 800; x += 20) {
      for (let z = -800; z <= 800; z += 20) {
        expect(a(x, z)).toBe(b(x, z));
        if (a(x, z) !== c(x, z)) differences++;
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  test('seeded riverbeds cross every region and leave ordinary sand between them', () => {
    const surface = createSurface('dune');
    const weights = regionWeights('dune');
    const regions = [false, false, false];
    let sand = 0;
    for (let x = -2000; x <= 2000; x += 20) {
      for (let z = -2000; z <= 2000; z += 20) {
        if (surface(x, z) === 'sand') sand++;
        else weights(x, z).forEach((w, i) => { if (w > 0.9) regions[i] = true; });
      }
    }
    expect(regions).toEqual([true, true, true]);
    expect(sand).toBeGreaterThan(30000);
  });
});

describe('createHeight', () => {
  test('riverbed centres have a gentle slope along the channel', () => {
    const height = createHeight('dune');
    const surface = createSurface('dune');
    const centre = (x: number, z: number) => {
      let left = x;
      let right = x;
      while (x - left < 60 && surface(left - 0.5, z) === 'soft') left -= 0.5;
      while (right - x < 60 && surface(right + 0.5, z) === 'soft') right += 0.5;
      if (right - left > 60) return NaN;
      return (left + right) / 2;
    };
    let channels = 0;
    let flat = 0;
    for (let z = -1000; z <= 1000; z += 80) {
      for (let x = -1000; x <= 1000; x += 20) {
        if (surface(x, z) !== 'soft') continue;
        const cx = centre(x, z);
        if (!Number.isFinite(cx)) continue;
        if (surface(cx, z - 1) !== 'soft' || surface(cx, z + 1) !== 'soft') continue;
        const before = centre(cx, z - 1);
        const after = centre(cx, z + 1);
        if (!Number.isFinite(before) || !Number.isFinite(after)) continue;
        const slope = Math.abs(height(after, z + 1) - height(before, z - 1)) / Math.hypot(after - before, 2);
        if (slope < 0.03) flat++;
        channels++;
      }
    }
    expect(channels).toBeGreaterThan(20);
    // Near tangencies, the midpoint of a soft band can still lie on a bank.
    expect(flat / channels).toBeGreaterThan(0.95);
  });

  test('star regions have challenging slip faces at the 2 m grid spacing', () => {
    const height = createHeight('dune');
    const weights = regionWeights('dune');
    let maxSlope = 0;
    let maxHeight = -Infinity;
    for (let x = -1200; x <= 1200; x += 8) {
      for (let z = -1200; z <= 1200; z += 8) {
        if (weights(x, z)[2] < 0.9) continue;
        const h = height(x, z);
        maxHeight = Math.max(maxHeight, h);
        const slope = Math.hypot((height(x + 2, z) - h) / 2, (height(x, z + 2) - h) / 2);
        maxSlope = Math.max(maxSlope, slope);
      }
    }
    expect(maxSlope).toBeGreaterThan(0.6);
    expect(maxHeight).toBeGreaterThan(20);
  });

  test('region weights sum to one, blend smoothly, and each region dominates somewhere', () => {
    const weights = regionWeights('dune');
    const maxima = [0, 0, 0];
    for (let x = -2000; x <= 2000; x += 80) {
      for (let z = -2000; z <= 2000; z += 80) {
        const w = weights(x, z);
        const nearby = weights(x + 2, z + 2);
        expect(w[0] + w[1] + w[2]).toBeCloseTo(1);
        w.forEach((v, i) => {
          expect(Math.abs(v - nearby[i])).toBeLessThan(0.03);
          maxima[i] = Math.max(maxima[i], v);
        });
      }
    }
    for (const m of maxima) expect(m).toBeGreaterThan(0.9);
  });

  test('same seed gives the same desert', () => {
    const a = createHeight('dune');
    const b = createHeight('dune');
    for (const [x, z] of samples) expect(a(x, z)).toBe(b(x, z));
  });

  test('different seeds give different deserts', () => {
    const a = createHeight('dune');
    const b = createHeight('erg');
    for (const [x, z] of samples) expect(a(x, z)).not.toBe(b(x, z));
  });
});

describe('chunkHeights', () => {
  const N = CHUNK_CELLS + 1; // samples per side
  // Rapier heightfield layout: column-major, consecutive values walk along z.
  const at = (h: Float32Array, xi: number, zi: number) => h[zi + xi * N];
  const height = createHeight('dune');

  test('a chunk edge matches its east neighbour', () => {
    const a = chunkHeights(height, -3, 2);
    const b = chunkHeights(height, -2, 2);
    for (let i = 0; i < N; i++) expect(at(a, N - 1, i)).toBe(at(b, 0, i));
  });

  test('a chunk edge matches its south neighbour', () => {
    const a = chunkHeights(height, 4, -1);
    const b = chunkHeights(height, 4, 0);
    for (let i = 0; i < N; i++) expect(at(a, i, N - 1)).toBe(at(b, i, 0));
  });
});

describe('findFlatSpot', () => {
  test('stays within radius and is no steeper than the start', () => {
    const h = createHeight('dune');
    const slope = (x: number, z: number) => Math.hypot(h(x + 1, z) - h(x - 1, z), h(x, z + 1) - h(x, z - 1)) / 2;
    for (const [x, z] of samples) {
      const p = findFlatSpot(h, x, z, 30);
      expect(Math.hypot(p.x - x, p.z - z)).toBeLessThanOrEqual(30);
      expect(slope(p.x, p.z)).toBeLessThanOrEqual(slope(x, z));
    }
  });
});
