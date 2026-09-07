import { test, expect } from '@playwright/test';
import { progressionWeights, pickProgression } from '../src/harmony.js';
import { PROGRESSIONS } from '../src/theory.js';
import { TUNE_STATS } from '../src/data/tune-stats.js';

const seeded = seed => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const shareOf = (scale, name) => {
  const weights = progressionWeights (scale);
  const total = weights.reduce ((sum, weight) => sum + weight, 0);
  const at = PROGRESSIONS[scale].findIndex (progression => progression.name === name);
  return weights[at] / total;
};

test ('the measured table has a tonic-led shape in every mode', () => {
  // Chords are semitones above the tonic. Mixing that up with the diatonic
  // index produced a table where the tonic was not even the commonest chord.
  for (const [scale, table] of Object.entries (TUNE_STATS.harmony)) {
    const entries = Object.entries (table).sort ((a, b) => b[1] - a[1]);
    expect (entries[0][0]).toMatch (/^0:/);
    expect (entries[0][1]).toBeGreaterThan (0.25);
  }
  // The flat seventh is the tonic's usual partner in the modal ones.
  expect (TUNE_STATS.harmony.dorian['10:maj']).toBeGreaterThan (0.2);
  expect (TUNE_STATS.harmony.mixolydian['10:maj']).toBeGreaterThan (0.15);
});

test ('the double-tonic shuttle leads, and nothing is ruled out', () => {
  // Real dorian tunes reach for i-VII about a third of the time, but it was
  // one of seven progressions drawn uniformly.
  const shuttle = shareOf ('dorian', 'i-VII vamp');
  const fourth = shareOf ('dorian', 'i-IV vamp');
  expect (shuttle).toBeGreaterThan (1 / PROGRESSIONS.dorian.length);
  expect (shuttle).toBeGreaterThan (fourth * 1.4);

  expect (shareOf ('mixolydian', 'I-VII vamp'))
    .toBeGreaterThan (1 / PROGRESSIONS.mixolydian.length);

  // A table measured from nine per cent of the corpus should bias an ear, not
  // overrule it: every hand-written progression stays reachable.
  for (const scale of Object.keys (PROGRESSIONS)) {
    for (const weight of progressionWeights (scale)) expect (weight).toBeGreaterThan (0);
    expect (progressionWeights (scale)).toHaveLength (PROGRESSIONS[scale].length);
  }
  expect (shareOf ('major', 'IV-V-iii-vi')).toBeGreaterThan (0.02);
});

test ('choosing follows the weights and stays reproducible', () => {
  const counts = {};
  const random = seeded (11);
  for (let i = 0; i < 20000; i++) {
    const { name } = pickProgression ('dorian', random);
    counts[name] = (counts[name] ?? 0) + 1;
  }

  const drawn = counts['i-VII vamp'] / 20000;
  expect (Math.abs (drawn - shareOf ('dorian', 'i-VII vamp'))).toBeLessThan (0.02);
  // Every one still turns up.
  expect (Object.keys (counts)).toHaveLength (PROGRESSIONS.dorian.length);

  // Same seed, same choice — a recipe has to mean one thing.
  expect (pickProgression ('dorian', seeded (5)).name).toBe (pickProgression ('dorian', seeded (5)).name);
});

test ('an excluded progression is avoided, unless that would leave nothing', () => {
  const random = seeded (3);
  for (let i = 0; i < 200; i++) {
    expect (pickProgression ('dorian', random, ['i-VII vamp']).name).not.toBe ('i-VII vamp');
  }
  // Excluding everything must still return a progression rather than nothing.
  const all = PROGRESSIONS.dorian.map (progression => progression.name);
  expect (pickProgression ('dorian', random, all)).toBeTruthy();
  // An unknown mode falls back rather than throwing.
  expect (pickProgression ('lydian', random)).toBeTruthy();
});
