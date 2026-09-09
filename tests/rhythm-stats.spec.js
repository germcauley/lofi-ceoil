import { test, expect } from '@playwright/test';
import { TUNE_STATS } from '../src/data/tune-stats.js';

const TYPES = ['jig', 'reel', 'polka', 'hornpipe', 'waltz', 'slip jig'];

// What a bar of each meter is worth in quavers — the same table the derivation
// used, restated so a change there has to be a deliberate change here too.
const BAR = { jig: 6, reel: 8, polka: 4, hornpipe: 8, waltz: 6, 'slip jig': 9 };

test ('every tune type carries a rhythm measured from its own bars', () => {
  for (const type of TYPES) {
    const rhythm = TUNE_STATS.types[type]?.rhythm;
    expect (rhythm, type).toBeTruthy();
    expect (rhythm.bars, type).toBeGreaterThan (20000);

    // Every kept rhythm fills a bar of that meter exactly. This is the whole
    // derivation in one assertion: lengths read from the notation, scaled by a
    // bar length worked out from the bars themselves, have to add up.
    for (const [pattern] of rhythm.commonest) {
      const total = pattern.reduce ((sum, length) => sum + length, 0);
      expect (Number (total.toFixed (3)), `${type}: ${pattern.join (' ')}`).toBe (BAR[type]);
    }

    // Proportions, not counts, and the kept ones cover most of the repertoire.
    const covered = rhythm.commonest.reduce ((sum, [, share]) => sum + share, 0);
    expect (covered, type).toBeGreaterThan (0.75);
    expect (covered, type).toBeLessThanOrEqual (1);
  }
});

/** The finding, held as a test so it cannot quietly stop being true.

    A session tune is mostly running quavers: half of all jig bars are six
    notes of identical length, and the average note across the repertoire is
    about one quaver. The generator's own cells average two quavers and three
    and a half notes to the bar. That gap is the reason these tables do not
    replace the generator's rhythms — weighting its cells by what the corpus
    plays would make the melody faster and more even, which is busier and more
    monotonous at once. */
test ('the corpus plays about twice as many notes as this generator does', () => {
  const meanLength = type => {
    const lengths = Object.entries (TUNE_STATS.types[type].rhythm.lengths);
    const total = lengths.reduce ((sum, [, share]) => sum + share, 0);
    return lengths.reduce ((sum, [length, share]) => sum + Number (length) * share, 0) / total;
  };

  // Around one quaver a note, everywhere except the waltz.
  for (const type of ['jig', 'reel', 'polka', 'hornpipe', 'slip jig']) {
    expect (meanLength (type), type).toBeLessThan (1.35);
  }
  // The waltz is the outlier, and it is the one whose rhythm the generator's
  // cells already resemble.
  expect (meanLength ('waltz')).toBeGreaterThan (1.4);

  // Half of all jig bars are one length repeated.
  expect (TUNE_STATS.types.jig.rhythm.even).toBeGreaterThan (0.45);
  // The slip jig is the least even of them, which is worth knowing before
  // anyone generates one natively.
  expect (TUNE_STATS.types['slip jig'].rhythm.even)
    .toBeLessThan (TUNE_STATS.types.jig.rhythm.even);
});

test ('what follows what is a distribution, and rare rows are dropped', () => {
  for (const type of TYPES) {
    const steps = TUNE_STATS.types[type].rhythm.steps;
    expect (Object.keys (steps).length, type).toBeGreaterThan (1);
    for (const [from, row] of Object.entries (steps)) {
      const total = Object.values (row).reduce ((sum, share) => sum + share, 0);
      expect (total, `${type} ${from}`).toBeGreaterThan (0.9);
      expect (total, `${type} ${from}`).toBeLessThanOrEqual (1.001);
    }
    // A quaver follows a quaver more often than anything else follows it,
    // which is the running line the whole tradition is built on.
    const afterOne = steps['1'];
    const commonest = Object.entries (afterOne).sort ((a, b) => b[1] - a[1])[0];
    expect (commonest[0], type).toBe ('1');
  }
});
