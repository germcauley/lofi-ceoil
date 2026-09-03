import { test, expect } from '@playwright/test';
import { createMelodyGenerator } from '../src/melody.js';
import { TUNE_STATS } from '../src/data/tune-stats.js';

const seeded = seed => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

/** Intervals actually produced by a generator's motifs. */
function measure (meter, draws = 30000) {
  const generator = createMelodyGenerator (seeded (12345), meter);
  const counts = {};
  let total = 0;
  for (let i = 0; i < draws; i++) {
    const { offsets } = generator.createMotif();
    for (let k = 1; k < offsets.length; k++) {
      const step = offsets[k] - offsets[k - 1];
      counts[step] = (counts[step] ?? 0) + 1;
      total++;
    }
  }
  return { share: step => (counts[step] ?? 0) / total, counts };
}

test ('the melodic grammar follows the repertoire it was measured from', () => {
  const jig = measure ('6/8');
  const corpus = TUNE_STATS.types.jig.intervals;

  // Steps and thirds are most of all melodic movement, and are what the
  // generator has to get right. Repeated notes are deliberately rarer than
  // the corpus: createMotif rejects inert cells, which filters them out.
  for (const step of ['1', '-1', '2', '-2', '3', '-3']) {
    expect (Math.abs (jig.share (Number (step)) - corpus[step])).toBeLessThan (0.04);
  }

  // Real tunes fall more than they rise, and the old hand-tuned grammar
  // treated every interval as a coin flip on direction.
  expect (jig.share (-1)).toBeGreaterThan (jig.share (1));
  expect (jig.share (-2)).toBeGreaterThan (jig.share (2));

  // Nothing wider than a fifth used to be reachable at all.
  const wide = [4, -4, 5, -5, 6, -6, 7, -7].reduce ((sum, step) => sum + jig.share (step), 0);
  expect (wide).toBeGreaterThan (0.01);
});

test ('the meter chooses which repertoire the melody is drawn from', () => {
  // A jig and a reel move differently; 6/8 must not be generated as a reel.
  const jig = measure ('6/8', 12000), reel = measure ('4/4', 12000);
  expect (jig.share (-1) - jig.share (1)).toBeGreaterThan (reel.share (-1) - reel.share (1));

  // An unknown meter still produces a usable tune rather than nothing.
  const odd = measure ('7/8', 2000);
  expect (Object.keys (odd.counts).length).toBeGreaterThan (3);
});

test ('the derived table carries distributions and no corpus material', () => {
  const text = JSON.stringify (TUNE_STATS);
  expect (TUNE_STATS.source).toContain ('ODbL');
  // Every value under a type is a number or a count; nothing holds notation.
  for (const bucket of Object.values (TUNE_STATS.types)) {
    expect (bucket.settings).toBeGreaterThan (0);
    for (const weight of Object.values (bucket.intervals)) {
      expect (typeof weight).toBe ('number');
    }
    const total = Object.values (bucket.intervals).reduce ((sum, n) => sum + n, 0);
    expect (Math.abs (total - 1)).toBeLessThan (0.01);
  }
  expect (text).not.toMatch (/abc|[A-G][,']?\d\|/);
});
