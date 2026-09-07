// How often each progression should come round.
//
// The tables in `theory.js` are hand-written and they sound good; the corpus
// agrees with them, and the taste in them is deliberate. What was wrong was
// not which progressions exist but how often each is played: one was drawn
// uniformly from its mode's list, so `i-VII vamp` — the double-tonic shuttle
// that real dorian tunes reach for a third of the time — turned up one time in
// seven, exactly as often as anything else.
//
// So this weights the existing choices rather than replacing them, the same
// move already made for cadences: the formulas stayed and only their odds
// changed.

import { TUNE_STATS } from './data/tune-stats.js';
import { PROGRESSIONS, SCALES } from './theory.js';

// Nothing is ever ruled out. A floor keeps every hand-written progression
// reachable, because a table measured from nine per cent of the corpus should
// bias an ear, not overrule it.
const FLOOR = 0.12;

const isMinor = quality => quality.startsWith ('min');

/** How common a progression's chords are in its mode.

    The geometric mean, not the arithmetic one. Every progression contains the
    tonic, and the tonic is by far the commonest chord in every mode, so an
    average is dominated by the chord they all share: it scored the double-tonic
    shuttle and the i-IV vamp within a few points of each other when the corpus
    separates their second chords by nearly four to one. A geometric mean is
    also the natural way to combine likelihoods, and being length-normalised it
    does not punish a longer progression for having more chances to include
    something unusual.

    A chord the corpus never shows is floored rather than zeroed, so one unusual
    chord makes a progression rarer instead of unreachable. */
function commonness (progression, scale) {
  const steps = SCALES[scale] ?? SCALES.minor;
  const table = TUNE_STATS.harmony?.[scale];
  if (! table) return 1;

  let logTotal = 0;
  for (const [degree, quality] of progression.chords) {
    const semitone = steps[degree % steps.length];
    const share = table[`${semitone}:${isMinor (quality) ? 'min' : 'maj'}`] ?? 0;
    logTotal += Math.log (Math.max (share, 0.004));
  }
  return Math.exp (logTotal / progression.chords.length);
}

/** Weights for a mode's progressions, in the table's own order.

    Scaled against the commonest progression in that mode rather than against
    an absolute, so a mode whose chords are all individually rare is not
    quietly flattened towards the floor. */
export function progressionWeights (scale) {
  const set = PROGRESSIONS[scale] ?? PROGRESSIONS.minor;
  const scores = set.map (progression => commonness (progression, scale));
  const best = Math.max (...scores, 0);
  if (! (best > 0)) return set.map (() => 1);
  return scores.map (score => FLOOR + (1 - FLOOR) * (score / best));
}

/** One progression, chosen by those weights. `random` is passed in so this
    stays as reproducible as everything else a recipe describes. */
export function pickProgression (scale, random = Math.random, exclude = []) {
  const set = PROGRESSIONS[scale] ?? PROGRESSIONS.minor;
  const weights = progressionWeights (scale);

  const allowed = set
    .map ((progression, i) => ({ progression, weight: weights[i] }))
    .filter (entry => ! exclude.includes (entry.progression.name));
  const pool = allowed.length ? allowed : set.map ((progression, i) => ({ progression, weight: weights[i] }));

  const total = pool.reduce ((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.progression;
  }
  return pool[pool.length - 1].progression;
}
