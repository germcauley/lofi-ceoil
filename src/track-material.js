import { createMelodyGenerator } from './melody.js';
import { seededRandom } from './composition.js';

// A motif from a given generator, so a seed can produce one on demand.
const motifFrom = random => createMelodyGenerator (random).createMotif();

const HISTORY_KEY = 'lofi-ceoil.recent-material.v1';
const HISTORY_LIMIT = 128;

function describe (motif) {
  const pitches = motif.offsets.map (value => value - motif.offsets[0]);
  const contour = pitches.slice (1).map ((value, i) => Math.sign (value - pitches[i]));
  const rhythm = JSON.stringify ([motif.start, motif.rhythm]);
  return {
    exact: JSON.stringify ([rhythm, pitches]),
    shape: JSON.stringify ([rhythm, contour]),
    rhythm
  };
}

function samePair (a, b) {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

function validRecord (record) {
  return record && ['motifs', 'shapes', 'rhythms'].every (key =>
    Array.isArray (record[key]) && record[key].length === 2
      && record[key].every (value => typeof value === 'string' && value.length < 256));
}

/** Choose new musical material before the engine develops it into phrases.
    Keys, instruments, titles and tiny knob differences do not count towards
    novelty: a transposed or revoiced tune is still the same melodic idea. */
export function createTrackMaterialPicker ({ storage, generateMotif = motifFrom } = {}) {
  let history = [];
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    const saved = JSON.parse (storage?.getItem (HISTORY_KEY) ?? '[]');
    if (Array.isArray (saved)) history = saved.filter (validRecord).slice (-HISTORY_LIMIT);
  } catch {
    // Playback still works when storage is unavailable or old data is damaged.
  }

  function repetitionCost (candidate) {
    let cost = candidate.shapes[0] === candidate.shapes[1] ? 20 : 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const age = history.length - 1 - i;
      const previous = history[i];
      // Swapping A and B or changing key cannot pass as a new tune.
      if (samePair (candidate.motifs, previous.motifs)) cost += 1000;
      // The same rises/falls and durations can sound alike even with different
      // interval sizes. Keep those pairs further apart too.
      if (age < 32 && samePair (candidate.shapes, previous.shapes)) cost += 100;
      if (age < 8 && previous.motifs.includes (candidate.motifs[0])) cost += 20;
      if (age < 4 && samePair (candidate.rhythms, previous.rhythms)) cost += 5;
    }
    return cost;
  }

  /** Motifs for a new track.

      The search is over *seeds* rather than over motifs. Both produce the same
      thing, but recording which seed won makes a track's material reproducible
      from one number — and a tune that cannot be regenerated from a number
      cannot be given a link. History-avoidance is unaffected: the candidates
      are still scored against what has been heard recently, and the least
      repetitive one still wins.

      `materialSeed` replays a known winner and skips the search entirely,
      which is what opening a shared tune does. */
  return function nextMaterial ({ seed = (Math.random() * 4294967296) >>> 0, materialSeed } = {}) {
    if (materialSeed !== undefined) {
      const random = seededRandom (materialSeed);
      return { motifA: generateMotif (random), motifB: generateMotif (random), materialSeed };
    }

    let best;
    let bestCost = Infinity;
    // A fixed budget keeps skips responsive, even with pathological random
    // input. If all candidates are familiar, use the least repetitive valid
    // one rather than weakening the melody rules or retrying forever.
    for (let attempt = 0; attempt < 64; attempt++) {
      // Each attempt is its own seed, derived from the track's, so the winner
      // is a number we can write down.
      const candidateSeed = (seed + Math.imul (attempt, 0x9E3779B1)) >>> 0;
      const random = seededRandom (candidateSeed);
      const motifA = generateMotif (random);
      const motifB = generateMotif (random);
      const a = describe (motifA);
      const b = describe (motifB);
      const record = { motifs: [a.exact, b.exact], shapes: [a.shape, b.shape], rhythms: [a.rhythm, b.rhythm] };
      const cost = repetitionCost (record);
      if (cost < bestCost) {
        best = { motifA, motifB, record, materialSeed: candidateSeed };
        bestCost = cost;
      }
      if (cost === 0) break;
    }
    history.push (best.record);
    history = history.slice (-HISTORY_LIMIT);
    try { storage?.setItem (HISTORY_KEY, JSON.stringify (history)); } catch {}
    return { motifA: best.motifA, motifB: best.motifB, materialSeed: best.materialSeed };
  };
}
