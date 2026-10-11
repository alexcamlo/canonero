import { expect, test } from 'vitest';
import { nextTrackIndex } from './radio';

test('radio advances through the playlist and wraps to the first track', () => {
  expect(nextTrackIndex(0)).toBe(1);
  expect(nextTrackIndex(1)).toBe(2);
  expect(nextTrackIndex(5)).toBe(0);
});
