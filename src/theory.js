// Everything about which notes get played. No audio in this file — it deals in
// MIDI numbers and note names only, so it can be reasoned about (and changed)
// without thinking about the sound engine at all.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Semitone offsets from the root.
export const SCALES = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10]
};

// Chord shapes as semitone offsets from the chord root. Lofi lives on
// sevenths and ninths, but the pop progressions want plain triads too — a
// four-chord loop voiced entirely in major sevenths stops sounding like pop.
const CHORD_SHAPES = {
  maj:    [0, 4, 7, 12],
  min:    [0, 3, 7, 12],
  maj7:   [0, 4, 7, 11],
  maj9:   [0, 4, 11, 14],
  min7:   [0, 3, 7, 10],
  min9:   [0, 3, 10, 14],
  dom7:   [0, 4, 7, 10],
  dom9:   [0, 4, 10, 14],
  min7b5: [0, 3, 6, 10],
  sus4:   [0, 5, 7, 12],
  sus2:   [0, 2, 7, 14]
};

// Progressions as [scaleDegree, chordQuality]. Degree is 0-indexed against the
// mode, so 1 means the second degree (ii in roman numerals).
//
// One set per mode, because the modes differ in exactly the chords that define
// them: dorian's major IV comes from its raised sixth, mixolydian's major bVII
// from its flat seventh. Mapping dorian onto a generic minor set throws away
// the only thing that makes it sound dorian.
//
// Chord progressions are not copyrightable — they are unprotectable common
// material, which is why one four-chord loop underpins hundreds of hit songs.
export const PROGRESSIONS = {
  major: [
    { name: 'I-V-vi-IV',    chords: [[0, 'maj9'], [4, 'dom7'], [5, 'min7'], [3, 'maj7']] },
    { name: 'vi-IV-I-V',    chords: [[5, 'min7'], [3, 'maj7'], [0, 'maj9'], [4, 'dom7']] },
    { name: 'I-vi-IV-V',    chords: [[0, 'maj7'], [5, 'min7'], [3, 'maj7'], [4, 'dom7']] },
    { name: 'I-iii-IV-V',   chords: [[0, 'maj7'], [2, 'min7'], [3, 'maj7'], [4, 'dom7']] },
    { name: 'ii-V-I',       chords: [[1, 'min9'], [4, 'dom9'], [0, 'maj9'], [0, 'maj7']] },
    { name: 'I-IV vamp',    chords: [[0, 'maj9'], [3, 'maj7']] }
  ],

  minor: [
    { name: 'i-VI-III-VII', chords: [[0, 'min9'], [5, 'maj7'], [2, 'maj7'], [6, 'dom7']] },
    { name: 'i-VII-VI-VII', chords: [[0, 'min9'], [6, 'dom7'], [5, 'maj7'], [6, 'dom7']] },
    { name: 'i-iv',         chords: [[0, 'min9'], [3, 'min7']] },
    { name: 'i-VII-iv-i',   chords: [[0, 'min7'], [6, 'maj7'], [3, 'min7'], [0, 'min9']] },
    { name: 'i-ii°-V',      chords: [[0, 'min7'], [1, 'min7b5'], [4, 'min7'], [0, 'min9']] }
  ],

  // The raised sixth gives a major IV over a minor tonic. That i-IV shift is
  // the dorian sound, and a great many Irish tunes sit on it.
  dorian: [
    { name: 'i-IV vamp',    chords: [[0, 'min7'], [3, 'maj7']] },
    { name: 'i-VII-IV-i',   chords: [[0, 'min9'], [6, 'maj7'], [3, 'maj7'], [0, 'min7']] },
    { name: 'i-IV-VII-i',   chords: [[0, 'min7'], [3, 'maj7'], [6, 'maj7'], [0, 'min9']] },
    { name: 'i-VII vamp',   chords: [[0, 'min9'], [6, 'maj7']] },
    { name: 'i-IV-i-VII',   chords: [[0, 'min7'], [3, 'maj7'], [0, 'min9'], [6, 'dom7']] }
  ],

  // I-bVII-IV is the point where Irish traditional music and rock already meet.
  mixolydian: [
    { name: 'I-VII-IV',     chords: [[0, 'dom9'], [6, 'maj7'], [3, 'maj7']] },
    { name: 'I-VII vamp',   chords: [[0, 'maj9'], [6, 'maj7']] },
    { name: 'I-IV-VII-IV',  chords: [[0, 'maj9'], [3, 'maj7'], [6, 'maj7'], [3, 'maj7']] },
    { name: 'I-v-IV',       chords: [[0, 'dom9'], [4, 'min7'], [3, 'maj7']] }
  ]
};

