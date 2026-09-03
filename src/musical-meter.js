// Score times stay in quarter-note beats; tempo controls count the main pulse.
export const meterInfo = meter => meter === '6/8'
  ? { beats: 3, eighths: 6, pulseBeats: 1.5 }
  : { beats: 4, eighths: 8, pulseBeats: 1 };

/** Rephrase each half-bar into three quavers, preserving melodic contour,
    rests and cadences. Quantise boundaries, not playback speed: a jig needs
    groups of three rather than compressed four-quaver rhythms. */
export function jigPhrase (phrase) {
  const boundary = at => Math.floor (at / 4) * 3 + [0, 1, 2, 2][at % 4];
  return phrase.flatMap (note => {
    const at = boundary (note.at), end = boundary (note.at + note.length);
    return end > at ? [{ ...note, at, length: end - at,
      dynamic: (note.dynamic ?? 0.8) * (at % 3 === 0 ? 1 : 0.9) }] : [];
  });
}
