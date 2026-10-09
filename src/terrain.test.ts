import { describe, expect, test } from 'vitest';
import { CHUNK_CELLS, chunkHeights } from './chunks';
import { createHeight, regionWeights } from './terrain';

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

  test('smooth region weights sum to one and each region dominates somewhere', () => {
    const weights = regionWeights('dune');
    const same = regionWeights('dune');
    const maxima = [0, 0, 0];
    let maxChange = 0;
    let maxSumError = 0;
    let minWeight = 1;
    let deterministic = true;
    for (let x = -2000; x <= 2000; x += 40) {
      for (let z = -2000; z <= 2000; z += 40) {
        const w = weights(x, z);
        const repeated = same(x, z);
        maxSumError = Math.max(maxSumError, Math.abs(w.reduce((sum, value) => sum + value, 0) - 1));
        const nearby = weights(x + 2, z + 2);
        w.forEach((value, i) => {
          deterministic &&= value === repeated[i];
          minWeight = Math.min(minWeight, value);
          maxChange = Math.max(maxChange, Math.abs(value - nearby[i]));
          maxima[i] = Math.max(maxima[i], value);
        });
      }
    }
    expect(deterministic).toBe(true);
    expect(maxSumError).toBeLessThan(1e-12);
    expect(minWeight).toBeGreaterThanOrEqual(0);
    expect(maxChange).toBeLessThan(0.03);
    for (const maximum of maxima) {
      expect(maximum).toBeGreaterThan(0.9);
      expect(maximum).toBeLessThanOrEqual(1);
    }
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
