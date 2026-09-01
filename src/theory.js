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
// sevenths and ninths; plain triads sound bare in this context.
const CHORD_SHAPES = {
  maj7:  [0, 4, 7, 11],
  maj9:  [0, 4, 11, 14],
  min7:  [0, 3, 7, 10],
  min9:  [0, 3, 10, 14],
  dom7:  [0, 4, 7, 10],
  dom9:  [0, 4, 10, 14],
  min7b5: [0, 3, 6, 10],
  sus2:  [0, 2, 7, 14]
};

// Progressions written as [scaleDegree, chordQuality]. Degree is 0-indexed
// against the scale, so 1 means the second degree (ii in roman numerals).
//
// These are the backbone of the whole thing. Adding a progression here is the
// single highest-leverage way to change what the generator sounds like.
export const PROGRESSIONS = {
  major: [
    { name: 'ii-V-I',        chords: [[1, 'min9'], [4, 'dom9'], [0, 'maj9'], [0, 'maj7']] },
    { name: 'I-vi-ii-V',     chords: [[0, 'maj7'], [5, 'min7'], [1, 'min9'], [4, 'dom7']] },
    { name: 'I-IV vamp',     chords: [[0, 'maj9'], [3, 'maj7']] },
    { name: 'iii-vi-ii-V',   chords: [[2, 'min7'], [5, 'min9'], [1, 'min7'], [4, 'dom9']] }
  ],
  minor: [
    { name: 'i-iv',          chords: [[0, 'min9'], [3, 'min7']] },
    { name: 'i-VI-III-VII',  chords: [[0, 'min9'], [5, 'maj7'], [2, 'maj7'], [6, 'dom7']] },
    { name: 'i-ii°-V',       chords: [[0, 'min7'], [1, 'min7b5'], [4, 'dom7'], [0, 'min9']] },
    { name: 'iv-i vamp',     chords: [[3, 'min9'], [0, 'min7']] }
  ]
};

export function midiToNoteName (midi) {
  const octave = Math.floor (midi / 12) - 1;
  return NOTE_NAMES[midi % 12] + octave;
}

/** MIDI number for the given scale degree, wrapping into higher octaves as the
    degree runs past the end of the scale. */
export function scaleDegreeToMidi (rootMidi, scale, degree) {
  const steps = SCALES[scale];
  const octaveShift = Math.floor (degree / steps.length);
  const index = ((degree % steps.length) + steps.length) % steps.length;

  return rootMidi + steps[index] + octaveShift * 12;
}

/** Builds one chord as MIDI numbers, voiced to sit around the target register
    rather than wherever the maths happens to land it. */
export function buildChord (rootMidi, scale, degree, quality, targetMidi = 60) {
  const chordRoot = scaleDegreeToMidi (rootMidi, scale, degree);
  const shape = CHORD_SHAPES[quality] ?? CHORD_SHAPES.min7;

  // Drop the whole voicing into the octave nearest the target so progressions
  // do not leap an octave every time the degree wraps.
  let notes = shape.map (offset => chordRoot + offset);
  while (notes[0] < targetMidi - 6) notes = notes.map (n => n + 12);
  while (notes[0] > targetMidi + 6) notes = notes.map (n => n - 12);

  return notes;
}

/** The notes available to the melody over a given chord: chord tones first,
    then the rest of the scale. Weighting toward chord tones is what keeps
    random melodies from sounding random. */
export function melodyPalette (rootMidi, scale, degree, quality) {
  const chord = buildChord (rootMidi, scale, degree, quality, 72);
  const scaleNotes = [];

  for (let d = 0; d < 14; d++) {
    const midi = scaleDegreeToMidi (rootMidi, scale, d);
    if (midi >= 67 && midi <= 88) scaleNotes.push (midi);
  }

  return { chordTones: chord.filter (n => n >= 67 && n <= 88), scaleNotes };
}

export function noteNameToMidi (name) {
  const match = /^([A-G]#?)(-?\d+)$/.exec (name);
  if (! match) return 60;

  return NOTE_NAMES.indexOf (match[1]) + (parseInt (match[2], 10) + 1) * 12;
}
