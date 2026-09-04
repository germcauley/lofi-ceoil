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

test ('a motif means the same thing in every mode', () => {
  // renderCell places a motif at round (poolSize * 0.35) and clamps to
  // poolSize + 2, and the gapped pool is 10 notes in major but 14 in dorian.
  // An offset that clamps in one mode and not another makes the same motif
  // render two different ways, so a track that changed key stopped being the
  // tune it was — and the wider intervals measured from real jigs reach those
  // bounds where the old hand-tuned ones never did.
  const generator = createMelodyGenerator (seeded (99), '6/8');
  for (let i = 0; i < 500; i++) {
    for (const offset of generator.createMotif().offsets) {
      expect (offset).toBeGreaterThanOrEqual (-4);
      expect (offset).toBeLessThanOrEqual (8);
    }
  }

  // The hook — bar zero, the part a track returns to — must keep its shape in
  // every mode. Cadences are deliberately not included: renderCadence takes
  // the pool size because a cadence targets the tonic of the actual scale,
  // so it is allowed to differ between a ten-note and a fourteen-note pool.
  for (const seed of [5, 17, 42]) {
    const motif = createMelodyGenerator (seeded (seed), '6/8').createMotif();
    const hookIn = scale => {
      const melody = createMelodyGenerator (seeded (31), '6/8');
      const hook = melody.developPhrase (scale, melody.gappedPool (scale).length, motif)
        .filter (event => event.at < 8);
      return hook.map (event => event.degree - hook[0].degree);
    };

    const major = hookIn ('major');
    expect (major.length).toBeGreaterThan (2);
    for (const scale of ['minor', 'dorian', 'mixolydian']) expect (hookIn (scale)).toEqual (major);
  }
});

test ('a leap is answered rather than piled on', () => {
  // Drawing every interval independently gets the vocabulary right and the
  // sentences wrong. Real tunes fill a gap: after a fall of a fifth the corpus
  // almost stops descending — a further step down goes from 16% to 1% — and
  // either repeats the note or turns back up. The generator has to do the same.
  const generator = createMelodyGenerator (seeded (7), '6/8');
  const after = {};
  let pairs = 0;

  for (let i = 0; i < 40000; i++) {
    const { offsets } = generator.createMotif();
    for (let k = 2; k < offsets.length; k++) {
      const previous = offsets[k - 1] - offsets[k - 2];
      const step = offsets[k] - offsets[k - 1];
      ((after[previous] ??= {})[step] ??= 0);
      after[previous][step]++;
      pairs++;
    }
  }
  expect (pairs).toBeGreaterThan (10000);

  const share = (previous, steps) => {
    const row = after[previous] ?? {};
    const total = Object.values (row).reduce ((sum, n) => sum + n, 0);
    return steps.reduce ((sum, step) => sum + (row[step] ?? 0), 0) / total;
  };

  // After a big fall, the tune turns back up far more often than it keeps
  // falling; after a big rise, the reverse.
  expect (share (-4, [1, 2, 3])).toBeGreaterThan (share (-4, [-1, -2, -3]) * 3);
  expect (share (4, [-1, -2, -3])).toBeGreaterThan (share (4, [1, 2, 3]));

  // The transition rows must actually be reached — a typo in the key would
  // silently fall back to the marginal table and still look plausible.
  expect (share (-4, [-1, -2])).toBeLessThan (0.1);
});

test ('parts come to rest where real tunes come to rest', () => {
  const generator = createMelodyGenerator (seeded (3), '6/8');
  const endings = {};
  let total = 0;

  for (let i = 0; i < 1500; i++) {
    for (const scale of ['major', 'minor', 'dorian', 'mixolydian']) {
      const phrase = generator.createPhrase (scale, generator.gappedPool (scale).length);
      for (const bar of [3, 7]) {
        const inBar = phrase.filter (event => Math.floor (event.at / 8) === bar);
        const last = inBar.at (-1);
        if (last?.scaleDegree === undefined) continue;
        endings[last.scaleDegree] = (endings[last.scaleDegree] ?? 0) + 1;
        total++;
      }
    }
  }

  const share = degree => (endings[degree] ?? 0) / total;

  // The fourth and the seventh are missing from the gapped pool in major, so
  // before cadences carried the note they meant these were unreachable — while
  // about a fifth of real part endings land on them.
  expect (share (3)).toBeGreaterThan (0.04);
  expect (share (6)).toBeGreaterThan (0.03);

  // A cadence still resolves far more often than it does anything else.
  expect (share (0)).toBeGreaterThan (0.3);
  expect (share (0)).toBeGreaterThan (share (4));

  // Weighted by the corpus rather than picked uniformly over the formulas.
  const corpus = TUNE_STATS.types.jig.cadences;
  for (const degree of [1, 3, 4, 6]) {
    expect (Math.abs (share (degree) - corpus[degree])).toBeLessThan (0.06);
  }
});

test ('a cadence keeps its note through playback', () => {
  // The gapped pool cannot express every cadence target, so cadence events
  // carry the degree they mean; a plain index would silently move the note.
  const generator = createMelodyGenerator (seeded (11), '6/8');
  // Many phrases, not one: a single phrase makes this depend on where the
  // seed happens to land, and any change upstream in the random stream then
  // breaks a test that is not about the thing that changed.
  const cadences = Array.from ({ length: 300 }, () =>
    generator.createPhrase ('major', generator.gappedPool ('major').length))
    .flat().filter (event => event.cadence);
  expect (cadences.length).toBeGreaterThan (0);
  for (const event of cadences) {
    expect (typeof event.scaleDegree).toBe ('number');
    expect (event.scaleDegree).toBeGreaterThanOrEqual (0);
    expect (event.scaleDegree).toBeLessThanOrEqual (6);
  }
  // At least one lands somewhere major's pool has no seat for.
  const pool = new Set (generator.gappedPool ('major'));
  expect (cadences.some (event => ! pool.has (event.scaleDegree))).toBe (true);
});
