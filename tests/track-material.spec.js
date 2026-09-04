import { test, expect } from '@playwright/test';
import { createMotif } from '../src/melody.js';
import { createTrackMaterialPicker } from '../src/track-material.js';

const a = { start: 0, rhythm: [3, 1, 2, 2], offsets: [0, 1, 3, 2] };
const b = { start: 2, rhythm: [2, 2, 2], offsets: [0, -1, -3] };
const c = { start: 0, rhythm: [1, 1, 2, 4], offsets: [0, -2, -1, 1] };
const d = { start: 1, rhythm: [1, 2, 2, 2], offsets: [0, 2, 1, 3] };
const transpose = motif => ({ ...motif, offsets: motif.offsets.map (pitch => pitch + 4) });

function memoryStorage () {
  const values = new Map();
  return { getItem: key => values.get (key), setItem: (key, value) => values.set (key, value) };
}

function sequence (...motifs) {
  let index = 0;
  return () => motifs[index++ % motifs.length];
}

// The picker also reports the seed its winner came from, so a track can be
// written down as a link. These tests are about which motifs it chooses.
const motifsOf = ({ motifA, motifB }) => ({ motifA, motifB });

test ('recent material survives reload and recognises swapped, transposed motifs', () => {
  const storage = memoryStorage();
  createTrackMaterialPicker ({ storage, generateMotif: sequence (a, b) })();
  const next = createTrackMaterialPicker ({ storage, generateMotif: sequence (transpose (b), transpose (a), c, d) });
  expect (motifsOf (next())).toEqual ({ motifA: c, motifB: d });
});

test ('similar contours with identical rhythms are not treated as fresh ideas', () => {
  const next = createTrackMaterialPicker ({ storage: null, generateMotif: sequence (
    a, b,
    { ...a, offsets: [0, 2, 3, 1] }, { ...b, offsets: [0, -2, -3] },
    c, d
  ) });
  expect (motifsOf (next())).toEqual ({ motifA: a, motifB: b });
  expect (motifsOf (next())).toEqual ({ motifA: c, motifB: d });
});

test ('generation remains bounded when randomness or storage is unhelpful', () => {
  let calls = 0;
  const storage = { getItem () { throw new Error ('unavailable'); }, setItem () { throw new Error ('full'); } };
  const next = createTrackMaterialPicker ({ storage, generateMotif: () => { calls++; return a; } });
  expect (motifsOf (next())).toEqual ({ motifA: a, motifB: a });
  expect (calls).toBe (128);
});

test ('a long generated set avoids recent openings and repeated motif pairs', () => {
  let seed = 12893;
  const originalRandom = Math.random;
  Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  try {
    const next = createTrackMaterialPicker ({ storage: null, generateMotif: createMotif });
    const recent = [];
    for (let i = 0; i < 1000; i++) {
      const track = next();
      const motifs = [track.motifA, track.motifB].map (motif => JSON.stringify (
        [motif.start, motif.rhythm, motif.offsets.map (pitch => pitch - motif.offsets[0])]
      ));
      const pair = [...motifs].sort().join ('|');
      expect (recent.slice (-128).some (old => old.pair === pair)).toBe (false);
      expect (recent.slice (-8).some (old => old.motifs.includes (motifs[0]))).toBe (false);
      recent.push ({ pair, motifs });
    }
  } finally { Math.random = originalRandom; }
});
