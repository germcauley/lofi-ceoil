// Melody generation with a Celtic/folk grammar.
//
// The central idea is the motif. An earlier version picked every note by
// weighted interval with a contour nudge, which is a constrained random walk:
// the note you are on is the only influence on the next one. Nothing is ever
// stated, so nothing can be developed, and the result noodles.
//
// Real tunes are built from a short cell restated transformed. So this makes
// one bar of material and derives the rest of the phrase from it by applying
// named operations. The randomness moves from "which note" to "which
// operation" — and every operation yields something coherent, because it is a
// transformation of material already accepted.
//
// The folk character comes from four further things:
//
//   * gapped (pentatonic/hexatonic) note pools rather than the full scale,
//     which is what most Irish and Scottish tunes actually draw on
//   * stepwise motion with occasional fourth and fifth leaps, never random jumps
//   * an arched contour — rise to a peak, then fall back to rest
//   * cuts: fast grace notes above the main note, the signature ornament

/** Degree offsets kept from the parent scale. Dropping degrees is what turns a
    seven-note scale into something that sounds like a folk tune. */
const GAPPED = {
  major:      [0, 1, 2, 4, 5],
  minor:      [0, 2, 3, 4, 6],
  // Dorian keeps its 6th — that raised 6th over a minor third is the sound of
  // a great many Irish tunes, so it would be a shame to gap it out.
  dorian:     [0, 1, 2, 3, 4, 5, 6],
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

// Stock closes. Trad tunes reuse the same handful constantly — that is a
// feature, not a limitation, and it is what makes an ending sound idiomatic
// rather than merely final.
//
//   full  comes to rest on the tonic, ending the sentence
//   half  stops on an unstable degree — the fifth or the second — which is
//         what turns the first two bars into a question
const CADENCE_FORMULAS = {
  full: [[2, 1, 0], [4, 2, 0], [1, 0], [2, 0], [0]],
  half: [[0, 1, 4], [2, 4], [1, 4], [4], [0, 2, 1], [4, 2, 1]]
};

// Rhythms indexed by how many notes the formula needs.
const CADENCE_RHYTHMS = {
  1: [[8]],
  2: [[4, 4], [6, 2], [2, 6]],
  3: [[4, 2, 2], [2, 2, 4], [3, 3, 2]]
};

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

// --------------------------------------------------------------------- motif

/** One bar of material: a rhythm, and the degree offsets of each note relative
    to wherever the motif is placed. Storing offsets rather than absolute
    degrees is what lets the same cell be restated higher or lower for free. */
export function createMotif () {
  // The motif is the seed for the whole tune, so a weak one — two pitches
  // wandering by a step — makes every bar derived from it inert. Worth
  // rejecting and redrawing rather than accepting whatever comes out.
  for (let attempt = 0; attempt < 20; attempt++) {
    const rhythm = pick (RHYTHMS);
    const offsets = [0];

    for (let i = 1; i < rhythm.length; i++) {
      offsets.push (offsets[i - 1] + nextInterval());
    }

    if (isGoodMotif (offsets)) return { rhythm, offsets };
  }

  // Guaranteed-decent fallback: a rising figure that turns back on itself.
  return { rhythm: [3, 1, 2, 2], offsets: [0, 1, 2, 0] };
}

/** A motif has to actually go somewhere. Three distinct pitches and a range
    between a second and a sixth covers almost every folk cell worth having;
    wider than that and the derived bars start leaping. */
function isGoodMotif (offsets) {
  const distinct = new Set (offsets).size;
  const range = Math.max (...offsets) - Math.min (...offsets);

  if (distinct < Math.min (3, offsets.length)) return false;
  if (range < 2 || range > 5) return false;

  return true;
}

/** The development operations. Each returns a new one-bar cell derived from
    the motif, plus how far to move its starting degree. */
const OPERATIONS = {
  /** Say it again. The plainest and most important one. */
  repeat: motif => ({ ...motif, shift: 0 }),

  /** Restate the whole cell a step or third higher or lower. This is the most
      common device in folk melody, and it cannot sound wrong: same shape. */
  sequence: motif => ({ ...motif, shift: pick ([1, 2, -1, -2, 3, -3]) }),

  /** Flip every interval. Familiar contour, new destination. */
  inversion: motif => ({
    rhythm: motif.rhythm,
    offsets: motif.offsets.map (o => -o),
    shift: chance (0.5) ? 0 : 1
  }),

  /** Double the note lengths and keep whatever fits the bar. Same pitches,
      new weight — the tune leans on itself. */
  augmentation: motif => {
    const rhythm = [];
    const offsets = [];
    let total = 0;

    for (let i = 0; i < motif.rhythm.length; i++) {
      const length = motif.rhythm[i] * 2;
      if (total + length > 8) break;

      rhythm.push (length);
      offsets.push (motif.offsets[i]);
      total += length;
    }

    // Pad any remainder with a held final note rather than leaving a gap.
    if (total < 8 && rhythm.length) rhythm[rhythm.length - 1] += 8 - total;

    return rhythm.length ? { rhythm, offsets, shift: 0 } : { ...motif, shift: 0 };
  },

  /** Keep the opening, then go somewhere new. Recognisable, but it moves. */
  truncate: motif => {
    const keep = Math.max (1, Math.floor (motif.rhythm.length / 2));
    const rhythm = motif.rhythm.slice (0, keep);
    const offsets = motif.offsets.slice (0, keep);
    let total = rhythm.reduce ((sum, n) => sum + n, 0);

    // New tail, built from the same interval weighting as the motif itself.
    while (total < 8) {
      const length = Math.min (8 - total, pick ([1, 2, 2, 3]));
      rhythm.push (length);
      offsets.push (offsets[offsets.length - 1] + nextInterval());
      total += length;
    }

    return { rhythm, offsets, shift: 0 };
  }
};

// Bar 2 is nearly always a sequence — statement, then restatement moved. Bar 3
// is where the phrase is allowed to develop further.
const BAR_TWO_OPERATIONS = ['sequence', 'sequence', 'sequence', 'repeat', 'inversion'];
const BAR_THREE_OPERATIONS = ['inversion', 'augmentation', 'truncate', 'sequence', 'truncate'];

// ------------------------------------------------------------------- phrases

/** Renders one derived cell into note events at a bar position. */
function renderCell (cell, bar, startDegree, poolSize, ornamentBias) {
  const events = [];
  let position = 0;

  for (let i = 0; i < cell.rhythm.length; i++) {
    const length = cell.rhythm[i];
    const degree = clampDegree (startDegree + (cell.shift ?? 0) + cell.offsets[i], poolSize);

    events.push ({
      at: bar * 8 + position,
      length,
      degree,
      // Cuts land on longer notes, the way a player would ornament them.
      ornament: length >= 2 && chance (ornamentBias)
    });

    position += length;
  }

  return events;
}

function clampDegree (degree, poolSize) {
  return Math.max (0, Math.min (poolSize + 2, degree));
}

/** A cadence bar. A full cadence comes to rest on the tonic, approached by
    step — that approach is what makes an ending sound like an ending rather
    than a stop. A half cadence stops on the fifth or second instead, leaving
    the phrase open. */
function renderCadence (bar, poolSize, kind = 'full') {
  const formula = pick (CADENCE_FORMULAS[kind]);
  const rhythm = pick (CADENCE_RHYTHMS[formula.length] ?? CADENCE_RHYTHMS[2]);
  const events = [];
  let position = 0;

  for (let i = 0; i < formula.length; i++) {
    events.push ({
      at: bar * 8 + position,
      length: rhythm[i],
      degree: clampDegree (formula[i], poolSize),
      ornament: i < formula.length - 1 && chance (0.2)
    });

    position += rhythm[i];
  }

  return events;
}

/** Rejects phrases that would sound wrong regardless of how they were built.
    Cheap, and it is what lets the operations stay adventurous. */
function isSingable (events) {
  const degrees = events.map (e => e.degree);

  // Range: a folk tune stays inside roughly a tenth.
  if (Math.max (...degrees) - Math.min (...degrees) > 9) return false;

  let consecutiveLeaps = 0;
  let repeats = 1;

  for (let i = 1; i < degrees.length; i++) {
    const interval = Math.abs (degrees[i] - degrees[i - 1]);

    // More than two leaps in a row stops sounding like a melody.
    if (interval >= 3) {
      consecutiveLeaps++;
      if (consecutiveLeaps > 2) return false;
    } else {
      consecutiveLeaps = 0;
    }

    if (degrees[i] === degrees[i - 1]) {
      repeats++;
      if (repeats > 3) return false;
    } else {
      repeats = 1;
    }
  }

  return true;
}

/** Builds an eight-bar part from a motif — the length an Irish tune actually
    comes in.

    A part is two four-bar sentences. The first states the material and stops
    on a half cadence, leaving the question open; the second restates it and
    closes on the tonic. Bar 1 and bar 5 are always the plain statement and
    bars 4 and 8 are always cadences, so two parts developed from the same
    motif share their skeleton and differ only in the middles — which is what
    makes the repeat in an AABB sound like a repeat.

    `registerShift` lifts the whole part, used for the B part: in trad the
    second part, "the turn", typically sits higher than the first. */
export function developPhrase (scale, poolSize, motif, ornamentBias = 0.28, registerShift = 0) {
  const startDegree = Math.round (poolSize * 0.35) + registerShift;
  const peak = startDegree + 2;

  const sentence = (offset, closing) => [
    ...renderCell (OPERATIONS.repeat (motif), offset, startDegree, poolSize, ornamentBias),
    ...renderCell (OPERATIONS[pick (BAR_TWO_OPERATIONS)] (motif), offset + 1, peak, poolSize, ornamentBias),
    ...renderCell (OPERATIONS[pick (BAR_THREE_OPERATIONS)] (motif), offset + 2, startDegree, poolSize, ornamentBias),
    ...renderCadence (offset + 3, poolSize, closing)
  ];

  for (let attempt = 0; attempt < 12; attempt++) {
    const events = [...sentence (0, 'half'), ...sentence (4, 'full')];
    if (isSingable (events)) return events;
  }

  // Nothing passed: the plainest possible reading of the motif, still shaped
  // as a question and an answer.
  const plain = (offset, closing) => [
    ...renderCell (OPERATIONS.repeat (motif), offset, startDegree, poolSize, ornamentBias),
    ...renderCell (OPERATIONS.repeat (motif), offset + 1, startDegree, poolSize, ornamentBias),
    ...renderCell (OPERATIONS.repeat (motif), offset + 2, startDegree, poolSize, ornamentBias),
    ...renderCadence (offset + 3, poolSize, closing)
  ];

  return [...plain (0, 'half'), ...plain (4, 'full')];
}

/** Convenience for callers that just want a phrase and do not care about
    holding on to the motif. */
export function createPhrase (scale, poolSize) {
  return developPhrase (scale, poolSize, createMotif());
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

// --------------------------------------------------------------- the counter line

/** Figuration shapes as indices into the current chord's notes. A pattern is
    chosen once per phrase and held, which is the whole point: a repeating
    figure reads as an accompaniment, while fresh note orders every bar read as
    someone fidgeting. */
const ARPEGGIOS = {
  up:        [0, 1, 2, 3],
  down:      [3, 2, 1, 0],
  upDown:    [0, 1, 2, 1],
  alberti:   [0, 2, 1, 2],      // the classic keyboard accompaniment shape
  pendulum:  [0, 2, 1, 3],
  rolling:   [0, 1, 2, 3, 2, 1] // longer cycle, so it drifts against the bar
};

const ARP_NAMES = Object.keys (ARPEGGIOS);

/** Chooses how the counter line behaves for one phrase, and works out where
    the melody is busy so the two parts can take turns.

    Direction is set against the melody's overall motion: contrary motion is
    the oldest trick there is for making two lines sound independent rather
    than doubled. */
// How the second voice relates to the tune. Figuration is accompaniment;
// the other two are ways of being a voice.
//
//   imitation    the melody's own material, a bar late and lower down. Canon.
//   heterophony  the same tune, thinned out — two fiddlers playing one melody
//                rather than two melodies. The traditional Celtic texture, and
//                the one almost nobody implements.
const TEXTURES = ['figuration', 'figuration', 'imitation', 'heterophony'];

export function planCounter (phrase) {
  const name = ARP_NAMES[Math.floor (Math.random() * ARP_NAMES.length)];

  const rise = phrase[phrase.length - 1].degree - phrase[0].degree;
  const pattern = ARPEGGIOS[name];

  return {
    name,
    texture: pick (TEXTURES),
    pattern: rise > 0 ? [...pattern].reverse() : pattern,
    busy: busyMap (phrase)
  };
}

/** For each bar of the phrase, which eighth-note slots the melody is sounding
    in. The counter line uses this to stay out of the way. */
function busyMap (phrase) {
  const bars = Array.from ({ length: 8 }, () => new Array (8).fill (false));

  for (const event of phrase) {
    const bar = Math.floor (event.at / 8);
    if (bar > 7) continue;

    for (let i = 0; i < event.length; i++) {
      const slot = (event.at % 8) + i;
      if (slot < 8) bars[bar][slot] = true;
    }
  }

  return bars;
}