export function midiToNoteName (midi) {
  const octave = Math.floor (midi / 12) - 1;
  return NOTE_NAMES[midi % 12] + octave;
}

/** MIDI number for the given scale degree, wrapping into higher octaves as the
    degree runs past the end of the scale. */
export function scaleDegreeToMidi (rootMidi, scale, degree) {
  const steps = SCALES[scale] ?? SCALES.minor;
  const octaveShift = Math.floor (degree / steps.length);
  const index = ((degree % steps.length) + steps.length) % steps.length;

  return rootMidi + steps[index] + octaveShift * 12;
}

/** Builds one chord as MIDI numbers, voiced around a target register. Used
    where a fixed shape is wanted — the counter line arpeggiates this. */
export function buildChord (rootMidi, scale, degree, quality, targetMidi = 60) {
  const chordRoot = scaleDegreeToMidi (rootMidi, scale, degree);
  const shape = CHORD_SHAPES[quality] ?? CHORD_SHAPES.min7;

  let notes = shape.map (offset => chordRoot + offset);
  while (notes[0] < targetMidi - 6) notes = notes.map (n => n + 12);
  while (notes[0] > targetMidi + 6) notes = notes.map (n => n - 12);

  return notes;
}

/** The pitch classes a chord contains, with no octave information. */
export function chordPitchClasses (rootMidi, scale, degree, quality) {
  const chordRoot = scaleDegreeToMidi (rootMidi, scale, degree);
  const shape = CHORD_SHAPES[quality] ?? CHORD_SHAPES.min7;

  return [...new Set (shape.map (offset => (chordRoot + offset) % 12))];
}

/** The nearest MIDI note to `from` carrying one of `pitchClasses`, skipping
    anything already taken. */
function nearestVoice (from, pitchClasses, taken, low, high) {
  let best = null;
  let bestDistance = Infinity;

  for (const pc of pitchClasses) {
    // Candidates in every octave that could plausibly be closest.
    const base = Math.floor ((from - pc) / 12) * 12 + pc;

    for (const candidate of [base - 12, base, base + 12]) {
      if (candidate < low || candidate > high || taken.has (candidate)) continue;

      const distance = Math.abs (candidate - from);

      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }

  return best;
}

/** Voices a chord by moving each voice of the previous chord to the nearest
    tone of the new one, holding common tones where they exist.

    This is the difference between a chord sequence and a chord progression.
    Re-voicing each chord independently moves every voice at once, which is
    what makes block chords sound blocky. */
export function voiceLead (previous, pitchClasses, targetMidi = 60, voices = 4) {
  const low = targetMidi - 14;
  const high = targetMidi + 18;

  // No previous chord: lay the voices out from the target upward.
  if (! previous || ! previous.length) {
    const taken = new Set();
    const notes = [];
    let from = targetMidi - 4;

    for (let i = 0; i < voices; i++) {
      const note = nearestVoice (from, pitchClasses, taken, low, high);
      if (note === null) break;

      taken.add (note);
      notes.push (note);
      from = note + 3;
    }

    return notes.sort ((a, b) => a - b);
  }

  const taken = new Set();
  const notes = [];

  // Moving the outer voices first keeps the top and bottom of the voicing
  // stable, which is what the ear actually follows.
  const order = [...previous].sort ((a, b) =>
    Math.abs (b - targetMidi) - Math.abs (a - targetMidi));

  for (const voice of order) {
    const note = nearestVoice (voice, pitchClasses, taken, low, high);
    if (note === null) continue;

    taken.add (note);
    notes.push (note);
  }

  // Guard against the voicing drifting out of register over many changes.
  const sorted = notes.sort ((a, b) => a - b);
  const centre = sorted.reduce ((sum, n) => sum + n, 0) / (sorted.length || 1);

  if (centre > targetMidi + 9) return sorted.map (n => n - 12);
  if (centre < targetMidi - 9) return sorted.map (n => n + 12);

  return sorted;
}

/** The diatonic triads of a key, as pitch-class sets with a quality.

    Triads rather than sevenths, because a seventh is far less likely to be
    shared between two keys and a pivot only works if the chord genuinely
    belongs to both. */
export function diatonicTriads (rootMidi, scale) {
  const triads = [];

  for (let degree = 0; degree < 7; degree++) {
    const root = scaleDegreeToMidi (rootMidi, scale, degree);
    const third = scaleDegreeToMidi (rootMidi, scale, degree + 2);
    const fifth = scaleDegreeToMidi (rootMidi, scale, degree + 4);

    const thirdInterval = third - root;
    const fifthInterval = fifth - root;

    const quality = fifthInterval === 6 ? 'min7b5'
      : thirdInterval === 4 ? 'maj'
      : 'min';

    triads.push ({
      degree,
      quality,
      pitchClasses: new Set ([root % 12, third % 12, fifth % 12])
    });
  }

  return triads;
}

function sameNotes (a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) if (! b.has (value)) return false;
  return true;
}

