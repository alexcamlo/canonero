import { describe, expect, test } from 'vitest';
import { CHUNK_CELLS, chunkHeights } from './chunks';
import { createHeight } from './terrain';

const samples = [
  [0, 0],
  [12.5, -40],
  [-300, 777],
  [5000, 5000],
];

describe('createHeight', () => {
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
