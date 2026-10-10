import { describe, expect, test } from 'vitest';
import { CHUNK_CELLS, chunkHeights } from './chunks';
import { createGroundColor, createHeight, createSurface, findFlatSpot, regionWeights } from './terrain';

const samples = [
  [0, 0],
  [12.5, -40],
  [-300, 777],
  [5000, 5000],
];

describe('createHeight', () => {
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
  test('stays within radius, on firm sand, and is no steeper than a firm start', () => {
    const h = createHeight('dune');
    const surface = createSurface('dune');
    const slope = (x: number, z: number) => Math.hypot(h(x + 1, z) - h(x - 1, z), h(x, z + 1) - h(x, z - 1)) / 2;
    for (const [x, z] of samples) {
      const p = findFlatSpot(h, surface, x, z, 30);
      expect(Math.hypot(p.x - x, p.z - z)).toBeLessThanOrEqual(30);
      expect(surface(p.x, p.z)).toBe('sand');
      if (surface(x, z) === 'sand') expect(slope(p.x, p.z)).toBeLessThanOrEqual(slope(x, z));
    }
  });
});

describe('createGroundColor', () => {
  test('is deterministic', () => {
    expect(createGroundColor('dune')(10, 20)).toEqual(createGroundColor('dune')(10, 20));
  });
});
