// Melody generation with a Celtic/folk grammar.
//
// The important idea here is the phrase. Rolling fresh random notes every bar
// produces noodling, not a tune — what makes a melody sound like a melody is
// hearing the same shape come back. So this builds four-bar phrases and plays
// them in an AABB form, varying the repeats rather than replacing them.
//
// The folk character comes from four things:
//
//   * gapped (pentatonic/hexatonic) note pools rather than the full scale,
//     which is what most Irish and Scottish tunes actually draw on
//   * stepwise motion with occasional fourth and fifth leaps, never random jumps
//   * an arched contour — rise to a peak, then fall back to rest
//   * cuts: fast grace notes above the main note, the signature ornament

/** Degree offsets kept from the parent scale. Dropping degrees is what turns a
    seven-note scale into something that sounds like a folk tune. */
const GAPPED = {
  // Drop the 4th and 7th: the classic major pentatonic.
  major:      [0, 1, 2, 4, 5],
  // Minor pentatonic, the other half of the tradition.
  minor:      [0, 2, 3, 4, 6],
  // Dorian keeps its 6th — that raised 6th over a minor third is the sound of
  // a great many Irish tunes, so it would be a shame to gap it out.
  dorian:     [0, 1, 2, 3, 4, 5, 6],
  // Mixolydian keeps the flat 7th for the same reason.
  mixolydian: [0, 1, 2, 3, 4, 6]
};

// Rhythms over an eight-step (eighth note) bar, as lengths in eighths. The
// dotted groupings are the lilt; straight runs give it somewhere to go.
const RHYTHMS = [
  [3, 1, 2, 2],
  [2, 2, 3, 1],
  [3, 1, 3, 1],
  [2, 1, 1, 2, 2],
  [4, 2, 2],
  [3, 3, 2],
  [2, 2, 2, 2],
  [6, 2],
  [1, 1, 2, 4]
];

const pick = arr => arr[Math.floor (Math.random() * arr.length)];
const chance = p => Math.random() < p;

/** Weighted melodic interval in scale steps. Folk melody is overwhelmingly
    stepwise; leaps happen, but they are events, not the default. */
function nextInterval () {
  const roll = Math.random();

  if (roll < 0.46) return chance (0.5) ? 1 : -1;      // step
  if (roll < 0.66) return 0;                          // repeat the note
  if (roll < 0.82) return chance (0.5) ? 2 : -2;      // third
  if (roll < 0.94) return chance (0.55) ? 3 : -3;     // fourth
  return chance (0.5) ? 4 : -4;                       // fifth
}

/** Builds one four-bar phrase as note events with positions in eighths from
    the phrase start. Degrees are indices into the gapped pool, so the phrase
    transposes to any key or mode for free. */
export function createPhrase (scale, poolSize) {
  const events = [];
  const bars = 4;

  // The arch: where in the phrase the melody peaks.
  const peakBar = 1 + Math.floor (Math.random() * 2);

  let degree = Math.floor (poolSize * 0.4);

  for (let bar = 0; bar < bars; bar++) {
    // The last bar is the cadence — thinner, and it comes to rest.
    const isCadence = bar === bars - 1;
    const rhythm = isCadence ? pick ([[4, 4], [6, 2], [8]]) : pick (RHYTHMS);

    // Pull the line up toward the peak bar, then let it fall away.
    const target = bar < peakBar
      ? poolSize - 1
      : Math.max (0, Math.round (poolSize * (1 - (bar - peakBar) / bars)));

    let position = 0;

    for (const length of rhythm) {
      // Bias each move toward the bar's target, so the contour arches instead
      // of wandering.
      const interval = nextInterval();
      const pull = Math.sign (target - degree);
      degree += chance (0.55) ? interval : Math.abs (interval) * pull;
      degree = Math.max (0, Math.min (poolSize + 2, degree));

      events.push ({
        at: bar * 8 + position,
        length,
        degree,
        // Cuts land on longer notes, the way a player would ornament them.
        ornament: length >= 2 && chance (0.28)
      });

      position += length;
    }
  }

  // Come to rest on the tonic, which is what makes a phrase sound finished.
  events[events.length - 1].degree = 0;
  events[events.length - 1].ornament = false;

  return events;
}

/** A varied copy of a phrase, for the repeat in each AABB pair. Same skeleton,
    different detail — which is exactly how a player repeats a tune. */
export function varyPhrase (phrase, amount = 0.3) {
  return phrase.map ((event, index) => {
    const last = index === phrase.length - 1;

    // Never move the final note: the cadence is what holds the form together.
    if (last || ! chance (amount)) {
      return { ...event, ornament: event.ornament || (! last && chance (0.12)) };
    }

    return {
      ...event,
      degree: Math.max (0, event.degree + (chance (0.5) ? 1 : -1)),
      ornament: chance (0.35)
    };
  });
}

/** The note pool for a mode: gapped degrees across two octaves, as scale
    degree numbers ready for scaleDegreeToMidi. */
export function gappedPool (scale) {
  const offsets = GAPPED[scale] ?? GAPPED.minor;
  const pool = [];

  for (let octave = 0; octave < 2; octave++) {
    for (const offset of offsets) pool.push (offset + octave * 7);
  }

  return pool;
}
