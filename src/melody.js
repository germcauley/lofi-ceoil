import { TUNE_STATS } from './data/tune-stats.js';

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

// Rhythms over an eight-step (eighth note) bar. `start` is where the bar's
// first note falls and `lengths` are the note values from there.
//
// The rests matter more than the notes. An earlier version had every cell
// filling all eight quavers from position zero, which meant the tune never
// stopped and every bar landed on the downbeat — a wall of notes locked to the
// beat. Cells that start late, or stop early, are what give the melody
// phrasing and leave room for the second voice.
const RHYTHMS = [
  // filling the bar — the lilt
  { start: 0, lengths: [3, 1, 2, 2] },
  { start: 0, lengths: [2, 2, 3, 1] },
  { start: 0, lengths: [3, 1, 3, 1] },
  { start: 0, lengths: [2, 1, 1, 2, 2] },
  { start: 0, lengths: [3, 3, 2] },
  { start: 0, lengths: [1, 1, 2, 4] },

  // starting late — the downbeat is a rest, which is the strongest way to
  // break the lockstep
  { start: 2, lengths: [2, 2, 2] },
  { start: 1, lengths: [1, 2, 2, 2] },
  { start: 3, lengths: [1, 2, 2] },
  { start: 2, lengths: [3, 3] },

  // stopping early — the bar breathes before the next one
  { start: 0, lengths: [3, 1, 2] },
  { start: 0, lengths: [2, 2, 2] },
  { start: 0, lengths: [4, 2] },
  { start: 1, lengths: [2, 2, 2] }
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

// A jig and a reel do not move the same way, so the meter decides which
// repertoire the melodic grammar is drawn from.
const TUNE_TYPE = { '6/8': 'jig', '9/8': 'slip jig', '3/4': 'waltz', '2/4': 'polka' };

/** Cumulative interval table for a meter, as [step, runningTotal] pairs. */
function intervalTable (meter) {
  const type = TUNE_TYPE[meter] ?? 'reel';
  const weights = (TUNE_STATS.types[type] ?? TUNE_STATS.types.reel).intervals;
  let running = 0;
  return Object.entries (weights)
    .map (([step, weight]) => [Number (step), running += weight]);
}

// A motif has to mean the same thing in every mode. renderCell places it at
// `round (poolSize * 0.35)` and clamps to `poolSize + 2`, and the gapped pool
// is 10 notes in major and minor but 14 in dorian — so an offset that clamps
// in one mode and not another makes the same motif render two different ways,
// and a tune that changes key stops being the tune it was.
//
// These are the bounds inside which no mode clamps: the lowest start is 4, so
// -4 still reaches degree 0, and the smallest ceiling is 12, so +8 fits under
// it. The hand-tuned grammar never reached them; the measured one does.
const MOTIF_LOW = -4, MOTIF_HIGH = 8;

/** Add an interval, turning back at the edge of the motif's range rather than
    flattening against it. A tune near the top of its compass turns around,
    which keeps the leap a leap — clamping would silently repeat a note. */
function stepWithin (from, interval) {
  const forward = from + interval;
  if (forward >= MOTIF_LOW && forward <= MOTIF_HIGH) return forward;
  const back = from - interval;
  if (back >= MOTIF_LOW && back <= MOTIF_HIGH) return back;
  return Math.max (MOTIF_LOW, Math.min (MOTIF_HIGH, forward));
}

export function createMelodyGenerator (random = () => Math.random(), meter = '4/4') {
  const pick = arr => arr[Math.floor (random() * arr.length)];
  const chance = p => random() < p;
  const intervals = intervalTable (meter);

  /** Weighted melodic interval in scale steps, measured from real tunes
      rather than tuned by ear.

      What the ear got right: folk melody is overwhelmingly stepwise, and
      about half of all movement is a single step either way. What it got
      wrong, against 1.5 million intervals of jigs and reels: notes were
      repeated nearly twice as often as they are in the repertoire, thirds
      were under-used by a third, and every interval was a coin flip on
      direction when real tunes fall more than they rise — a third down is
      over one and a half times as common as a third up. Nothing wider than
      a fifth could occur at all, so the tunes could never make the big skip
      that gives a jig its lift. */
  function nextInterval () {
    const roll = random();
    for (const [step, cumulative] of intervals) if (roll < cumulative) return step;
    return 0;
  }

  // --------------------------------------------------------------------- motif

  /** One bar of material: a rhythm, and the degree offsets of each note relative
      to wherever the motif is placed. Storing offsets rather than absolute
      degrees is what lets the same cell be restated higher or lower for free. */
  function createMotif () {
    // The motif is the seed for the whole tune, so a weak one — two pitches
    // wandering by a step — makes every bar derived from it inert. Worth
    // rejecting and redrawing rather than accepting whatever comes out.
    for (let attempt = 0; attempt < 20; attempt++) {
      const cell = pick (RHYTHMS);
      const offsets = [0];

      for (let i = 1; i < cell.lengths.length; i++) {
        offsets.push (stepWithin (offsets[i - 1], nextInterval()));
      }

      if (isGoodMotif (offsets)) {
        return { start: cell.start, rhythm: cell.lengths, offsets };
      }
    }

    // Guaranteed-decent fallback: a rising figure that turns back on itself.
    return { start: 0, rhythm: [3, 1, 2, 2], offsets: [0, 1, 2, 0] };
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
      const budget = 8 - (motif.start ?? 0);
      const rhythm = [];
      const offsets = [];
      let total = 0;

      for (let i = 0; i < motif.rhythm.length; i++) {
        const length = motif.rhythm[i] * 2;
        if (total + length > budget) break;

        rhythm.push (length);
        offsets.push (motif.offsets[i]);
        total += length;
      }

      return rhythm.length
        ? { start: motif.start, rhythm, offsets, shift: 0 }
        : { ...motif, shift: 0 };
    },

    /** Keep the opening, then go somewhere new. Recognisable, but it moves. */
    truncate: motif => {
      const budget = 8 - (motif.start ?? 0);
      const keep = Math.max (1, Math.floor (motif.rhythm.length / 2));
      const rhythm = motif.rhythm.slice (0, keep);
      const offsets = motif.offsets.slice (0, keep);
      let total = rhythm.reduce ((sum, n) => sum + n, 0);

      // New tail, built from the same interval weighting as the motif itself.
      while (total < budget) {
        const length = Math.min (budget - total, pick ([1, 2, 2, 3]));
        rhythm.push (length);
        offsets.push (stepWithin (offsets[offsets.length - 1], nextInterval()));
        total += length;
      }

      return { start: motif.start, rhythm, offsets, shift: 0 };
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
    let position = cell.start ?? 0;

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

  /** Lets a note sustain across a barline where the next bar leaves room.

      Every bar was metrically sealed: notes fitted inside their bar and stopped
      at the barline, so the phrase reset on every downbeat. A tie is the
      strongest way out of that grid, and it is safe to add here because the rule
      only fires where the following bar begins with a rest — so the sustained
      note is filling silence, never colliding with the next attack. That matters
      because the lead is a single monophonic voice. */
  function addTies (events) {
    for (let bar = 0; bar < 7; bar++) {
      const thisBar = events.filter (e => Math.floor (e.at / 8) === bar);
      const nextBar = events.filter (e => Math.floor (e.at / 8) === bar + 1);

      if (! thisBar.length || ! nextBar.length) continue;

      const last = thisBar[thisBar.length - 1];
      const endsAtBarline = (last.at % 8) + last.length === 8;
      const roomInNext = nextBar[0].at % 8;

      // Cadence bars stay put: an ending that spills over stops sounding final.
      const isCadenceBar = bar === 3 || bar === 7;

      if (! endsAtBarline || roomInNext === 0 || isCadenceBar) continue;
      if (! chance (0.55)) continue;

      last.length += roomInNext;
      last.tied = true;
      // An ornament on a note that is about to be held reads as a stumble.
      last.ornament = false;
    }

    return events;
  }

  /** Adds a pickup into the second sentence.

      Irish tunes very often begin on an upbeat rather than the downbeat, and
      every phrase here started dead on beat one. The answering sentence is the
      natural place for one: bar 4's opening is approached from the tail of bar
      3, which means shortening the half cadence to make room.

      The pickup steps toward bar 4's first note, so it leads somewhere rather
      than merely filling the gap. */
  function addPickup (events, poolSize) {
    const bar3 = events.filter (e => Math.floor (e.at / 8) === 3);
    const bar4 = events.filter (e => Math.floor (e.at / 8) === 4);

    if (! bar3.length || ! bar4.length) return events;

    // Only worth doing when the answering sentence lands on the downbeat —
    // otherwise there is already a rest there doing the same job.
    if (bar4[0].at % 8 !== 0) return events;
    if (! chance (0.4)) return events;

    const last = bar3[bar3.length - 1];
    const notes = chance (0.5) ? 1 : 2;

    // Keep the cadence note audible as a cadence.
    if (last.length <= notes) return events;

    last.length -= notes;

    const target = bar4[0].degree;
    const startAt = (last.at % 8) + last.length;

    for (let i = 0; i < notes; i++) {
      // Approach from below or above, arriving a step away from the target.
      const distance = notes - i;
      const degree = clampDegree (target - distance * (target >= 2 ? 1 : -1), poolSize);

      events.push ({
        at: 3 * 8 + startAt + i,
        length: 1,
        degree,
        ornament: false,
        pickup: true
      });
    }

    return events.sort ((a, b) => a.at - b.at);
  }

  /** Gives the phrase its playing, as distinct from its notes.

      Velocity used to be random per note, which is the opposite of phrasing:
      random dynamics are noise, and a listener hears them as a machine that
      cannot decide how hard to hit anything. Real phrasing is *shape* — a line
      swells toward its peak and eases into its cadence, strong beats carry more
      weight than weak ones, stepwise notes are slurred while leaps are separated,
      and a player breathes before starting a new sentence.

      All of that is derivable from structure we already have, so none of it is
      guesswork. Each event gets a dynamic, an articulation and a breath flag,
      and the sound engine applies them. */
  function addPhrasing (events) {
    for (const [firstBar, lastBar] of [[0, 3], [4, 7]]) {
      const sentence = events.filter (e => {
        const bar = Math.floor (e.at / 8);
        return bar >= firstBar && bar <= lastBar;
      });

      if (! sentence.length) continue;

      const startAt = firstBar * 8;
      const span = (lastBar - firstBar + 1) * 8;
      const peak = Math.max (...sentence.map (e => e.degree));

      for (const event of sentence) {
        const through = (event.at - startAt) / span;

        // An arch that crests around two thirds of the way in, which is where a
        // sung phrase puts its weight — not in the middle.
        const arch = Math.sin (Math.PI * Math.min (1, through / 0.72));
        let dynamic = 0.55 + 0.45 * arch;

        // The highest note of the sentence is the one the phrase is aiming at.
        if (event.degree === peak) dynamic += 0.15;

        // Metrical weight: the downbeat carries, the offbeats give way.
        const slot = event.at % 8;
        if (slot === 0) dynamic *= 1.08;
        else if (slot === 4) dynamic *= 1.03;
        else if (slot % 2 === 1) dynamic *= 0.88;

        event.dynamic = Math.max (0.25, Math.min (1.15, dynamic));
      }

      // A player breathes before beginning a sentence, and eases out of ending
      // one. Both are tiny and both are what make a line sound played.
      sentence[0].breath = true;

      const closing = sentence[sentence.length - 1];
      closing.dynamic *= 0.78;
      closing.lift = true;

      if (sentence.length > 1) sentence[sentence.length - 2].dynamic *= 0.9;
    }

    // Articulation comes from the interval to the next note: a step is slurred,
    // a leap is separated. This is how a wind or bowed player actually phrases,
    // and it is the difference between a line and a row of notes.
    for (let i = 0; i < events.length - 1; i++) {
      const current = events[i];
      const next = events[i + 1];

      const adjacent = next.at === current.at + current.length;
      const interval = Math.abs (next.degree - current.degree);

      current.slur = adjacent && interval <= 1;
      if (adjacent && interval >= 3) current.lift = true;
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
  function developPhrase (scale, poolSize, motif, ornamentBias = 0.28, registerShift = 0) {
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
      if (isSingable (events)) return addPhrasing (addPickup (addTies (events), poolSize));
    }

    // Nothing passed: the plainest possible reading of the motif, still shaped
    // as a question and an answer.
    const plain = (offset, closing) => [
      ...renderCell (OPERATIONS.repeat (motif), offset, startDegree, poolSize, ornamentBias),
      ...renderCell (OPERATIONS.repeat (motif), offset + 1, startDegree, poolSize, ornamentBias),
      ...renderCell (OPERATIONS.repeat (motif), offset + 2, startDegree, poolSize, ornamentBias),
      ...renderCadence (offset + 3, poolSize, closing)
    ];

    return addPhrasing (addPickup (addTies ([...plain (0, 'half'), ...plain (4, 'full')]), poolSize));
  }

  /** A short riff needs time to become familiar: repeat the cell, then answer
      it with a cadence. The second sentence returns and finally resolves. */
  function developRiff (poolSize, motif) {
    const start = Math.round (poolSize * 0.35);
    const events = [];
    for (let bar = 0; bar < 8; bar++) {
      events.push (...(bar % 4 === 3
        ? renderCadence (bar, poolSize, bar === 3 ? 'half' : 'full')
        : renderCell (OPERATIONS.repeat (motif), bar, start, poolSize, 0.15)));
    }
    return addPhrasing (events);
  }

  /** Convenience for callers that just want a phrase and do not care about
      holding on to the motif. */
  function createPhrase (scale, poolSize) {
    return developPhrase (scale, poolSize, createMotif());
  }

  /** The note pool for a mode: gapped degrees across two octaves, as scale
      degree numbers ready for scaleDegreeToMidi. */
  function gappedPool (scale) {
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

  // How the figuration sits against the beat. One fixed feel every phrase is
  // what makes an accompaniment sound mechanical — it is not that any one of
  // these is wrong, it is that hearing only one is.
  //
  //   even     a note per quaver, the plain reading
  //   sparse   half as many, leaving the melody more room
  //   double   semiquaver pairs, so the figure runs
  //   pulsed   quavers with every other one much lighter, which swings it
  const FIGURE_FEELS = ['even', 'even', 'sparse', 'double', 'pulsed'];

  function planCounter (phrase, eighths = 8) {
    const name = ARP_NAMES[Math.floor (random() * ARP_NAMES.length)];

    const rise = phrase[phrase.length - 1].degree - phrase[0].degree;
    const pattern = ARPEGGIOS[name];

    return {
      name,
      texture: pick (TEXTURES),
      feel: pick (FIGURE_FEELS),
      // Where the figure sits: occasionally an octave up, which changes its role
      // from foundation to decoration without changing a note of it.
      octave: chance (0.25) ? 1 : 0,
      pattern: rise > 0 ? [...pattern].reverse() : pattern,
      busy: busyMap (phrase, eighths)
    };
  }

  /** For each bar of the phrase, which eighth-note slots the melody is sounding
      in. The counter line uses this to stay out of the way. */
  function busyMap (phrase, eighths) {
    const bars = Array.from ({ length: 8 }, () => new Array (eighths).fill (false));

    for (const event of phrase) {
      const bar = Math.floor (event.at / eighths);
      if (bar > 7) continue;

      for (let i = 0; i < event.length; i++) {
        const slot = (event.at % eighths) + i;
        if (slot < eighths) bars[bar][slot] = true;
      }
    }

    return bars;
  }

  // Preserve the statement and cadences, answering with a neighbouring scale
  // tone in the middle bars. Reject awkward contours using the same musical
  // guard as phrase generation; never mutate the hook kept for its return.
  function varyPhrase (phrase, poolSize, direction = 1) {
    const candidate = phrase.map (event => {
      const bar = Math.floor (event.at / 8);
      if (! [1, 2, 5, 6].includes (bar)) return { ...event };
      return { ...event, degree: Math.max (0, Math.min (poolSize - 1, event.degree + direction)) };
    });
    return isSingable (candidate) ? candidate : phrase.map (event => ({ ...event }));
  }

  return { createMotif, developPhrase, developRiff, varyPhrase, createPhrase, gappedPool, planCounter };
}

const defaultGenerator = createMelodyGenerator();
export const createMotif = (...args) => defaultGenerator.createMotif (...args);
export const developPhrase = (...args) => defaultGenerator.developPhrase (...args);
export const developRiff = (...args) => defaultGenerator.developRiff (...args);
export const createPhrase = (...args) => defaultGenerator.createPhrase (...args);
export const gappedPool = (...args) => defaultGenerator.gappedPool (...args);
export const planCounter = (...args) => defaultGenerator.planCounter (...args);
