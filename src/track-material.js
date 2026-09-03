import { createMotif } from './melody.js';

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
export function createTrackMaterialPicker ({ storage, generateMotif = createMotif } = {}) {
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

  return function nextMaterial () {
    let best;
    let bestCost = Infinity;
    // A fixed budget keeps skips responsive, even with pathological random
    // input. If all candidates are familiar, use the least repetitive valid
    // one rather than weakening the melody rules or retrying forever.
    for (let attempt = 0; attempt < 64; attempt++) {
      const motifA = generateMotif();
      const motifB = generateMotif();
      const a = describe (motifA);
      const b = describe (motifB);
      const record = { motifs: [a.exact, b.exact], shapes: [a.shape, b.shape], rhythms: [a.rhythm, b.rhythm] };
      const cost = repetitionCost (record);
      if (cost < bestCost) {
        best = { motifA, motifB, record };
        bestCost = cost;
      }
      if (cost === 0) break;
    }
    history.push (best.record);
    history = history.slice (-HISTORY_LIMIT);
    try { storage?.setItem (HISTORY_KEY, JSON.stringify (history)); } catch {}
    return { motifA: best.motifA, motifB: best.motifB };
  };
}