/** Finds a chord belonging to both keys — a pivot.

    A modulation across silence is an edit; a modulation through a chord that
    belongs to both keys happens inside the music. The ear hears the pivot in
    the old key, and then finds it has been in the new one all along.

    The tonic of the outgoing key is rejected as a pivot: it is the least
    ambiguous chord there is, and ambiguity is the whole mechanism. Returns
    null when the keys share nothing, which is the signal to fall back to a
    plain change. */
export function findPivot (fromRoot, fromScale, toRoot, toScale) {
  const from = diatonicTriads (fromRoot, fromScale);
  const to = diatonicTriads (toRoot, toScale);

  const options = [];

  for (const a of from) {
    if (a.degree === 0) continue;

    for (const b of to) {
      if (sameNotes (a.pitchClasses, b.pitchClasses)) {
        options.push ({ fromDegree: a.degree, toDegree: b.degree, quality: a.quality });
      }
    }
  }

  if (! options.length) return null;

  // Prefer a pivot that is a strong chord in the key we are arriving at —
  // landing on its fourth or fifth sets up the new tonic.
  const strong = options.filter (o => o.toDegree === 3 || o.toDegree === 4);
  const pool = strong.length ? strong : options;

  return pool[Math.floor (Math.random() * pool.length)];
}

/** Nudges a melody note onto a chord tone, but only ever by one scale step.

    Melody notes are chosen from a gapped pool with no knowledge of the chord
    underneath, so a held note can land a second away from every chord tone and
    simply sit there. This fixes that without wrecking the tune: if a chord
    tone is within one scale step it moves, and if it is further away the note
    is left alone rather than distorting the motif's shape.

    Returns the possibly-adjusted MIDI note. */
export function fitToChordTone (midi, baseMidi, scale, poolDegree, pool, chordPitchClassSet) {
  if (chordPitchClassSet.has (midi % 12)) return midi;

  let best = null;
  let bestDistance = Infinity;

  for (const step of [1, -1]) {
    const index = poolDegree + step;
    if (index < 0 || index >= pool.length) continue;

    const candidate = scaleDegreeToMidi (baseMidi, scale, pool[index]);
    if (! chordPitchClassSet.has (candidate % 12)) continue;

    const distance = Math.abs (candidate - midi);

    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  // Only worth moving if it is genuinely a step away; anything larger would
  // change the melody rather than correct it.
  return best !== null && bestDistance <= 2 ? best : midi;
}

export function noteNameToMidi (name) {
  const match = /^([A-G]#?)(-?\d+)$/.exec (name);
  if (! match) return 60;

  return NOTE_NAMES.indexOf (match[1]) + (parseInt (match[2], 10) + 1) * 12;
}
